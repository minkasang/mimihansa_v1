/**
 * 幸福镇 - NPC大脑决策系统演示
 * 2.5D等距像素艺术风格，顶级商业化品质
 */

// 旧决策引擎已删除（阶段 -1.1），全部改用 BrainEngine + ScoreCalculator
import { generateSampleSpriteSheet, getFrameFromSpriteSheet, type Facing, type AnimationState } from "./npc/spriteSheetGenerator";
import { MapManager, 幸福镇地图, type BuildingDef } from "./world/mapData";
import { PerceptionSystem, type Perceivable, type PerceptionResult } from "./systems/perception";
import { TaskSystem, TaskType, TaskPriority, type Task } from "./systems/taskSystem";
import { DialogueSystem, DialogueType, type Dialogue } from "./systems/dialogue";
import { ScriptEngine, type RoleScript, type ScriptModule } from "./systems/scriptEngine";
import { NPCManager } from "./engine/NPCManager";
import type { NpcDefinition } from "./types/npcTypes";
import { BrainEngine, type BrainOutput, type PerceptionSnapshot } from "./engine/BrainEngine";
import { createModuleRegistry } from "./engine/ModuleFactory";
import { WorldDynamics } from "./engine/WorldDynamics";
import { PathFinder } from "./engine/PathFinder";
import {
  renderIsoMap,
  gridToIso,
  invalidateCache,
} from "./render/IsometricMap";
import { WebGLIsoRenderer } from "./render/WebGLIsoRenderer";

import { lerp, hash2D } from "./utils/math";
import { ParticleSystem } from "./render/ParticleSystem";
import { WeatherSystem, type WeatherType, WEATHER_CONFIGS } from "./systems/WeatherSystem";

const ITEM_DEFINITIONS: Record<string, { 物品id: string; 名称: string; 类型: string; 标签: string[] }> = {
  "野果": { 物品id: "item_forage_fruit", 名称: "野果", 类型: "食物", 标签: ["食物", "可食用", "自然"] },
  "烤肉": { 物品id: "item_cooked_meat", 名称: "烤肉", 类型: "食物", 标签: ["食物", "可食用", "熟食"] },
  "生肉": { 物品id: "item_raw_meat", 名称: "生肉", 类型: "食材", 标签: ["生肉", "食材"] },
  "木材": { 物品id: "item_wood", 名称: "木材", 类型: "材料", 标签: ["木材", "材料", "自然"] },
  "石头": { 物品id: "item_stone", 名称: "石头", 类型: "材料", 标签: ["石头", "材料", "自然"] },
  "石刀": { 物品id: "item_stone_knife", 名称: "石刀", 类型: "工具", 标签: ["工具", "武器", "石制"] },
  "火把": { 物品id: "item_torch", 名称: "火把", 类型: "工具", 标签: ["照明", "工具"] },
  "苹果": { 物品id: "item_apple", 名称: "苹果", 类型: "食物", 标签: ["食物", "可食用", "水果"] },
};

function getOrCreateItemDef(itemName: string): { 物品id: string; 名称: string; 类型: string; 标签: string[] } {
  return ITEM_DEFINITIONS[itemName] || { 物品id: "item_" + itemName, 名称: itemName, 类型: "杂项", 标签: [] };
}

// NPC数据由NPCManager从 npc/ 文件夹自动加载

// ==================== NPC类 ====================
class Npc {
  x: number; y: number;
  targetX: number | null = null; targetY: number | null = null;
  isMoving = false; facing: Facing = "down"; animState: AnimationState = "idle";
  walkFrame = 0; lastWalkTime = 0; lastDecisionTime = 0;
  currentTask: Task | null = null;
  perceptionResult: PerceptionResult | null = null;
  isShopOpen = false; lastScriptExecution = 0; currentScriptAction: string | null = null;
  brainDebug: any = null;
  _lastInteractTarget: string | null = null;
  private pathQueue: [number, number][] = [];

  constructor(public data: NpcDefinition, private brainEngine: BrainEngine, private pathFinder: PathFinder) {
    this.x = data.x; this.y = data.y;
    brainEngine.initNpc(data.id);
  }

  update(now: number, timeScale: number, mapManager: MapManager, perceptionSystem: PerceptionSystem,
         allNpcs: Npc[], dialogueSystem: DialogueSystem, taskSystem: TaskSystem, deltaMs: number, currentWeather: string, scriptEngine?: ScriptEngine): void {
    // 所有 NPC 都感知周围（含玩家，这样侧边栏能看到感知结果）
    this.perceiveSurroundings(perceptionSystem, allNpcs);

    // 玩家 NPC：只由 WASD 控制，不走 AI 大脑
    if (this.data.controllable) {
      this.executeTask(now, timeScale, mapManager, taskSystem);
      return;
    }

    if (this.data.roleType === "merchant" && scriptEngine) {
      this.updateMerchantBehavior(now, timeScale, mapManager, dialogueSystem, scriptEngine, allNpcs);
    } else {
      this.updateBrainBehavior(now, timeScale, mapManager, dialogueSystem, scriptEngine, allNpcs, deltaMs, currentWeather);
    }
    this.executeTask(now, timeScale, mapManager, taskSystem);
  }

  private updateBrainBehavior(
    now: number, timeScale: number, mapManager: MapManager,
    dialogueSystem: DialogueSystem, scriptEngine: ScriptEngine | undefined, allNpcs: Npc[],
    deltaMs: number, currentWeather: string
  ): void {

    // 构建感知快照
    const snapshot: PerceptionSnapshot = {
      visual: (this.perceptionResult?.visual || []).map(v => ({
        id: v.id,
        x: v.x,
        y: v.y,
        颜值: v.visual?.颜值 || 5,
        类型: v.type,
      })),
      auditory: (this.perceptionResult?.auditory || []).map(a => ({
        id: a.id,
        x: a.x,
        y: a.y,
      })),
    };

    // 构建NPC状态（使用真实NPC数据）
    const raw = this.data.rawData || {};
    const isRainOrStorm = currentWeather === "rain" || currentWeather === "thunderstorm";
    const npcState = {
      x: this.x,
      y: this.y,
      性格: this.data.personality,
      生理状态: this.data.state,
      物品栏: raw.物品栏 || [],
      家坐标: raw.家坐标 as [number, number] | undefined,
      记忆标签: raw.记忆标签 || [],
      金钱: raw.金钱 || 50,
      知识库: raw.知识库,
      当前动作: this.isMoving ? "moving" : (this.animState === "idle" ? "idle" : this.animState),
      环境: {
        天气: isRainOrStorm ? "暴雨" : "晴朗",
        是否在室内: false,
      },
    };

    // 🧠 大脑决策
    const outputs = this.brainEngine.tick(
      this.data.id, npcState, snapshot, now, deltaMs, timeScale
    );

    this.brainDebug = this.brainEngine.getDebugState(this.data.id);

    // 处理输出
    for (const output of outputs) {
      switch (output.type) {
        case "move":
          if (!this.isMoving && this.data.roleType !== "merchant") {
            let tx: number, ty: number;
            if (output.data.center && output.data.radius) {
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * output.data.radius;
              tx = Math.floor(output.data.center[0] + Math.cos(angle) * dist);
              ty = Math.floor(output.data.center[1] + Math.sin(angle) * dist);
            } else if (output.data.targetX !== undefined && output.data.targetY !== undefined) {
              tx = Math.floor(output.data.targetX);
              ty = Math.floor(output.data.targetY);
            } else {
              break;
            }
            if (mapManager.isPassable(tx, ty)) {
              this.targetX = tx; this.targetY = ty; this.isMoving = true;
              this.pathQueue = [];
            }
          }
          break;

        case "dialogue":
          if (output.data.text) {
            dialogueSystem.addCustomDialogue(this.data.id, String(output.data.text), DialogueType.SPEAK, output.data.duration || 4000);
          } else if (output.data.template_id && scriptEngine) {
            const text = scriptEngine.getDialogueText(output.data.template_id);
            if (text) {
              dialogueSystem.addCustomDialogue(this.data.id, text, DialogueType.SPEAK, output.data.duration || 4000);
            }
          }
          break;

        case "animation":
          if (output.data.animation) {
            this.animState = output.data.animation as AnimationState;
          }
          break;

        case "state_change":
          this.applyStateChange(output.data, dialogueSystem);
          break;

        case "idle":
          break;
      }
    }
  }

  private updateMerchantBehavior(now: number, timeScale: number, mapManager: MapManager,
                                 dialogueSystem: DialogueSystem, scriptEngine: ScriptEngine, allNpcs: Npc[]): void {
    if (now - this.lastScriptExecution > 2000 / timeScale) {
      this.lastScriptExecution = now;
      const nearbyNpcs = allNpcs.filter(n => n.data.id !== this.data.id).map(n => ({ id: n.data.id, x: n.x, y: n.y }));
      const modules = scriptEngine.updateNpcScript(this.data.id, this.x, this.y, this.data.personality, now, nearbyNpcs);

      for (const module of modules) {
        const result = scriptEngine.executeModule(this.data.id, module, this.x, this.y, this.data.personality, nearbyNpcs);
        if (result) {
          switch (result.type) {
            case "move":
              if (!this.isMoving) {
                const tx = Math.floor(result.data.targetX);
                const ty = Math.floor(result.data.targetY);
                if (mapManager.isPassable(tx, ty)) { this.targetX = tx; this.targetY = ty; this.isMoving = true; }
              }
              break;
            case "dialogue":
              dialogueSystem.generateDialogue("action_" + result.data.dialogueType, this.data.id, this.data.personality);
              break;
            case "shop_open": this.isShopOpen = true; this.currentScriptAction = "营业中"; scriptEngine.setShopOpen(this.data.id, true); break;
            case "shop_close": this.isShopOpen = false; this.currentScriptAction = "已关店"; scriptEngine.setShopOpen(this.data.id, false); break;
            case "animation": this.animState = result.data.animation; break;
          }
          break;
        }
      }
    }
    if (!this.isMoving && Math.random() < 0.02) this.randomMoveInArea(mapManager);
  }

  private randomMoveInArea(mapManager: MapManager): void {
    if (!this.data.activityCenter || !this.data.activityRadius) return;
    const center = this.data.activityCenter; const radius = this.data.activityRadius;
    const angle = Math.random() * Math.PI * 2; const dist = Math.random() * radius;
    const targetX = Math.floor(center[0] + Math.cos(angle) * dist);
    const targetY = Math.floor(center[1] + Math.sin(angle) * dist);
    if (mapManager.isPassable(targetX, targetY)) { this.targetX = targetX; this.targetY = targetY; this.isMoving = true; }
  }

  private perceiveSurroundings(perceptionSystem: PerceptionSystem, allNpcs: Npc[]): void {
    const self: Perceivable = { id: this.data.id, x: this.x, y: this.y, type: this.data.controllable ? "player" : "npc", visual: { 颜值: this.data.personality.颜值 || 5 } };
    const targets: Perceivable[] = allNpcs.filter(npc => npc.data.id !== this.data.id).map(npc => ({ id: npc.data.id, x: npc.x, y: npc.y, type: npc.data.controllable ? "player" : "npc", visual: { 颜值: npc.data.personality.颜值 || 5 } }));
    this.perceptionResult = perceptionSystem.perceive(self, targets, { sightRange: this.data.perceptionRange, hearingRange: this.data.perceptionRange + 4, sightAngle: 360, blockedByObstacles: true });
  }

  private executeTask(now: number, timeScale: number, mapManager: MapManager, taskSystem: TaskSystem): void {
    const task = taskSystem.getCurrentTask(this.data.id);
    if (task && !this.isMoving) {
      this.currentTask = task;
      switch (task.type) {
        case TaskType.MOVE:
          if (task.target?.x !== undefined && task.target?.y !== undefined) {
            const path = this.pathFinder.findPath(this.x, this.y, task.target.x, task.target.y, mapManager);
            if (path.length > 1) {
              this.pathQueue = path.slice(1).map(([x, y]) => [x, y] as [number, number]);
              this.targetX = this.pathQueue.shift()![0];
              this.targetY = this.pathQueue.shift()![1];
              this.isMoving = true;
            } else {
              taskSystem.completeTask(this.data.id, task.id);
            }
          }
          break;
        case TaskType.PURSUE: if (task.target?.npcId) this.randomMoveOneStep(mapManager); break;
        default: this.randomMoveOneStep(mapManager);
      }
    } else if (!this.isMoving && !task && this.data.controllable) {
      // 玩家 NPC：无任务 + 不在移动 → 不做自动随机走动
    } else if (!this.isMoving && !task && this.data.roleType !== "merchant" && !this.data.controllable) {
      // AI NPC 不在此处随机走动，由 BrainEngine 控制移动
    }

    if (this.isMoving && this.targetX !== null && this.targetY !== null) {
      const baseSpeed = 0.03;
      const speedMultiplier = this.data.speedMultiplier || 1.0;
      // 根据状态调整速度：非空闲时暂停移动
      let actionSpeedMod = 1.0;
      if (this.animState !== "walk" && this.animState !== "idle") actionSpeedMod = 0;
      const speed = baseSpeed * speedMultiplier * timeScale * actionSpeedMod;
      const dx = this.targetX - this.x; const dy = this.targetY - this.y;
      if (Math.abs(dx) > speed || Math.abs(dy) > speed) {
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), speed);
        this.y += Math.sign(dy) * Math.min(Math.abs(dy), speed);
        this.animState = "walk";
        if (now - this.lastWalkTime > 180) { this.walkFrame = (this.walkFrame + 1) % 4; this.lastWalkTime = now; }
        if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? "right" : "left";
        else this.facing = dy > 0 ? "down" : "up";
      } else {
        this.x = this.targetX; this.y = this.targetY;
        if (this.pathQueue.length > 0) {
          const next = this.pathQueue.shift()!;
          this.targetX = next[0];
          this.targetY = next[1];
        } else {
          this.targetX = null; this.targetY = null; this.isMoving = false; this.animState = "idle"; this.walkFrame = 0;
        }
      }
    }
  }

  private randomMoveOneStep(mapManager: MapManager): void {
    const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const newX = Math.floor(this.x + dir.dx); const newY = Math.floor(this.y + dir.dy);
    if (mapManager.isPassable(newX, newY)) { this.targetX = newX; this.targetY = newY; this.isMoving = true; }
  }

  private applyStateChange(data: Record<string, any>, dialogueSystem?: DialogueSystem): void {
    const key: string = data.key || "";
    const value: any = data.value;
    const operation: string = data.operation || "set";

    if (!key) return;

    if (key === "当前动作") {
      if (value === "eating" || value === "sleeping" || value === "idle" || value === "walk"
        || value === "drinking" || value === "foraging" || value === "collecting_wood"
        || value === "collecting_stone" || value === "building" || value === "making_fire"
        || value === "crafting" || value === "hunting" || value === "cooking") {
        this.animState = value as AnimationState;
      }
      return;
    }

    if (key === "金钱") {
      const raw = this.data.rawData || {};
      const current = (raw.金钱 || 0) as number;
      if (operation === "add") {
        raw.金钱 = Math.max(0, current + Number(value));
      } else {
        raw.金钱 = Math.max(0, Number(value));
      }
      return;
    }

    if (key === "物品栏") {
      const raw = this.data.rawData || {};
      if (!raw.物品栏) raw.物品栏 = [];
      const items = raw.物品栏 as any[];
      if (operation === "addItem") {
        const itemName = String(value);
        const itemDef = getOrCreateItemDef(itemName);
        const existing = items.find((i: any) => i.名称 === itemName);
        if (existing) {
          existing.数量 = (existing.数量 || 1) + 1;
        } else {
          items.push({ ...itemDef, 数量: 1 });
        }
        raw.物品栏 = items;
      } else if (operation === "removeItem") {
        const itemName = String(value);
        const removeCount = Number(data.数量) || 1;
        const existing = items.find((i: any) => i.名称 === itemName);
        if (existing) {
          existing.数量 = (existing.数量 || 1) - removeCount;
          if (existing.数量 <= 0) {
            raw.物品栏 = items.filter((i: any) => i.名称 !== itemName);
          }
        }
      }
      return;
    }

    if (key === "家坐标") {
      const raw = this.data.rawData || {};
      if (operation === "set") {
        if (value === "$当前位置") {
          raw.家坐标 = [Math.floor(this.x), Math.floor(this.y)];
        } else if (Array.isArray(value) && value.length >= 2) {
          raw.家坐标 = [Number(value[0]), Number(value[1])];
        }
      }
      return;
    }

    if (key === "标签") {
      const raw = this.data.rawData || {};
      if (!raw.标签) raw.标签 = [];
      if (operation === "add") {
        const tags = Array.isArray(value) ? value : [value];
        for (const tag of tags) {
          if (!raw.标签.includes(tag)) raw.标签.push(tag);
        }
      } else if (operation === "remove") {
        const tags = Array.isArray(value) ? value : [value];
        raw.标签 = raw.标签.filter((t: string) => !tags.includes(t));
      }
      return;
    }

    if (key === "好感度") {
      const raw = this.data.rawData || {};
      if (!raw.好感度) raw.好感度 = {};
      const targetId = data.target || this._lastInteractTarget;
      if (targetId) {
        const current = raw.好感度[targetId] || 0;
        if (operation === "add" || String(value).startsWith("+")) {
          raw.好感度[targetId] = Math.max(-100, Math.min(100, current + Number(String(value).replace("+", ""))));
        } else {
          raw.好感度[targetId] = Number(value);
        }
      }
      return;
    }

    const state = this.data.state;
    if (state) {
      if (key in state) {
        if (operation === "add") {
          state[key] = Math.max(0, Math.min(10, (state[key] || 0) + Number(value)));
        } else {
          state[key] = Math.max(0, Math.min(10, Number(value)));
        }
        return;
      }

      if (key === "口渴" || key === "性欲") {
        if (operation === "add") {
          state[key] = Math.max(0, Math.min(key === "性欲" ? 100 : 10, (state[key] || 0) + Number(value)));
        } else {
          state[key] = Math.max(0, Math.min(key === "性欲" ? 100 : 10, Number(value)));
        }
        return;
      }
    }

    if (key.includes(".")) {
      const parts = key.split(".");
      if (parts[0] === "生理状态" && state) {
        const stateKey = parts[1];
        if (operation === "add") {
          state[stateKey] = Math.max(0, Math.min(stateKey === "性欲" ? 100 : 10, (state[stateKey] || 0) + Number(value)));
        } else {
          state[stateKey] = Math.max(0, Math.min(stateKey === "性欲" ? 100 : 10, Number(value)));
        }
        return;
      }
      if (parts[0] === "技能") {
        const raw = this.data.rawData || {};
        if (!raw.技能) raw.技能 = {};
        if (operation === "add") {
          raw.技能[parts[1]] = Math.max(0, Math.min(100, (raw.技能[parts[1]] || 0) + Number(value)));
        } else {
          raw.技能[parts[1]] = Number(value);
        }
        return;
      }
    }

    if (key === "记忆标签") {
      const raw = this.data.rawData || {};
      if (!raw.记忆标签) raw.记忆标签 = [];
      if (operation === "add" && !raw.记忆标签.includes(value)) {
        raw.记忆标签.push(value);
      } else if (operation === "remove") {
        raw.记忆标签 = raw.记忆标签.filter((t: string) => t !== value);
      }
      return;
    }
  }
}

// ==================== 游戏主类 ====================
class Game {
  private canvas!: HTMLCanvasElement; private ctx!: CanvasRenderingContext2D;
  private overlayCanvas!: HTMLCanvasElement; private overlayCtx!: CanvasRenderingContext2D;
  private webglRenderer!: WebGLIsoRenderer;
  private useWebGL = true;
  private container!: HTMLElement; private sidebar!: HTMLElement;
  private mapManager!: MapManager; private perceptionSystem!: PerceptionSystem;
  private taskSystem!: TaskSystem; private dialogueSystem!: DialogueSystem;
  private scriptEngine!: ScriptEngine; private brainEngine!: BrainEngine;
  private worldDynamics!: WorldDynamics;
  private pathFinder = new PathFinder();
  private npcs: Npc[] = []; private spriteSheet!: HTMLCanvasElement;
  private cameraX = 0; private cameraY = 0; private zoom = 1;
  private minZoom = 0.2; private maxZoom = 3;
  private isDragging = false; private lastMouseX = 0; private lastMouseY = 0;
  private isCtrlPressed = false; private selectedNpc: Npc | null = null; private hoveredNpc: Npc | null = null;
  private playerNpc: Npc | null = null; private keys = new Set<string>();

  private gameHour = 8; private gameMinute = 0; private gameDay = 1;
  private prevGameDay = 1;
  private timeScale = 1; private maxTimeScale = 100; private isPaused = false;
  private timeAccumulator = 0;

  private dayPhase: "dawn" | "day" | "dusk" | "night" = "day";
  private ambientLight = 1;

  private weatherSystem = new WeatherSystem();
  private particleSystem = new ParticleSystem();

  private frameCount = 0; private lastFpsTime = 0; private fps = 0;
  private lastFrameTimestamp = 0;
  constructor() { this.init(); }

  private init(): void {
    this.canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
    this.overlayCtx = this.overlayCanvas.getContext("2d")!;
    this.container = document.getElementById("map-container")!;
    this.sidebar = document.getElementById("npc-list")!;
    this.mapManager = new MapManager(幸福镇地图);
    
    // 初始化 WebGL 渲染器
    try {
      this.webglRenderer = new WebGLIsoRenderer(this.canvas);
      this.webglRenderer.uploadMapData(this.mapManager.tileGrid, 幸福镇地图.width, 幸福镇地图.height, 幸福镇地图.buildings);
      console.log("[WebGL] 渲染器初始化成功");
      this.useWebGL = true;
    } catch (e) {
      console.warn("[WebGL] 初始化失败，回退到 Canvas2D:", e);
      this.useWebGL = false;
      this.ctx = this.canvas.getContext("2d")!;
    }
    
    // 加载独立道路网络
    this.loadRoadNetwork();
    this.perceptionSystem = new PerceptionSystem(this.mapManager);
    this.taskSystem = new TaskSystem(this.mapManager);
    this.dialogueSystem = new DialogueSystem();
    const moduleRegistry = createModuleRegistry();
    this.scriptEngine = new ScriptEngine(this.mapManager, this.taskSystem, this.dialogueSystem, moduleRegistry);
    this.brainEngine = new BrainEngine(moduleRegistry);
    this.worldDynamics = new WorldDynamics();
    this.spriteSheet = generateSampleSpriteSheet();
    this.loadScripts();
    this.setupCanvas();
    this.setupEvents();
    this.setupUI();
    this.createNpcs();
    this.initEnvironment();
    this.resetView();
    this.loop(0);
  }

  private initEnvironment(): void {
  }

  private async loadRoadNetwork(): Promise<void> {
    try {
      const response = await fetch('/data/maps/幸福镇_道路.json');
      if (response.ok) {
        const data = await response.json();
        this.mapManager.loadRoadNetworkFromJSON(data);
        console.log('道路网络加载成功:', data.paths.length, '条道路');
      } else {
        console.warn('道路数据文件未找到，使用默认道路');
        // 创建默认道路网络
        this.createDefaultRoadNetwork();
      }
    } catch (error) {
      console.warn('加载道路网络失败:', error);
      this.createDefaultRoadNetwork();
    }
  }

  private createDefaultRoadNetwork(): void {
    const network = this.mapManager.roadNetwork;
    // 主干道 - 横向
    network.createRoadFromLine('main_h', [0, 50], [100, 50], 48, 'dirt');
    // 主干道 - 纵向
    network.createRoadFromLine('main_v', [50, 0], [50, 100], 48, 'dirt');
    // 张文博家小路
    network.createRoadFromLine('to_yunfei', [30, 50], [30, 38], 32, 'dirt');
    // 李秀兰家小路
    network.createRoadFromLine('to_qilinlin', [60, 50], [60, 68], 32, 'dirt');
    // 商业街
    network.createRoadFromLine('commercial', [40, 30], [70, 30], 40, 'stone');
  }

  private loadScripts(): void {
    const merchantScripts: RoleScript[] = [
      { id: "wuping_daily", 角色: "周明哲", 商铺: "fruit_shop", 商铺位置: [35, 13], 活动范围: { 中心: [35, 13], 半径: 3 },
        行为状态机: { "开店准备": { id: "open", 触发条件: "未营业", 指令序列: [{ module: "move_to", params: { target: [35, 13] } }, { module: "open_shop", params: { shop_id: "fruit_shop", greeting: true } }, { module: "say_from_template", params: { template_id: "fruit_shop_open", duration: 3000 } }] },
          "营业中_门口招揽": { id: "attract", 触发条件: "营业中", 指令序列: [{ module: "move_in_area", params: { center: [35, 13], radius: 2, min_stay: 2000, max_stay: 4000 } }, { module: "attract_customer", params: { range: 10, template_id: "fruit_attract" } }, { module: "play_animation", params: { animation: "wave", duration: 1500 } }], 循环: true },
          "营业中_整理": { id: "work", 触发条件: "营业中 且 无顾客 且 概率0.3", 指令序列: [{ module: "play_animation", params: { animation: "sit", duration: 2000 } }, { module: "say_from_template", params: { template_id: "merchant_work", duration: 2500 } }] } } },
      { id: "yunxiang_daily", 角色: "陈晓燕", 商铺: "flower_shop", 商铺位置: [60, 13], 活动范围: { 中心: [60, 13], 半径: 3 },
        行为状态机: { "开店准备": { id: "open", 触发条件: "未营业", 指令序列: [{ module: "move_to", params: { target: [60, 13] } }, { module: "open_shop", params: { shop_id: "flower_shop", greeting: true } }, { module: "say_from_template", params: { template_id: "flower_shop_open", duration: 3000 } }] },
          "营业中_门口招揽": { id: "attract", 触发条件: "营业中", 指令序列: [{ module: "move_in_area", params: { center: [60, 13], radius: 2, min_stay: 2000, max_stay: 4000 } }, { module: "attract_customer", params: { range: 10, template_id: "flower_attract" } }], 循环: true },
          "营业中_浇花": { id: "care", 触发条件: "营业中 且 无顾客 且 概率0.4", 指令序列: [{ module: "play_animation", params: { animation: "sit", duration: 3000 } }, { module: "say_from_template", params: { template_id: "flower_care", duration: 2500 } }] } } },
      { id: "huqian_daily", 角色: "林玉芳", 商铺: "clothes_shop", 商铺位置: [47, 13], 活动范围: { 中心: [47, 13], 半径: 3 },
        行为状态机: { "开店准备": { id: "open", 触发条件: "未营业", 指令序列: [{ module: "move_to", params: { target: [47, 13] } }, { module: "open_shop", params: { shop_id: "clothes_shop", greeting: true } }, { module: "say_from_template", params: { template_id: "shop_open", duration: 3000 } }] },
          "营业中_门口招揽": { id: "attract", 触发条件: "营业中", 指令序列: [{ module: "move_in_area", params: { center: [47, 13], radius: 2, min_stay: 2000, max_stay: 4000 } }, { module: "attract_customer", params: { range: 10, template_id: "clothes_attract" } }, { module: "play_animation", params: { animation: "wave", duration: 1500 } }], 循环: true },
          "营业中_整理": { id: "work", 触发条件: "营业中 且 无顾客 且 概率0.3", 指令序列: [{ module: "play_animation", params: { animation: "sit", duration: 2000 } }, { module: "say_from_template", params: { template_id: "merchant_work", duration: 2500 } }] } } },
    ];
    for (const script of merchantScripts) this.scriptEngine.loadRoleScript(script);

    const templates = [
      { id: "merchant_greeting", 对话列表: ["欢迎光临！随便看看~", "客官，需要点什么？", "今天有新货，进来看看吧！"] },
      { id: "merchant_attract", 对话列表: ["走过路过不要错过！", "新鲜到货，便宜卖啦！", "这位客官，进来看看呗？"] },
      { id: "fruit_attract", 对话列表: ["新鲜的苹果，又大又甜！", "今天刚摘的水果，不来点？", "苹果便宜卖啦，十文三个！"] },
      { id: "flower_attract", 对话列表: ["漂亮的玫瑰花，送给心上人吧~", "今天的花特别新鲜，来看看？", "买束花吧，让生活更美好~"] },
      { id: "clothes_attract", 对话列表: ["新款到货，进来看看吧！", "这衣服可适合您了！", "今天打折，错过等一年！"] },
      { id: "shop_open", 对话列表: ["开门营业啦！", "新的一天，新的开始！", "小店开张，欢迎惠顾！"] },
      { id: "fruit_shop_open", 对话列表: ["水果摊开张！新鲜水果来啦！", "早起的鸟儿有虫吃，早起的客官有好果！", "今天的苹果特别甜！"] },
      { id: "flower_shop_open", 对话列表: ["花店开门啦，香气扑鼻~", "今天的玫瑰开得特别好~", "来买束花，让心情变好~"] },
      { id: "merchant_work", 对话列表: ["(整理货物)", "(擦拭柜台)", "(盘点库存)"] },
      { id: "flower_care", 对话列表: ["(浇花)", "(修剪枝叶)", "(整理花盆)"] },
    ];
    for (const template of templates) this.scriptEngine.loadDialogueTemplate(template);
    const npcDefs = NPCManager.loadAllNpcs();
    for (const npc of npcDefs) {
      if (npc.roleType === "merchant") this.scriptEngine.initNpc(npc.id, `${npc.id}_daily`);
    }
  }

  private setupCanvas(): void {
    const resize = () => {
      const rect = this.container.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.overlayCanvas.width = rect.width;
      this.overlayCanvas.height = rect.height;
    };
    resize(); window.addEventListener("resize", resize);
  }

  private setupEvents(): void {
    window.addEventListener("keydown", (e) => { this.keys.add(e.key.toLowerCase()); if (e.key === "Control") this.isCtrlPressed = true; if (e.key === " ") { e.preventDefault(); this.resetView(); } });
    window.addEventListener("keyup", (e) => { this.keys.delete(e.key.toLowerCase()); if (e.key === "Control") this.isCtrlPressed = false; });
    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      const clickedNpc = this.getNpcAtScreenPosition(mouseX, mouseY);
      if (clickedNpc) { this.selectNpc(clickedNpc); if (clickedNpc.data.controllable) this.playerNpc = clickedNpc; }
      else {
        if (this.selectedNpc?.data.controllable) {
          const worldPos = this.screenToWorld(mouseX, mouseY);
          const targetX = Math.floor(worldPos.x / 32); const targetY = Math.floor(worldPos.y / 32);
          if (this.mapManager.isPassable(targetX, targetY)) {
            const moveTask = this.taskSystem.createMoveTask(targetX, targetY, TaskPriority.HIGH, "player");
            this.taskSystem.assignTask(this.selectedNpc.data.id, moveTask);
          }
        }
        this.isDragging = true; this.lastMouseX = e.clientX; this.lastMouseY = e.clientY;
      }
    });
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
      this.hoveredNpc = this.getNpcAtScreenPosition(mouseX, mouseY);
      this.canvas.style.cursor = this.hoveredNpc ? "pointer" : this.isDragging ? "grabbing" : "grab";
      if (this.isDragging) {
        this.cameraX -= (e.clientX - this.lastMouseX) / this.zoom;
        this.cameraY -= (e.clientY - this.lastMouseY) / this.zoom;
        this.lastMouseX = e.clientX; this.lastMouseY = e.clientY; this.clampCamera();
      }
    });
    window.addEventListener("mouseup", () => { this.isDragging = false; });
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.isCtrlPressed) {
        const zoomSpeed = 0.1; const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - this.canvas.width / 2) / this.zoom + this.cameraX;
        const worldY = (mouseY - this.canvas.height / 2) / this.zoom + this.cameraY;
        this.zoom = newZoom;
        this.cameraX = worldX - (mouseX - this.canvas.width / 2) / this.zoom;
        this.cameraY = worldY - (mouseY - this.canvas.height / 2) / this.zoom;
        this.clampCamera(); this.updateZoomIndicator();
      } else { this.cameraY += e.deltaY / this.zoom; this.cameraX += e.deltaX / this.zoom; this.clampCamera(); }
    }, { passive: false });
  }

  private setupUI(): void {
    document.getElementById("btn-reset-view")!.addEventListener("click", () => this.resetView());
    document.getElementById("btn-full-map")!.addEventListener("click", () => this.showFullMap());

    // 相机方向按钮
    const camMoveSpeed = 80;
    document.getElementById("btn-cam-up")!.addEventListener("click", () => { this.cameraY -= camMoveSpeed; this.clampCamera(); });
    document.getElementById("btn-cam-down")!.addEventListener("click", () => { this.cameraY += camMoveSpeed; this.clampCamera(); });
    document.getElementById("btn-cam-left")!.addEventListener("click", () => { this.cameraX -= camMoveSpeed; this.clampCamera(); });
    document.getElementById("btn-cam-right")!.addEventListener("click", () => { this.cameraX += camMoveSpeed; this.clampCamera(); });

    const speedButtons = [
      { id: "btn-speed-1x", speed: 1 }, { id: "btn-speed-10x", speed: 10 },
      { id: "btn-speed-50x", speed: 50 }, { id: "btn-speed-max", speed: this.maxTimeScale },
    ];
    speedButtons.forEach(({ id, speed }) => {
      document.getElementById(id)!.addEventListener("click", (e) => { this.timeScale = speed; this.isPaused = false; this.updateTimeButtons(e.target as HTMLButtonElement); });
    });
    document.getElementById("btn-speed-pause")!.addEventListener("click", (e) => { this.isPaused = !this.isPaused; this.updateTimeButtons(e.target as HTMLButtonElement); });

    document.getElementById("btn-dawn")!.addEventListener("click", () => this.jumpToTime(5, 0));
    document.getElementById("btn-morning")!.addEventListener("click", () => this.jumpToTime(8, 0));
    document.getElementById("btn-noon")!.addEventListener("click", () => this.jumpToTime(12, 0));
    document.getElementById("btn-evening")!.addEventListener("click", () => this.jumpToTime(18, 0));
    document.getElementById("btn-next-day")!.addEventListener("click", () => this.jumpToNextDay());

    const weatherButtons: Array<{ id: string; type: WeatherType }> = [
      { id: "btn-weather-clear", type: "clear" },
      { id: "btn-weather-rain", type: "rain" },
      { id: "btn-weather-snow", type: "snow" },
      { id: "btn-weather-fog", type: "fog" },
      { id: "btn-weather-cloudy", type: "cloudy" },
      { id: "btn-weather-thunderstorm", type: "thunderstorm" },
      { id: "btn-weather-sandstorm", type: "sandstorm" },
      { id: "btn-weather-rainbow", type: "rainbow" },
      { id: "btn-weather-dusk_glow", type: "dusk_glow" },
      { id: "btn-weather-windy", type: "windy" },
    ];
    weatherButtons.forEach(({ id, type }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", () => {
          this.weatherSystem.setWeather(type, 0.6);
          this.updateWeatherDisplay();
        });
      }
    });

    this.updateTimeDisplay();
  }

  private updateTimeButtons(activeBtn: HTMLButtonElement): void {
    document.querySelectorAll("#sidebar-footer .btn").forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  private updateWeatherDisplay(): void {
    const label = this.weatherSystem.getCurrentLabel();
    const weatherEl = document.getElementById("current-weather");
    if (weatherEl) weatherEl.textContent = label;
  }

  private jumpToTime(hour: number, minute: number): void { this.gameHour = hour; this.gameMinute = minute; this.updateDayPhase(); this.updateTimeDisplay(); }
  private jumpToNextDay(): void { this.gameDay++; this.gameHour = 8; this.gameMinute = 0; this.updateDayPhase(); this.updateTimeDisplay(); }

  private updateGameTime(deltaMs: number): void {
    if (this.isPaused) return;
    this.timeAccumulator += deltaMs * this.timeScale * 0.001;
    while (this.timeAccumulator >= 1) {
      this.timeAccumulator -= 1; this.gameMinute++;
      if (this.gameMinute >= 60) { this.gameMinute = 0; this.gameHour++; if (this.gameHour >= 24) { this.gameHour = 0; this.gameDay++; } }
    }
    this.updateDayPhase();
    this.updateTimeDisplay();
    if (this.gameDay !== this.prevGameDay) {
      this.prevGameDay = this.gameDay;
      for (const npc of this.npcs) {
        this.worldDynamics.dailyReversion({
          id: npc.data.id,
          personality: npc.data.personality,
          rawData: npc.data.rawData,
        });
      }
    }
  }

  private updateDayPhase(): void {
    const hour = this.gameHour;
    if (hour >= 5 && hour < 7) { this.dayPhase = "dawn"; this.ambientLight = 0.5 + (hour - 5) * 0.25 + this.gameMinute / 60 * 0.25; }
    else if (hour >= 7 && hour < 18) { this.dayPhase = "day"; this.ambientLight = 1; }
    else if (hour >= 18 && hour < 20) { this.dayPhase = "dusk"; this.ambientLight = 1 - (hour - 18) * 0.3 - this.gameMinute / 60 * 0.3; }
    else { this.dayPhase = "night"; this.ambientLight = 0.4; }
  }

  private updateTimeDisplay(): void {
    const timeStr = `${this.gameHour.toString().padStart(2, "0")}:${this.gameMinute.toString().padStart(2, "0")}`;
    document.getElementById("game-time")!.textContent = timeStr;
    document.getElementById("game-day")!.textContent = ` 第${this.gameDay}天`;
    const phaseInfo = this.getPhaseInfo();
    document.getElementById("day-phase")!.innerHTML = `${phaseInfo.icon} ${phaseInfo.name}`;
  }

  private getPhaseInfo(): { icon: string; name: string } {
    switch (this.dayPhase) { case "dawn": return { icon: "🌅", name: "黎明" }; case "day": return { icon: "☀️", name: "白天" }; case "dusk": return { icon: "🌇", name: "黄昏" }; case "night": return { icon: "🌙", name: "夜晚" }; }
  }

  private updateZoomIndicator(): void { document.getElementById("zoom-indicator")!.textContent = `缩放: ${Math.round(this.zoom * 100)}%`; }

  private createNpcs(): void {
    const npcDefinitions = NPCManager.loadAllNpcs();
    console.log("创建NPC列表:", npcDefinitions.map(n => n.id).join(", "));
    this.npcs = npcDefinitions.map(data => new Npc(data, this.brainEngine, this.pathFinder));
    this.playerNpc = this.npcs.find(n => n.data.controllable) || null;
    for (const npc of this.npcs) {
      if (npc.data.roleType === "merchant") { npc.isShopOpen = true; npc.currentScriptAction = "营业中"; this.scriptEngine.setShopOpen(npc.data.id, true); }
    }
    this.updateSidebar();
  }

  private selectNpc(npc: Npc | null): void { this.selectedNpc = npc; this.updateSidebar(); }

  private getNpcAtScreenPosition(screenX: number, screenY: number): Npc | null {
    const worldPos = this.screenToWorld(screenX, screenY); const tileX = worldPos.x / 32; const tileY = worldPos.y / 32;
    for (const npc of this.npcs) { if (Math.sqrt(Math.pow(tileX - npc.x, 2) + Math.pow(tileY - npc.y, 2)) < 1.5) return npc; }
    return null;
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: (screenX - this.canvas.width / 2) / this.zoom + this.cameraX, y: (screenY - this.canvas.height / 2) / this.zoom + this.cameraY };
  }

  private updateSidebar(): void {
    const actionLabel = (npc: Npc): string => {
      if (npc.currentScriptAction) return npc.currentScriptAction;
      const bd = npc.brainDebug;
      if (bd?.中断原因) return `⚠️ ${bd.中断原因}`;
      if (bd?.当前目标) return `🎯 ${bd.当前目标.replace("action_", "")}`;
      if (bd?.当前欲望) return `💭 ${bd.当前欲望.replace("want_", "")}`;
      return "待机";
    };

    const stateInfo = (npc: Npc): string => {
      const parts: string[] = [];
      const s = npc.data.state;
      parts.push(`⚡${s.疲劳 ?? 3} 🍗${s.饥饿 ?? 5}`);
      if (npc.brainDebug?.计划步骤 != null && npc.brainDebug?.总步骤 > 0) {
        parts.push(`📋${npc.brainDebug.计划步骤}/${npc.brainDebug.总步骤}`);
      }
      return parts.join(" ");
    };

    let html = "";
    if (this.selectedNpc) {
      const npc = this.selectedNpc;
      html += `<div class="npc-card active" data-id="${npc.data.id}">
        <div class="npc-name" style="color: ${npc.data.color}">${npc.data.name}</div>
        <div class="npc-position">位置: (${Math.floor(npc.x)}, ${Math.floor(npc.y)}) | ${stateInfo(npc)}</div>
        <div class="npc-action">${actionLabel(npc)}</div>
        <div class="npc-traits" style="font-size:9px;color:#999;margin-top:6px">
          ${npc.brainDebug?.计划步骤 ? `步骤${npc.brainDebug.计划步骤}/${npc.brainDebug.总步骤}` : ''}
        </div>
        ${npc.data.roleType === "merchant" ? `<div style="margin-top:8px;color:${npc.isShopOpen ? '#4CAF50' : '#f44336'};font-size:11px;">${npc.isShopOpen ? '🟢 营业中' : '🔴 已关店'}</div>` : ''}
        ${npc.data.controllable ? '<div style="margin-top:8px;color:#4CAF50;font-size:11px;">✓ 可控制 (WASD)</div>' : ''}
      </div>`;
    }
    html += this.npcs.map(npc => {
      const isSelected = this.selectedNpc?.data.id === npc.data.id;
      return `<div class="npc-card ${isSelected ? 'active' : ''}" data-id="${npc.data.id}" style="cursor:pointer;">
        <div class="npc-name" style="color: ${npc.data.color}">${npc.data.name}</div>
        <div class="npc-position">${stateInfo(npc)}</div>
        <div class="npc-action">${actionLabel(npc)}</div>
      </div>`;
    }).join("");
    this.sidebar.innerHTML = html;
    this.sidebar.querySelectorAll(".npc-card").forEach(card => {
      card.addEventListener("click", () => { const id = (card as HTMLElement).dataset.id; const npc = this.npcs.find(n => n.data.id === id); if (npc) this.selectNpc(npc); });
    });
  }

  private resetView(): void { this.zoom = 1; this.cameraX = 幸福镇地图.width * 32 / 2; this.cameraY = 幸福镇地图.height * 32 / 2; this.updateZoomIndicator(); }
  private showFullMap(): void { const mapWidth = 幸福镇地图.width * 32; const mapHeight = 幸福镇地图.height * 32; const scaleX = this.canvas.width / mapWidth; const scaleY = this.canvas.height / mapHeight; this.zoom = Math.min(scaleX, scaleY) * 0.9; this.cameraX = mapWidth / 2; this.cameraY = mapHeight / 2; this.updateZoomIndicator(); }
  private clampCamera(): void { const mapWidth = 幸福镇地图.width * 32; const mapHeight = 幸福镇地图.height * 32; const viewWidth = this.canvas.width / this.zoom; const viewHeight = this.canvas.height / this.zoom; this.cameraX = Math.max(viewWidth / 2, Math.min(mapWidth - viewWidth / 2, this.cameraX)); this.cameraY = Math.max(viewHeight / 2, Math.min(mapHeight - viewHeight / 2, this.cameraY)); }

  private updatePlayer(): void {
    if (!this.playerNpc) return;
    let dx = 0, dy = 0;
    if (this.keys.has("w")) dy = -1; if (this.keys.has("s")) dy = 1; if (this.keys.has("a")) dx = -1; if (this.keys.has("d")) dx = 1;
    if (dx !== 0 || dy !== 0) {
      const newX = this.playerNpc.x + dx * 0.1; const newY = this.playerNpc.y + dy * 0.1;
      if (this.mapManager.isPassable(Math.floor(newX), Math.floor(newY))) { this.playerNpc.x = newX; this.playerNpc.y = newY; }
    }
  }

  // ==================== 渲染系统 ====================

  // ==================== 2.5D等距渲染系统 ====================
  private draw(): void {
    const ctx = this.ctx; const cw = this.canvas.width; const ch = this.canvas.height;
    
    if (this.useWebGL) {
      this.webglRenderer.render(
        this.cameraX,
        this.cameraY,
        this.zoom,
        cw,
        ch
      );
      
      const oc = this.overlayCtx;
      oc.clearRect(0, 0, cw, ch);
      this.drawNPCsIso(oc);
      this.drawSelectionIso(oc);
      this.drawDialoguesIso(oc);
    } else {
      // 回退：Canvas2D 等距渲染
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, cw, ch);
      const shakeX = this.weatherSystem.screenShakeX;
      const shakeY = this.weatherSystem.screenShakeY;
      renderIsoMap(
        ctx,
        this.mapManager.tileGrid,
        幸福镇地图.width,
        幸福镇地图.height,
        幸福镇地图.buildings,
        this.zoom,
        this.cameraX + shakeX,
        this.cameraY + shakeY,
        cw,
        ch
      );
      ctx.save();
      this.drawNPCsIso(ctx);
      this.drawSelectionIso(ctx);
      this.drawDialoguesIso(ctx);
      ctx.restore();
    }
    
    this.drawFPS(this.useWebGL ? this.overlayCtx : ctx);
  }

  // 等距视角NPC绘制
  private drawNPCsIso(ctx: CanvasRenderingContext2D): void {
    for (const npc of this.npcs) {
      const [ix, iy] = gridToIso(npc.x, npc.y);
      const screenX = (ix - this.cameraX) * this.zoom + this.canvas.width / 2;
      const screenY = (iy - this.cameraY) * this.zoom + this.canvas.height / 2;
      
      // 简化的等距NPC - 圆形身体 + 头部
      const size = 8 * this.zoom;
      
      // 阴影
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + size * 0.5, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 身体
      ctx.fillStyle = npc.data.color || "#8B4513";
      ctx.beginPath();
      ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
      ctx.fill();
      
      // 头部
      ctx.fillStyle = "#FFDBAC";
      ctx.beginPath();
      ctx.arc(screenX, screenY - size * 0.6, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      // 名字
      if (this.zoom > 0.5) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(8, 9 * this.zoom)}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 2;
        ctx.fillText(npc.data.name, screenX, screenY - size * 1.8);
        ctx.shadowBlur = 0;
      }
    }
  }

  // 等距视角选择框
  private drawSelectionIso(ctx: CanvasRenderingContext2D): void {
    if (!this.selectedNpc) return;
    const npc = this.selectedNpc;
    const [ix, iy] = gridToIso(npc.x, npc.y);
    const screenX = (ix - this.cameraX) * this.zoom + this.canvas.width / 2;
    const screenY = (iy - this.cameraY) * this.zoom + this.canvas.height / 2;
    
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 16 * this.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 215, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(screenX, screenY, 16 * this.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // 等距视角对话气泡
  private drawDialoguesIso(ctx: CanvasRenderingContext2D): void {
    const allDialogues = this.dialogueSystem.getAllActiveDialogues();
    for (const [npcId, dialogues] of allDialogues) {
      const npc = this.npcs.find(n => n.data.id === npcId);
      if (!npc || dialogues.length === 0) continue;
      const dialogue = dialogues[0];
      const [ix, iy] = gridToIso(npc.x, npc.y);
      const screenX = (ix - this.cameraX) * this.zoom + this.canvas.width / 2;
      const screenY = (iy - this.cameraY) * this.zoom + this.canvas.height / 2;
      
      const text = dialogue.text;
      ctx.font = `bold 11px "Microsoft YaHei", sans-serif`;
      const textWidth = ctx.measureText(text).width;
      const padding = 6;
      const boxW = textWidth + padding * 2;
      const boxH = 20;
      const boxX = screenX - boxW / 2;
      const boxY = screenY - 35 * this.zoom;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(text, boxX + boxW / 2, boxY + 14);
    }
  }

  private applyWorldDynamics(npc: Npc, prevDebug: any): void {
    const currDebug = npc.brainDebug;
    if (!currDebug || !prevDebug) return;

    const prevPlanDone = prevDebug.计划步骤 > 0 && prevDebug.计划步骤 >= prevDebug.总步骤;
    const currPlanDone = currDebug.计划步骤 > 0 && currDebug.计划步骤 >= currDebug.总步骤;
    const justCompleted = !prevPlanDone && currPlanDone;

    if (!justCompleted) return;

    const targetId = currDebug.当前目标;
    if (!targetId) return;

    // 找目标 NPC
    const targetNpc = this.npcs.find(n => {
      const dbg = n.brainDebug;
      return dbg && dbg.当前目标 === targetId;
    });

    const actionId = targetId.replace(/_\d+$/, "");
    this.worldDynamics.onActionCompleted(
      { id: npc.data.id, personality: npc.data.personality, rawData: npc.data.rawData, brainDebug: npc.brainDebug },
      actionId,
      targetNpc ? { id: targetNpc.data.id, personality: targetNpc.data.personality, rawData: targetNpc.data.rawData } : undefined
    );
  }

  private drawFPS(ctx: CanvasRenderingContext2D): void {
    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(8, 8, 120, 38);
    ctx.fillStyle = "#0f0";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`FPS: ${this.fps} | #${this.frameCount}`, 14, 23);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px monospace";
    ctx.fillText(`weather: ${this.weatherSystem.getCurrentLabel()}`, 14, 40);
  }

  private loop(timestamp: number): void {
    const frameStart = Date.now();
    const deltaMs = this.lastFrameTimestamp ? timestamp - this.lastFrameTimestamp : 0;
    this.lastFrameTimestamp = timestamp;
    this.updateGameTime(deltaMs);
    this.updatePlayer();
    this.weatherSystem.update(deltaMs);
    this.particleSystem.update();
    if (this.frameCount % 6 === 0) {
      this.particleSystem.spawnAmbientParticles(幸福镇地图.width, 幸福镇地图.height);
    }
    for (const npc of this.npcs) {
      const prevDebug = npc.brainDebug;
      npc.update(timestamp, this.timeScale, this.mapManager, this.perceptionSystem, this.npcs, this.dialogueSystem, this.taskSystem, deltaMs, this.weatherSystem.currentWeather, this.scriptEngine);
      this.applyWorldDynamics(npc, prevDebug);
    }
    this.draw();
    const frameCost = Date.now() - frameStart;
    if (frameCost > 100) {
      console.warn("Frame too slow:", frameCost, "ms, recovering...");
      setTimeout(() => requestAnimationFrame((t) => this.loop(t)), 50);
    } else {
      requestAnimationFrame((t) => this.loop(t));
    }
  }
}

// ==================== 启动游戏 ====================
window.addEventListener("DOMContentLoaded", () => {
  new Game();
});
