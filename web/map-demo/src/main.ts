/**
 * 幸福镇 - NPC大脑决策系统演示
 * 俯视角像素艺术风格，顶级商业化品质
 */

import { BrainDecisionEngine, type ActionScore } from "./brain/decisionEngine";
import { generateSampleSpriteSheet, getFrameFromSpriteSheet, type Facing, type AnimationState } from "./npc/spriteSheetGenerator";
import { MapManager, 幸福镇地图, type BuildingDef } from "./world/mapData";
import { PerceptionSystem, type Perceivable, type PerceptionResult } from "./systems/perception";
import { TaskSystem, TaskType, TaskPriority, type Task } from "./systems/taskSystem";
import { DialogueSystem, DialogueType, type Dialogue } from "./systems/dialogue";
import { ScriptEngine, type RoleScript, type ScriptModule } from "./systems/scriptEngine";
import { NPCManager } from "./engine/NPCManager";
import type { NpcDefinition } from "./engine/npcDefinition";
import { BrainEngine, type BrainOutput, type PerceptionSnapshot } from "./engine/BrainEngine";
import { createModuleRegistry } from "./engine/ModuleFactory";
import { WorldDynamics } from "./engine/WorldDynamics";
import { PathFinder } from "./engine/PathFinder";
import {
  bakeFullMapCanvas,
  drawWaterAnimation as drawWaterAnimLayer,
  drawPlazaPaving,
} from "./render/mapVisuals";

// ==================== 工具函数 ====================
function adjustColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// NPC数据由NPCManager从 npc/ 文件夹自动加载

// ==================== NPC类 ====================
class Npc {
  x: number; y: number;
  targetX: number | null = null; targetY: number | null = null;
  isMoving = false; facing: Facing = "down"; animState: AnimationState = "idle";
  walkFrame = 0; lastWalkTime = 0; lastDecisionTime = 0;
  currentDecision: ActionScore | null = null; currentTask: Task | null = null;
  perceptionResult: PerceptionResult | null = null;
  isShopOpen = false; lastScriptExecution = 0; currentScriptAction: string | null = null;
  brainDebug: any = null;
  private pathQueue: [number, number][] = [];

  constructor(public data: NpcDefinition, private engine: BrainDecisionEngine, private brainEngine: BrainEngine, private pathFinder: PathFinder) {
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

  private makeDecision(now: number, dialogueSystem: DialogueSystem, taskSystem: TaskSystem): void {
    const npcData = { 性格: this.data.personality, 生理状态: this.data.state, 当前状态: this.isMoving ? "移动" : "空闲" };
    const environment = { 可见目标: this.perceptionResult?.visual.map(v => ({ 外貌: v.visual?.颜值 || 5, 名称: v.id })) || [] };
    this.currentDecision = this.engine.decideAction(npcData, environment);

    if (this.perceptionResult) {
      for (const target of this.perceptionResult.visual) {
        const targetBeauty = target.visual?.颜值 || 5; const myLust = this.data.personality.好色 || 5;
        if (myLust >= 6 && targetBeauty >= 7) {
          dialogueSystem.generatePerceptionDialogue("美貌", this.data.id, { id: target.id, name: target.id, visual: { 颜值: targetBeauty } });
          if (Math.random() < 0.3) { const pursueTask = taskSystem.createPursueTask(target.id, TaskPriority.HIGH, "self"); taskSystem.assignTask(this.data.id, pursueTask); }
        }
      }
    }
    if (this.currentDecision?.canExecute) dialogueSystem.generateDialogue(this.currentDecision.actionId, this.data.id, this.data.personality);
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

    // 当前动作 → animState
    if (key === "当前动作") {
      if (value === "eating" || value === "sleeping" || value === "idle" || value === "walk") {
        this.animState = value as AnimationState;
      }
      return;
    }

    // 金钱
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

    // 物品栏 addItem / removeItem
    if (key === "物品栏") {
      const raw = this.data.rawData || {};
      const items = raw.物品栏 || [];
      if (operation === "addItem") {
        const existing = items.find(i => i.名称 === value);
        if (existing) {
          existing.数量 = (existing.数量 || 1) + 1;
        } else {
          items.push({ 物品id: "generated_" + value, 名称: value, 数量: 1, 类型: "杂项" });
        }
        raw.物品栏 = items;
      } else if (operation === "removeItem") {
        raw.物品栏 = items.filter(i => i.名称 !== value);
      }
      return;
    }

    // 生理状态 (饥饿/疲劳/开心/愤怒/生病/精力 等)
    const state = this.data.state;
    if (state && key in state) {
      if (operation === "add") {
        state[key] = Math.max(0, Math.min(10, (state[key] || 0) + Number(value)));
      } else {
        state[key] = Math.max(0, Math.min(10, Number(value)));
      }
      return;
    }

    // dot-path 兜底: "生理状态.饥饿" → state.饥饿
    if (key.includes(".")) {
      const parts = key.split(".");
      if (parts[0] === "生理状态" && state && parts[1] in state) {
        if (operation === "add") {
          state[parts[1]] = Math.max(0, Math.min(10, (state[parts[1]] || 0) + Number(value)));
        } else {
          state[parts[1]] = Math.max(0, Math.min(10, Number(value)));
        }
        return;
      }
    }

    // 记忆标签
    if (key === "记忆标签") {
      const raw = this.data.rawData || {};
      if (!raw.记忆标签) raw.记忆标签 = [];
      if (operation === "add" && !raw.记忆标签.includes(value)) {
        raw.记忆标签.push(value);
      } else if (operation === "remove") {
        raw.记忆标签 = raw.记忆标签.filter(t => t !== value);
      }
      return;
    }
  }

  draw(ctx: CanvasRenderingContext2D, spriteSheet: HTMLCanvasElement, scale: number): void {
    const screenX = this.x * 32; const screenY = this.y * 32; const size = 32;
    const bobOffset = this.isMoving ? Math.sin(Date.now() / 100) * 2 : 0;

    // 俯视角椭圆阴影
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(screenX + size / 2, screenY + size * 0.75, size * 0.3, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    if (scale > 0.5) {
      // 使用角色个性化颜色绘制俯视角角色
      this.drawTopDownCharacter(ctx, screenX, screenY + bobOffset, size, scale);
    } else {
      // 远距离简化显示
      ctx.fillStyle = this.data.color;
      ctx.beginPath();
      ctx.arc(screenX + size / 2, screenY + size / 2, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // 商人状态指示器
    if (this.data.roleType === "merchant" && scale > 0.8) {
      const indicatorColor = this.isShopOpen ? "#4CAF50" : "#f44336";
      ctx.fillStyle = indicatorColor;
      ctx.beginPath();
      ctx.arc(screenX + size * 0.85, screenY - size * 0.05, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 名字标签（带背景）
    if (scale > 0.8) {
      const name = this.data.name;
      ctx.font = `bold ${Math.max(9, 11)}px "Microsoft YaHei", sans-serif`;
      const textWidth = ctx.measureText(name).width;
      const padding = 4;
      const boxW = textWidth + padding * 2;
      const boxH = 16;
      const boxX = screenX + size / 2 - boxW / 2;
      const boxY = screenY - 22;

      // 名字背景
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();

      // 名字文字
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, screenX + size / 2, boxY + boxH / 2 + 1);

      // 商人状态文字
      if (this.data.roleType === "merchant") {
        ctx.fillStyle = this.isShopOpen ? "#90EE90" : "#FFB6C1";
        ctx.font = `9px sans-serif`;
        ctx.fillText(this.isShopOpen ? "营业中" : "已关店", screenX + size / 2, boxY - 6);
      }
    }
  }

  private drawTopDownCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, scale: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const baseColor = this.data.color;
    const darkColor = adjustColor(baseColor, -30);
    const lightColor = adjustColor(baseColor, 20);

    // 身体（俯视角圆形）
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, size * 0.22, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体阴影
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 3, size * 0.18, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头部（俯视角圆形）
    ctx.fillStyle = "#f5d0b0";
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // 头发
    ctx.fillStyle = "#4a3728";
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.14, size * 0.16, Math.PI, Math.PI * 2);
    ctx.fill();

    // 头发细节
    ctx.fillStyle = "#3d2e1f";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - size * 0.12, size * 0.1, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // 朝向指示（小箭头）
    let dirX = 0, dirY = 0;
    switch (this.facing) {
      case "up": dirY = -1; break;
      case "down": dirY = 1; break;
      case "left": dirX = -1; break;
      case "right": dirX = 1; break;
    }
    if (dirX !== 0 || dirY !== 0) {
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.arc(cx + dirX * size * 0.08, cy - size * 0.12 + dirY * size * 0.08, size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    // 行走动画 - 手臂摆动
    if (this.isMoving) {
      const armSwing = Math.sin(Date.now() / 120) * 3;
      ctx.fillStyle = lightColor;
      ctx.fillRect(cx - size * 0.22, cy + armSwing, size * 0.06, size * 0.15);
      ctx.fillRect(cx + size * 0.16, cy - armSwing, size * 0.06, size * 0.15);
    }

    // 角色职业标识
    if (this.data.roleType === "merchant") {
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(cx + size * 0.15, cy - size * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.data.roleType === "farmer") {
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(cx - size * 0.2, cy - size * 0.25, 8, 2);
    }
  }
}

// ==================== 天气系统 ====================
type WeatherType = "clear" | "rain" | "snow" | "fog" | "cloudy" | "thunderstorm" | "sandstorm" | "rainbow" | "dusk_glow" | "windy";

interface WeatherConfig {
  label: string;
  emoji: string;
  particleCount: number;
  overlayColor: string;
  overlayAlpha: number;
  hasLightning?: boolean;
  hasRainbow?: boolean;
  windStrength?: number;
  cloudTintR?: number;
  cloudTintG?: number;
  cloudTintB?: number;
  cloudAlphaMult?: number;
  cloudDensityMult?: number;
}

const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear: { label: "晴天", emoji: "☀️", particleCount: 0, overlayColor: "255,255,255", overlayAlpha: 0, cloudTintR: 1.0, cloudTintG: 1.0, cloudTintB: 1.0, cloudAlphaMult: 1.0, cloudDensityMult: 1.0 },
  rain: { label: "雨天", emoji: "🌧️", particleCount: 200, overlayColor: "60,70,90", overlayAlpha: 0.15, cloudTintR: 0.5, cloudTintG: 0.5, cloudTintB: 0.55, cloudAlphaMult: 0.8, cloudDensityMult: 1.3 },
  snow: { label: "雪天", emoji: "❄️", particleCount: 150, overlayColor: "220,230,240", overlayAlpha: 0.1, cloudTintR: 0.7, cloudTintG: 0.7, cloudTintB: 0.75, cloudAlphaMult: 0.9, cloudDensityMult: 1.5 },
  fog: { label: "雾天", emoji: "🌫️", particleCount: 0, overlayColor: "200,210,220", overlayAlpha: 0.4, cloudTintR: 0.6, cloudTintG: 0.6, cloudTintB: 0.65, cloudAlphaMult: 0.3, cloudDensityMult: 0.6 },
  cloudy: { label: "阴天", emoji: "☁️", particleCount: 0, overlayColor: "150,160,170", overlayAlpha: 0.2, cloudTintR: 0.45, cloudTintG: 0.45, cloudTintB: 0.5, cloudAlphaMult: 0.9, cloudDensityMult: 1.6 },
  thunderstorm: { label: "雷暴", emoji: "⛈️", particleCount: 250, overlayColor: "30,30,40", overlayAlpha: 0.35, hasLightning: true, cloudTintR: 0.2, cloudTintG: 0.2, cloudTintB: 0.25, cloudAlphaMult: 0.95, cloudDensityMult: 2.0 },
  sandstorm: { label: "沙尘", emoji: "🌪️", particleCount: 300, overlayColor: "194,178,128", overlayAlpha: 0.45, windStrength: 3, cloudTintR: 0.5, cloudTintG: 0.45, cloudTintB: 0.35, cloudAlphaMult: 0.4, cloudDensityMult: 0.5 },
  rainbow: { label: "彩虹", emoji: "🌈", particleCount: 40, overlayColor: "200,220,255", overlayAlpha: 0.05, hasRainbow: true, cloudTintR: 1.0, cloudTintG: 1.0, cloudTintB: 1.0, cloudAlphaMult: 0.7, cloudDensityMult: 0.6 },
  dusk_glow: { label: "晚霞", emoji: "🌅", particleCount: 25, overlayColor: "255,140,100", overlayAlpha: 0.15, cloudTintR: 1.0, cloudTintG: 0.7, cloudTintB: 0.5, cloudAlphaMult: 0.6, cloudDensityMult: 0.8 },
  windy: { label: "大风", emoji: "💨", particleCount: 100, overlayColor: "180,190,200", overlayAlpha: 0.1, windStrength: 2, cloudTintR: 0.7, cloudTintG: 0.7, cloudTintB: 0.75, cloudAlphaMult: 0.5, cloudDensityMult: 0.7 },
};

interface WeatherParticle {
  x: number; y: number; speed: number; size: number; opacity: number; drift: number;
  type: "rain" | "snow" | "sand" | "leaf" | "petal" | "sparkle" | "splash" | "puddle_glint" | "fog_blob" | "wind_line";
  rotation: number;
  rotSpeed: number;
  life?: number;
  maxLife?: number;
}

interface LightningBolt {
  x: number; y: number; segments: Array<{ x: number; y: number }>;
  life: number; maxLife: number; width: number;
}

class WeatherSystem {
  currentWeather: WeatherType = "clear";
  targetWeather: WeatherType = "clear";
  intensity = 0.5;
  transitionProgress = 1;
  isTransitioning = false;
  particles: WeatherParticle[] = [];
  screenShakeX = 0;
  screenShakeY = 0;
  private windX = 0;
  private lightningBolts: LightningBolt[] = [];
  private lightningTimer = 0;
  private nextLightningTime = Math.random() * 3000 + 2000;
  private rainbowPhase = 0;
  private fogBlobs: WeatherParticle[] = [];
  private puddleGlints: WeatherParticle[] = [];
  private shakeDecayX = 0;
  private shakeDecayY = 0;
  /** 主天气粒子数（避免每帧 filter 全数组） */
  private mainParticleCount = 0;
  private windLineCount = 0;

  setWeather(type: WeatherType, intensity = 0.5): void {
    if (type === this.currentWeather) return;
    if (this.isTransitioning && type === this.targetWeather) return;
    this.targetWeather = type;
    this.intensity = Math.max(0.1, Math.min(1, intensity));
    this.isTransitioning = true;
    this.transitionProgress = 0;
  }

  private finishTransition(): void {
    this.currentWeather = this.targetWeather;
    this.isTransitioning = false;
    this.transitionProgress = 1;
    this.lightningBolts = [];
  }

  private createParticle(weather: WeatherType): WeatherParticle {
    const w = 幸福镇地图.width * 32;
    const config = WEATHER_CONFIGS[weather];
    let type: WeatherParticle["type"] = "rain";
    let speed = 3;
    let size = 1;
    let drift = 0;

    switch (weather) {
      case "rain":
      case "thunderstorm":
        type = "rain";
        speed = 4 + Math.random() * 5;
        size = 1 + Math.random() * 1.5;
        drift = (Math.random() - 0.5) * 0.8 + (config.windStrength || 0) * 0.6;
        break;
      case "snow":
        type = "snow";
        speed = 0.5 + Math.random() * 1.5;
        size = 2 + Math.random() * 3;
        drift = (Math.random() - 0.5) * 1.5 + (config.windStrength || 0) * 0.5;
        break;
      case "sandstorm":
        type = "sand";
        speed = 1 + Math.random() * 2;
        size = 1 + Math.random() * 2;
        drift = (config.windStrength || 2) + Math.random() * 2;
        break;
      case "windy": {
        const types: WeatherParticle["type"][] = ["leaf", "petal", "sparkle"];
        type = types[Math.floor(Math.random() * types.length)];
        speed = 0.3 + Math.random() * 1;
        size = 2 + Math.random() * 3;
        drift = (config.windStrength || 1) + Math.random() * 3;
        break;
      }
      case "dusk_glow":
        type = "sparkle";
        speed = 0.2 + Math.random() * 0.5;
        size = 1 + Math.random() * 2;
        drift = (Math.random() - 0.5) * 0.3;
        break;
      case "rainbow":
        type = "sparkle";
        speed = 0.1 + Math.random() * 0.3;
        size = 1.5 + Math.random() * 2;
        drift = (Math.random() - 0.5) * 0.2;
        break;
      default:
        type = "sparkle";
        speed = 0.1;
        size = 1;
        drift = 0;
    }

    return {
      x: Math.random() * w,
      y: -10 - Math.random() * 50,
      speed,
      size,
      opacity: 0.3 + Math.random() * 0.5,
      drift,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
    };
  }

  private createSplash(x: number, y: number): WeatherParticle {
    return {
      x, y, speed: 0, size: 2 + Math.random() * 3,
      opacity: 0.6 + Math.random() * 0.3, drift: (Math.random() - 0.5) * 0.3,
      type: "splash", rotation: 0, rotSpeed: 0,
      life: 200 + Math.random() * 300, maxLife: 500,
    };
  }

  private createPuddleGlint(x: number, y: number): WeatherParticle {
    return {
      x, y, speed: 0, size: 3 + Math.random() * 5,
      opacity: 0, drift: 0,
      type: "puddle_glint", rotation: Math.random() * Math.PI * 2, rotSpeed: 0.02 + Math.random() * 0.03,
      life: 1500 + Math.random() * 3000, maxLife: 4500,
    };
  }

  private spawnLightning(): void {
    const w = 幸福镇地图.width * 32;
    const startX = Math.random() * w;
    const segments: Array<{ x: number; y: number }> = [{ x: startX, y: 0 }];
    let cx = startX;
    let cy = 0;
    let safety = 0;
    while (cy < 幸福镇地图.height * 32 && safety < 200) {
      cx += (Math.random() - 0.5) * 60;
      cy += 20 + Math.random() * 40;
      segments.push({ x: cx, y: cy });
      safety++;
    }
    this.lightningBolts.push({
      x: startX, y: 0, segments,
      life: 200, maxLife: 200, width: 2 + Math.random() * 3,
    });
    this.screenShakeX = (Math.random() - 0.5) * 8;
    this.screenShakeY = (Math.random() - 0.5) * 8;
    this.shakeDecayX = this.screenShakeX;
    this.shakeDecayY = this.screenShakeY;
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, 50);

    if (this.isTransitioning) {
      this.transitionProgress += dt / 1200;
      if (this.transitionProgress >= 1) {
        this.finishTransition();
      }
    }

    const currentConfig = WEATHER_CONFIGS[this.currentWeather];
    const targetConfig = WEATHER_CONFIGS[this.targetWeather];

    const targetWind = targetConfig.windStrength || 0;
    const currentWind = currentConfig.windStrength || 0;
    const effectiveWind = this.isTransitioning
      ? lerp(currentWind, targetWind, this.transitionProgress)
      : targetWind;
    this.windX += (effectiveWind - this.windX) * 0.03;

    if (targetConfig.hasLightning && (!this.isTransitioning || this.transitionProgress > 0.3)) {
      this.lightningTimer += dt;
      if (this.lightningTimer >= this.nextLightningTime) {
        this.spawnLightning();
        this.lightningTimer = 0;
        this.nextLightningTime = Math.random() * 4000 + 1500;
      }
    }

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      this.lightningBolts[i].life -= dt;
      if (this.lightningBolts[i].life <= 0) {
        this.lightningBolts.splice(i, 1);
      }
    }

    // 屏幕震动衰减
    if (Math.abs(this.shakeDecayX) > 0.1 || Math.abs(this.shakeDecayY) > 0.1) {
      this.screenShakeX = -this.shakeDecayX * 0.5;
      this.screenShakeY = -this.shakeDecayY * 0.5;
      this.shakeDecayX *= 0.85;
      this.shakeDecayY *= 0.85;
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
      this.shakeDecayX = 0;
      this.shakeDecayY = 0;
    }

    if (targetConfig.hasRainbow && (!this.isTransitioning || this.transitionProgress > 0.2)) {
      this.rainbowPhase += dt * 0.001;
    }

    const w = 幸福镇地图.width * 32;
    const h = 幸福镇地图.height * 32;
    const currentWeatherIsRain = this.currentWeather === "rain" || this.currentWeather === "thunderstorm";
    const targetWeatherIsRain = this.targetWeather === "rain" || this.targetWeather === "thunderstorm";
    const rainIntensity = this.isTransitioning
      ? (currentWeatherIsRain ? currentConfig.particleCount * (1 - this.transitionProgress) : 0)
        + (targetWeatherIsRain ? targetConfig.particleCount * this.transitionProgress : 0)
      : (currentWeatherIsRain ? currentConfig.particleCount : 0);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.y += p.speed * (dt / 16);
      p.x += p.drift + this.windX;
      p.rotation += p.rotSpeed * (dt / 16);

      if (p.type === "splash") {
        p.life = (p.life || 0) - dt;
        if ((p.life || 0) <= 0) { this.removeWeatherParticle(i); continue; }
        continue;
      }
      if (p.type === "puddle_glint") {
        p.life = (p.life || 0) - dt;
        p.opacity = 0.15 + Math.sin((p.maxLife || 0) * 0.003 + p.rotation) * 0.1;
        if ((p.life || 0) <= 0) { this.removeWeatherParticle(i); continue; }
        continue;
      }
      if (p.type === "fog_blob") {
        if (p.x > w + 200) p.x = -200;
        if (p.x < -200) p.x = w + 200;
        if (p.y > h + 200) p.y = -200;
        if (p.y < -200) p.y = h + 200;
        continue;
      }
      if (p.type === "wind_line") {
        p.x += p.drift * (dt / 16) + this.windX * 2;
        if (p.x > w + 100 || p.x < -100) { this.removeWeatherParticle(i); continue; }
        continue;
      }

      if (p.y > h + 20 || p.x < -50 || p.x > w + 50) {
        if (p.type === "rain" && p.y > h + 20 && rainIntensity > 50) {
          this.particles.push(this.createSplash(p.x - this.windX, h - Math.random() * 5));
          if (Math.random() < 0.15 && this.puddleGlints.length < 40) {
            this.puddleGlints.push(this.createPuddleGlint(p.x - this.windX, h - Math.random() * 5));
          }
        }
        this.removeWeatherParticle(i);
      }
    }

    // 更新雾团
    const isFog = targetConfig.overlayAlpha > 0.15 && targetConfig.particleCount === 0
      && targetConfig.hasLightning !== true && targetConfig.hasRainbow !== true && targetConfig.windStrength === undefined;
    const fogActive = this.isTransitioning
      ? (this.transitionProgress > 0.3 && isFog)
      : isFog;
    const fogTargetCount = fogActive ? 15 : 0;
    while (this.fogBlobs.length < fogTargetCount) {
      this.fogBlobs.push({
        x: Math.random() * w, y: Math.random() * h,
        speed: 0.1 + Math.random() * 0.3, size: 60 + Math.random() * 100,
        opacity: 0.08 + Math.random() * 0.12, drift: 0.05 + Math.random() * 0.15,
        type: "fog_blob", rotation: Math.random() * Math.PI * 2, rotSpeed: 0,
      });
    }
    while (this.fogBlobs.length > fogTargetCount) this.fogBlobs.pop();
    for (const fb of this.fogBlobs) {
      fb.x += fb.drift * (dt / 16) + this.windX * 0.3;
      fb.y += Math.sin(fb.rotation + Date.now() * 0.0003) * 0.3;
      fb.rotation += 0.002;
    }

    // 更新水洼光点
    for (let i = this.puddleGlints.length - 1; i >= 0; i--) {
      const pg = this.puddleGlints[i];
      pg.life = (pg.life || 0) - dt;
      pg.opacity = 0.05 + Math.sin((pg.maxLife || 0) * 0.005 + pg.rotation) * 0.08;
      if ((pg.life || 0) <= 0) { this.puddleGlints.splice(i, 1); }
    }

    const windLineTarget = effectiveWind > 1 ? Math.floor(effectiveWind * 3) : 0;
    while (this.windLineCount < windLineTarget) {
      this.particles.push({
        x: Math.random() * w, y: Math.random() * h,
        speed: 0, size: 20 + Math.random() * 30, opacity: 0.15 + Math.random() * 0.1,
        drift: -effectiveWind * 3 - Math.random() * 2, type: "wind_line",
        rotation: 0, rotSpeed: 0, life: 800 + Math.random() * 1200, maxLife: 2000,
      });
      this.windLineCount++;
    }

    let targetCount = 0;
    if (this.isTransitioning) {
      const startCount = Math.floor(currentConfig.particleCount * this.intensity);
      const endCount = Math.floor(targetConfig.particleCount * this.intensity);
      targetCount = Math.floor(lerp(startCount, endCount, this.transitionProgress));
    } else {
      targetCount = Math.floor(targetConfig.particleCount * this.intensity);
    }

    const spawnWeather = this.isTransitioning ? this.targetWeather : this.currentWeather;
    const maxSpawnPerFrame = 5;
    let spawned = 0;
    while (this.mainParticleCount < targetCount && spawned < maxSpawnPerFrame) {
      this.particles.push(this.createParticle(spawnWeather));
      this.mainParticleCount++;
      spawned++;
    }
  }

  private removeWeatherParticle(index: number): void {
    const p = this.particles[index];
    if (p.type === "wind_line") this.windLineCount--;
    else if (p.type !== "splash" && p.type !== "puddle_glint" && p.type !== "fog_blob") {
      this.mainParticleCount--;
    }
    this.particles.splice(index, 1);
  }

  draw(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    const currentConfig = WEATHER_CONFIGS[this.currentWeather];
    const targetConfig = WEATHER_CONFIGS[this.targetWeather];

    let overlayR = 0; let overlayG = 0; let overlayB = 0; let overlayA = 0;
    if (this.isTransitioning) {
      const t = this.transitionProgress;
      const [cr, cg, cb] = currentConfig.overlayColor.split(",").map(Number);
      const [tr, tg, tb] = targetConfig.overlayColor.split(",").map(Number);
      overlayR = lerp(cr, tr, t); overlayG = lerp(cg, tg, t); overlayB = lerp(cb, tb, t);
      overlayA = lerp(currentConfig.overlayAlpha, targetConfig.overlayAlpha, t);
    } else {
      const [r, g, b] = currentConfig.overlayColor.split(",").map(Number);
      overlayR = r; overlayG = g; overlayB = b; overlayA = currentConfig.overlayAlpha;
    }

    if (overlayA > 0.005) {
      ctx.fillStyle = `rgba(${Math.round(overlayR)},${Math.round(overlayG)},${Math.round(overlayB)},${overlayA})`;
      ctx.fillRect(viewX, viewY, viewW, viewH);
    }

    // 绘制雾团
    for (const fb of this.fogBlobs) {
      if (fb.x < viewX - 100 || fb.x > viewX + viewW + 100 || fb.y < viewY - 100 || fb.y > viewY + viewH + 100) continue;
      const gradient = ctx.createRadialGradient(fb.x, fb.y, 0, fb.x, fb.y, fb.size);
      gradient.addColorStop(0, `rgba(200,210,220,${fb.opacity})`);
      gradient.addColorStop(0.5, `rgba(190,200,210,${fb.opacity * 0.7})`);
      gradient.addColorStop(1, `rgba(180,190,200,0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2); ctx.fill();
    }

    // 绘制水洼光点
    for (const pg of this.puddleGlints) {
      if (pg.x < viewX - 20 || pg.x > viewX + viewW + 20 || pg.y < viewY - 20 || pg.y > viewY + viewH + 20) continue;
      ctx.strokeStyle = `rgba(150,180,220,${pg.opacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pg.x, pg.y, pg.size, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(180,210,255,${pg.opacity * 0.4})`;
      ctx.fill();
    }

    if (targetConfig.hasRainbow && (!this.isTransitioning || this.transitionProgress > 0.15)) {
      const rainbowAlpha = this.isTransitioning ? Math.max(0, (this.transitionProgress - 0.15) / 0.85) : 1;
      ctx.save(); ctx.globalAlpha = rainbowAlpha;
      this.drawRainbow(ctx, viewX, viewY, viewW, viewH);
      ctx.restore();
    }

    for (const p of this.particles) {
      if (p.x < viewX - 80 || p.x > viewX + viewW + 80 || p.y < viewY - 80 || p.y > viewY + viewH + 80) continue;
      ctx.globalAlpha = p.opacity;
      switch (p.type) {
        case "rain":
          ctx.strokeStyle = "rgba(180, 200, 220, 0.6)";
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + this.windX * 2, p.y + p.speed * 2); ctx.stroke();
          break;
        case "snow":
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
          break;
        case "sand":
          ctx.fillStyle = "rgba(194, 178, 128, 0.7)";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case "leaf":
          ctx.fillStyle = `rgba(${60 + Math.sin(p.rotation) * 40}, ${120 + Math.cos(p.rotation) * 30}, 30, 0.7)`;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          break;
        case "petal":
          ctx.fillStyle = `rgba(255, ${180 + Math.sin(p.rotation) * 40}, ${180 + Math.cos(p.rotation) * 40}, 0.6)`;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          break;
        case "sparkle":
          ctx.fillStyle = `rgba(255, 220, 150, ${0.5 + Math.sin(p.rotation * 3) * 0.3})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case "splash": {
          const lifeRatio = (p.life || 0) / (p.maxLife || 1);
          ctx.fillStyle = `rgba(180, 200, 230, ${lifeRatio * 0.4})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - lifeRatio), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(180, 200, 230, ${lifeRatio * 0.5})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - lifeRatio) * 1.5, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "wind_line":
          ctx.strokeStyle = `rgba(200, 210, 220, ${p.opacity})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.size, p.y); ctx.stroke();
          break;
      }
    }
    ctx.globalAlpha = 1;

    for (const bolt of this.lightningBolts) {
      const alpha = bolt.life / bolt.maxLife;
      ctx.strokeStyle = `rgba(255, 255, 240, ${alpha})`;
      ctx.lineWidth = bolt.width;
      ctx.shadowColor = "rgba(255, 255, 200, 0.8)";
      ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
      for (let i = 1; i < bolt.segments.length; i++) ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.15})`;
      ctx.fillRect(viewX, viewY, viewW, viewH);
    }
  }

  private drawRainbow(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    const centerX = viewX + viewW * 0.5;
    const centerY = viewY + viewH * 0.8;
    const radius = Math.min(viewW, viewH) * 0.6;
    const colors = [
      "rgba(255, 0, 0, 0.3)", "rgba(255, 127, 0, 0.3)", "rgba(255, 255, 0, 0.3)",
      "rgba(0, 255, 0, 0.3)", "rgba(0, 0, 255, 0.3)", "rgba(75, 0, 130, 0.3)", "rgba(148, 0, 211, 0.3)",
    ];
    const pulse = 0.9 + Math.sin(this.rainbowPhase) * 0.1;
    for (let i = 0; i < colors.length; i++) {
      const r = radius - i * 8;
      ctx.strokeStyle = colors[i].replace("0.3", (0.25 * pulse).toFixed(2));
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(centerX, centerY, r * pulse, Math.PI, 0); ctx.stroke();
    }
  }

  getCurrentLabel(): string {
    const config = WEATHER_CONFIGS[this.isTransitioning ? this.targetWeather : this.currentWeather];
    return `${config.emoji} ${config.label}`;
  }
}

// ==================== 粒子特效系统 ====================
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
  type: "sparkle" | "leaf" | "firefly" | "dust";
}

class ParticleSystem {
  particles: Particle[] = [];
  private maxParticles = 150;

  spawnParticle(x: number, y: number, type: Particle["type"]): void {
    if (this.particles.length >= this.maxParticles) return;

    const colors: Record<string, string[]> = {
      sparkle: ["#FFD700", "#FFF8DC", "#FFE4B5", "#FFEC8B"],
      leaf: ["#8B4513", "#D2691E", "#CD853F", "#DEB887", "#228B22"],
      firefly: ["#ADFF2F", "#7FFF00", "#9ACD32", "#32CD32"],
      dust: ["#F5F5DC", "#FFF8DC", "#FAEBD7", "#FFE4C4"],
    };

    const colorList = colors[type];
    const color = colorList[Math.floor(Math.random() * colorList.length)];

    let vx = 0, vy = 0, size = 2, life = 60;
    switch (type) {
      case "sparkle":
        vx = (Math.random() - 0.5) * 0.5;
        vy = -Math.random() * 0.5 - 0.2;
        size = 1 + Math.random() * 2;
        life = 30 + Math.random() * 30;
        break;
      case "leaf":
        vx = (Math.random() - 0.5) * 1.5;
        vy = Math.random() * 0.5 + 0.2;
        size = 2 + Math.random() * 3;
        life = 60 + Math.random() * 60;
        break;
      case "firefly":
        vx = (Math.random() - 0.5) * 0.8;
        vy = (Math.random() - 0.5) * 0.8;
        size = 2 + Math.random() * 2;
        life = 100 + Math.random() * 100;
        break;
      case "dust":
        vx = (Math.random() - 0.5) * 0.3;
        vy = -Math.random() * 0.2;
        size = 1 + Math.random() * 2;
        life = 40 + Math.random() * 40;
        break;
    }

    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, type });
  }

  update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.type === "leaf") {
        p.vx += Math.sin(Date.now() / 200 + p.y * 0.1) * 0.02;
      } else if (p.type === "firefly") {
        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    for (const p of this.particles) {
      if (p.x < viewX - 20 || p.x > viewX + viewW + 20 || p.y < viewY - 20 || p.y > viewY + viewH + 20) continue;

      const progress = p.life / p.maxLife;
      const alpha = progress < 0.3 ? progress / 0.3 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

      ctx.globalAlpha = alpha;

      if (p.type === "sparkle") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5 * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "leaf") {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() / 500 + p.x * 0.1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      } else if (p.type === "firefly") {
        const glow = Math.sin(Date.now() / 200 + p.x) * 0.5 + 0.5;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "dust") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  spawnAmbientParticles(mapWidth: number, mapHeight: number): void {
    const time = Date.now() / 1000;
    // 在树木附近生成落叶
    if (Math.random() < 0.3) {
      const x = Math.random() * mapWidth * 32;
      const y = Math.random() * mapHeight * 32;
      this.spawnParticle(x, y, "leaf");
    }
    // 夜晚生成萤火虫
    if (time % 24 > 18 || time % 24 < 6) {
      if (Math.random() < 0.2) {
        const x = Math.random() * mapWidth * 32;
        const y = Math.random() * mapHeight * 32;
        this.spawnParticle(x, y, "firefly");
      }
    }
    // 生成灰尘粒子
    if (Math.random() < 0.1) {
      const x = Math.random() * mapWidth * 32;
      const y = Math.random() * mapHeight * 32;
      this.spawnParticle(x, y, "dust");
    }
  }
}

// ==================== 游戏主类 ====================
class Game {
  private canvas!: HTMLCanvasElement; private ctx!: CanvasRenderingContext2D;
  private container!: HTMLElement; private sidebar!: HTMLElement;
  private mapManager!: MapManager; private perceptionSystem!: PerceptionSystem;
  private taskSystem!: TaskSystem; private dialogueSystem!: DialogueSystem;
  private engine!: BrainDecisionEngine; private scriptEngine!: ScriptEngine; private brainEngine!: BrainEngine;
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

  private clouds: Array<{
    x: number; y: number; speed: number; size: number; opacity: number;
    type: "cumulus" | "cirrus" | "stratus" | "cumulonimbus" | "altocumulus";
    color: string;
  }> = [];
  private birds: Array<{
    x: number; y: number; speed: number; wingPhase: number; size: number;
    type: "sparrow" | "swallow" | "eagle" | "crane" | "pigeon";
    color: string;
    wingSpeed: number;
    altitude: number;
  }> = [];
  private waterRipples: Array<{ x: number; y: number; time: number; maxRadius: number }> = [];

  private frameCount = 0; private lastFpsTime = 0; private fps = 0;
  private lastFrameTimestamp = 0;
  constructor() { this.init(); }

  private init(): void {
    this.canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.container = document.getElementById("map-container")!;
    this.sidebar = document.getElementById("npc-list")!;
    this.mapManager = new MapManager(幸福镇地图);
    this.mapManager.staticMapCanvas = bakeFullMapCanvas(
      this.mapManager.tileGrid,
      幸福镇地图.width,
      幸福镇地图.height,
      幸福镇地图.tileSize || 32
    );
    // 加载独立道路网络
    this.loadRoadNetwork();
    this.perceptionSystem = new PerceptionSystem(this.mapManager);
    this.taskSystem = new TaskSystem(this.mapManager);
    this.dialogueSystem = new DialogueSystem();
    this.engine = new BrainDecisionEngine();
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
    const mapWidth = 幸福镇地图.width * 32;
    const mapHeight = 幸福镇地图.height * 32;
    // 云朵均匀覆盖整张地图（俯视图天空层）
    const cloudTypes: Array<{ type: "cumulus" | "cirrus" | "stratus" | "cumulonimbus" | "altocumulus"; color: string; minSize: number; maxSize: number; minOpacity: number; maxOpacity: number; minSpeed: number; maxSpeed: number }> = [
      { type: "cumulus", color: "255,255,255", minSize: 0.4, maxSize: 0.9, minOpacity: 0.3, maxOpacity: 0.6, minSpeed: 0.08, maxSpeed: 0.18 },
      { type: "cirrus", color: "240,248,255", minSize: 0.2, maxSize: 0.5, minOpacity: 0.15, maxOpacity: 0.35, minSpeed: 0.15, maxSpeed: 0.3 },
      { type: "stratus", color: "220,220,230", minSize: 0.6, maxSize: 1.2, minOpacity: 0.2, maxOpacity: 0.4, minSpeed: 0.05, maxSpeed: 0.12 },
      { type: "cumulonimbus", color: "200,200,210", minSize: 0.8, maxSize: 1.5, minOpacity: 0.35, maxOpacity: 0.6, minSpeed: 0.06, maxSpeed: 0.14 },
      { type: "altocumulus", color: "245,245,250", minSize: 0.3, maxSize: 0.7, minOpacity: 0.25, maxOpacity: 0.45, minSpeed: 0.1, maxSpeed: 0.2 },
    ];
    for (let i = 0; i < 50; i++) {
      const config = cloudTypes[Math.floor(Math.random() * cloudTypes.length)];
      this.clouds.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        speed: config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed),
        size: config.minSize + Math.random() * (config.maxSize - config.minSize),
        opacity: config.minOpacity + Math.random() * (config.maxOpacity - config.minOpacity),
        type: config.type,
        color: config.color
      });
    }
    // 飞鸟均匀分布在地图上层
    const birdTypes: Array<{ type: "sparrow" | "swallow" | "eagle" | "crane" | "pigeon"; color: string; minSize: number; maxSize: number; minSpeed: number; maxSpeed: number; wingSpeed: number; altitude: number }> = [
      { type: "sparrow", color: "101,67,33", minSize: 0.4, maxSize: 0.6, minSpeed: 0.8, maxSpeed: 1.2, wingSpeed: 0.2, altitude: 1.0 },
      { type: "swallow", color: "30,30,30", minSize: 0.5, maxSize: 0.7, minSpeed: 1.2, maxSpeed: 1.8, wingSpeed: 0.25, altitude: 0.9 },
      { type: "eagle", color: "139,90,43", minSize: 0.9, maxSize: 1.3, minSpeed: 0.6, maxSpeed: 1.0, wingSpeed: 0.08, altitude: 0.7 },
      { type: "crane", color: "220,220,220", minSize: 0.8, maxSize: 1.1, minSpeed: 0.5, maxSpeed: 0.9, wingSpeed: 0.1, altitude: 0.8 },
      { type: "pigeon", color: "128,128,128", minSize: 0.6, maxSize: 0.8, minSpeed: 0.7, maxSpeed: 1.1, wingSpeed: 0.15, altitude: 0.95 },
    ];
    for (let i = 0; i < 20; i++) {
      const config = birdTypes[Math.floor(Math.random() * birdTypes.length)];
      this.birds.push({
        x: Math.random() * mapWidth,
        y: Math.random() * mapHeight,
        speed: config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed),
        wingPhase: Math.random() * Math.PI * 2,
        size: config.minSize + Math.random() * (config.maxSize - config.minSize),
        type: config.type,
        color: config.color,
        wingSpeed: config.wingSpeed,
        altitude: config.altitude
      });
    }
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
    // 云飞家小路
    network.createRoadFromLine('to_yunfei', [30, 50], [30, 38], 32, 'dirt');
    // 齐琳琳家小路
    network.createRoadFromLine('to_qilinlin', [60, 50], [60, 68], 32, 'dirt');
    // 商业街
    network.createRoadFromLine('commercial', [40, 30], [70, 30], 40, 'stone');
  }

  private loadScripts(): void {
    const merchantScripts: RoleScript[] = [
      { id: "wuping_daily", 角色: "吴平", 商铺: "fruit_shop", 商铺位置: [35, 13], 活动范围: { 中心: [35, 13], 半径: 3 },
        行为状态机: { "开店准备": { id: "open", 触发条件: "未营业", 指令序列: [{ module: "move_to", params: { target: [35, 13] } }, { module: "open_shop", params: { shop_id: "fruit_shop", greeting: true } }, { module: "say_from_template", params: { template_id: "fruit_shop_open", duration: 3000 } }] },
          "营业中_门口招揽": { id: "attract", 触发条件: "营业中", 指令序列: [{ module: "move_in_area", params: { center: [35, 13], radius: 2, min_stay: 2000, max_stay: 4000 } }, { module: "attract_customer", params: { range: 10, template_id: "fruit_attract" } }, { module: "play_animation", params: { animation: "wave", duration: 1500 } }], 循环: true },
          "营业中_整理": { id: "work", 触发条件: "营业中 且 无顾客 且 概率0.3", 指令序列: [{ module: "play_animation", params: { animation: "sit", duration: 2000 } }, { module: "say_from_template", params: { template_id: "merchant_work", duration: 2500 } }] } } },
      { id: "yunxiang_daily", 角色: "云香", 商铺: "flower_shop", 商铺位置: [60, 13], 活动范围: { 中心: [60, 13], 半径: 3 },
        行为状态机: { "开店准备": { id: "open", 触发条件: "未营业", 指令序列: [{ module: "move_to", params: { target: [60, 13] } }, { module: "open_shop", params: { shop_id: "flower_shop", greeting: true } }, { module: "say_from_template", params: { template_id: "flower_shop_open", duration: 3000 } }] },
          "营业中_门口招揽": { id: "attract", 触发条件: "营业中", 指令序列: [{ module: "move_in_area", params: { center: [60, 13], radius: 2, min_stay: 2000, max_stay: 4000 } }, { module: "attract_customer", params: { range: 10, template_id: "flower_attract" } }], 循环: true },
          "营业中_浇花": { id: "care", 触发条件: "营业中 且 无顾客 且 概率0.4", 指令序列: [{ module: "play_animation", params: { animation: "sit", duration: 3000 } }, { module: "say_from_template", params: { template_id: "flower_care", duration: 2500 } }] } } },
      { id: "huqian_daily", 角色: "胡倩", 商铺: "clothes_shop", 商铺位置: [47, 13], 活动范围: { 中心: [47, 13], 半径: 3 },
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
    const resize = () => { const rect = this.container.getBoundingClientRect(); this.canvas.width = rect.width; this.canvas.height = rect.height; };
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
    this.npcs = npcDefinitions.map(data => new Npc(data, this.engine, this.brainEngine, this.pathFinder));
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
      if (npc.currentDecision?.canExecute) return npc.currentDecision.actionId.replace("action_", "");
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

  private draw(): void {
    const ctx = this.ctx; const cw = this.canvas.width; const ch = this.canvas.height;
    ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, cw, ch);

    const viewLeft = this.cameraX - cw / 2 / this.zoom; const viewTop = this.cameraY - ch / 2 / this.zoom;
    const viewRight = this.cameraX + cw / 2 / this.zoom; const viewBottom = this.cameraY + ch / 2 / this.zoom;
    const startTileX = Math.max(0, Math.floor(viewLeft / 32)); const startTileY = Math.max(0, Math.floor(viewTop / 32));
    const endTileX = Math.min(幸福镇地图.width, Math.ceil(viewRight / 32)); const endTileY = Math.min(幸福镇地图.height, Math.ceil(viewBottom / 32));

    const shakeX = this.weatherSystem.screenShakeX;
    const shakeY = this.weatherSystem.screenShakeY;
    ctx.save();
    ctx.translate(cw / 2 - (this.cameraX + shakeX) * this.zoom, ch / 2 - (this.cameraY + shakeY) * this.zoom);
    ctx.scale(this.zoom, this.zoom);

    const sm = this.mapManager.staticMapCanvas;
    if (!sm) return;
    const srcX = startTileX * 32;
    const srcY = startTileY * 32;
    const srcW = (endTileX - startTileX) * 32;
    const srcH = (endTileY - startTileY) * 32;
    ctx.drawImage(sm, srcX, srcY, srcW, srcH, srcX, srcY, srcW, srcH);

    drawWaterAnimLayer(ctx, startTileX, startTileY, endTileX, endTileY, this.mapManager.tileGrid, Date.now() / 1000);

    // 渲染独立道路网络（在地形之上，建筑之下）
    this.mapManager.renderRoads(ctx, { x: viewLeft, y: viewTop, width: viewRight - viewLeft, height: viewBottom - viewTop });

    this.drawBuildingsTopDown(ctx);
    this.npcs.forEach(npc => npc.draw(ctx, this.spriteSheet, 1));
    this.drawSelection(ctx);
    this.drawWaterRipples(ctx);
    if (this.dayPhase !== "night") { this.drawClouds(ctx); this.drawBirds(ctx); }
    this.drawDialogues(ctx);
    this.particleSystem.draw(ctx, viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);
    this.weatherSystem.draw(ctx, viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);
    this.drawDayNightEffect(ctx, viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);

    ctx.restore();
    this.drawFPS(ctx);
  }

  // ==================== 俯视角建筑绘制（缩小一半）====================
  private drawBuildingsTopDown(ctx: CanvasRenderingContext2D): void {
    for (const building of 幸福镇地图.buildings) {
      const [x1, y1, x2, y2] = building.bounds;
      const bx = x1 * 32; const by = y1 * 32;
      const bw = (x2 - x1) * 32; const bh = (y2 - y1) * 32;
      const cx = bx + bw / 2; const cy = by + bh / 2;
      const baseColor = building.color || "#8B6914";

      const roofW = bw * 0.5; const roofH = bh * 0.5;
      const roofX = cx - roofW / 2; const roofY = cy - roofH / 2;

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + bh * 0.25, roofW * 0.6, roofH * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (building.type === "商店") {
        this.drawShopTopDown(ctx, roofX, roofY, roofW, roofH, baseColor, building);
      } else if (building.type === "住宅") {
        this.drawHouseTopDown(ctx, roofX, roofY, roofW, roofH, baseColor, building);
      } else if (building.type === "农田") {
        this.drawFarmTopDown(ctx, bx, by, bw, bh);
      } else if (building.id === "square" || building.type === "公共") {
        drawPlazaPaving(ctx, building);
        if (this.zoom > 0.5) {
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px "Microsoft YaHei", sans-serif`;
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,0.7)";
          ctx.shadowBlur = 3;
          ctx.fillText(building.name, bx + bw / 2, by + bh * 0.3);
          ctx.shadowBlur = 0;
        }
      } else {
        this.drawGenericBuildingTopDown(ctx, roofX, roofY, roofW, roofH, baseColor, building);
      }

      if (building.entrance) {
        const [ex, ey] = building.entrance;
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(ex * 32, ey * 32, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawShopTopDown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, building: BuildingDef): void {
    const roofColor = adjustColor(color, 20);
    const wallColor = adjustColor(color, -10);

    ctx.fillStyle = wallColor;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    ctx.fillStyle = roofColor;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

    ctx.fillStyle = adjustColor(roofColor, -15);
    for (let i = x + 6; i < x + w - 6; i += 6) ctx.fillRect(i, y + 4, 1, h - 8);
    for (let i = y + 6; i < y + h - 6; i += 6) ctx.fillRect(x + 4, i, w - 8, 1);

    ctx.fillStyle = "#F5E6D3";
    ctx.fillRect(x + w * 0.15, y + h * 0.35, w * 0.7, h * 0.25);
    ctx.strokeStyle = adjustColor(color, -30); ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.15, y + h * 0.35, w * 0.7, h * 0.25);

    if (building.owner) {
      const owner = this.npcs.find(n => n.data.id === building.owner);
      if (owner && owner.isShopOpen) {
        ctx.fillStyle = "#4CAF50";
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.15, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(76,175,80,0.3)";
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.15, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.zoom > 0.6) {
      ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3;
      ctx.fillText(building.name, x + w / 2, y + h * 0.55);
      ctx.shadowBlur = 0;
    }
  }

  private drawHouseTopDown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, building: BuildingDef): void {
    const roofColor = adjustColor(color, 30);
    const wallColor = adjustColor(color, -20);
    const roofDark = adjustColor(color, 10);

    ctx.fillStyle = wallColor;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + 2);
    ctx.lineTo(x + w - 2, y + h * 0.45);
    ctx.lineTo(x + 2, y + h * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = roofDark;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + 2);
    ctx.lineTo(x + w * 0.5, y + h * 0.45);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * (w * 0.15);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5 + offset, y + 5);
      ctx.lineTo(x + w * 0.5 + offset * 0.5, y + h * 0.45);
      ctx.stroke();
    }

    ctx.fillStyle = "#4FC3F7";
    ctx.fillRect(x + w * 0.2, y + h * 0.5, w * 0.2, h * 0.2);
    ctx.fillRect(x + w * 0.6, y + h * 0.5, w * 0.2, h * 0.2);
    ctx.strokeStyle = "#2196F3";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.2, y + h * 0.5, w * 0.2, h * 0.2);
    ctx.strokeRect(x + w * 0.6, y + h * 0.5, w * 0.2, h * 0.2);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.5);
    ctx.lineTo(x + w * 0.3, y + h * 0.7);
    ctx.moveTo(x + w * 0.2, y + h * 0.6);
    ctx.lineTo(x + w * 0.4, y + h * 0.6);
    ctx.moveTo(x + w * 0.7, y + h * 0.5);
    ctx.lineTo(x + w * 0.7, y + h * 0.7);
    ctx.moveTo(x + w * 0.6, y + h * 0.6);
    ctx.lineTo(x + w * 0.8, y + h * 0.6);
    ctx.stroke();

    if (this.zoom > 0.6) {
      ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3;
      ctx.fillText(building.name, x + w / 2, y + h * 0.55);
      ctx.shadowBlur = 0;
    }
  }

  private drawFarmTopDown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const rows = 4;
    const cols = 5;
    const cellW = w / cols;
    const cellH = h / rows;
    ctx.fillStyle = "#9A7B52";
    ctx.fillRect(x, y, w, h);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + c * cellW;
        const cy = y + r * cellH;
        const isWheat = (r + c) % 2 === 0;
        ctx.fillStyle = isWheat ? "#C9A84C" : "#A08040";
        ctx.fillRect(cx + 2, cy + 2, cellW - 4, cellH - 4);
        if (isWheat) {
          const t = Date.now() / 1000;
          const sway = Math.sin(t + c + r) * 0.5;
          ctx.fillStyle = "#E8D060";
          for (let s = 0; s < 4; s++) {
            const sx = cx + cellW * (0.2 + s * 0.18);
            ctx.fillRect(sx + sway, cy + cellH * 0.15, 2, cellH * 0.65);
          }
        } else {
          ctx.fillStyle = "#7A6238";
          ctx.fillRect(cx + cellW * 0.3, cy + cellH * 0.4, cellW * 0.4, 2);
        }
      }
    }
    ctx.strokeStyle = "#5D4037";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  private drawGenericBuildingTopDown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, building: BuildingDef): void {
    const roofColor = adjustColor(color, 20);
    const wallColor = adjustColor(color, -15);
    ctx.fillStyle = wallColor;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = roofColor;
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.fillStyle = adjustColor(roofColor, -20);
    ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
    if (this.zoom > 0.6) {
      ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(8, 10 * this.zoom)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3;
      ctx.fillText(building.name, x + w / 2, y + h * 0.55);
      ctx.shadowBlur = 0;
    }
  }

  private drawWaterRipples(ctx: CanvasRenderingContext2D): void {
    const time = Date.now();
    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const ripple = this.waterRipples[i];
      const elapsed = time - ripple.time;
      if (elapsed > 2000) { this.waterRipples.splice(i, 1); continue; }
      const progress = elapsed / 2000;
      const radius = progress * ripple.maxRadius;
      ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - progress)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawClouds(ctx: CanvasRenderingContext2D): void {
    const targetConfig = WEATHER_CONFIGS[this.weatherSystem.targetWeather];
    const currentConfig = WEATHER_CONFIGS[this.weatherSystem.currentWeather];
    const progress = this.weatherSystem.transitionProgress;
    const tr = this.weatherSystem.isTransitioning ? lerp(currentConfig.cloudTintR || 1, targetConfig.cloudTintR || 1, progress) : (currentConfig.cloudTintR || 1);
    const tg = this.weatherSystem.isTransitioning ? lerp(currentConfig.cloudTintG || 1, targetConfig.cloudTintG || 1, progress) : (currentConfig.cloudTintG || 1);
    const tb = this.weatherSystem.isTransitioning ? lerp(currentConfig.cloudTintB || 1, targetConfig.cloudTintB || 1, progress) : (currentConfig.cloudTintB || 1);
    const alphaMult = this.weatherSystem.isTransitioning ? lerp(currentConfig.cloudAlphaMult || 1, targetConfig.cloudAlphaMult || 1, progress) : (currentConfig.cloudAlphaMult || 1);
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed;
      if (cloud.x > 幸福镇地图.width * 32 + 200) cloud.x = -200;
      const [cr, cg, cb] = cloud.color.split(",").map(Number);
      ctx.fillStyle = `rgba(${Math.round(cr * tr)},${Math.round(cg * tg)},${Math.round(cb * tb)},${cloud.opacity * alphaMult})`;
      const s = cloud.size * 20;
      ctx.beginPath();
      switch (cloud.type) {
        case "cumulus":
          ctx.arc(cloud.x, cloud.y, s, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 0.8, cloud.y - s * 0.3, s * 0.8, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 1.5, cloud.y, s * 0.7, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 0.4, cloud.y - s * 0.6, s * 0.6, 0, Math.PI * 2);
          break;
        case "cirrus":
          ctx.ellipse(cloud.x, cloud.y, s * 2, s * 0.3, 0, 0, Math.PI * 2);
          ctx.ellipse(cloud.x + s * 0.5, cloud.y - s * 0.2, s * 1.5, s * 0.2, 0.1, 0, Math.PI * 2);
          ctx.ellipse(cloud.x - s * 0.3, cloud.y + s * 0.15, s * 1.2, s * 0.15, -0.1, 0, Math.PI * 2);
          break;
        case "stratus":
          ctx.ellipse(cloud.x, cloud.y, s * 2.5, s * 0.6, 0, 0, Math.PI * 2);
          ctx.ellipse(cloud.x + s * 0.8, cloud.y - s * 0.1, s * 2, s * 0.5, 0, 0, Math.PI * 2);
          break;
        case "cumulonimbus":
          ctx.arc(cloud.x, cloud.y, s, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 0.7, cloud.y - s * 0.4, s * 0.9, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 1.4, cloud.y, s * 0.8, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 0.3, cloud.y - s * 0.8, s * 0.7, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 1.0, cloud.y - s * 0.6, s * 0.75, 0, Math.PI * 2);
          break;
        case "altocumulus":
          ctx.arc(cloud.x, cloud.y, s * 0.8, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 1.0, cloud.y, s * 0.7, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 0.5, cloud.y - s * 0.5, s * 0.6, 0, Math.PI * 2);
          ctx.arc(cloud.x + s * 1.5, cloud.y - s * 0.2, s * 0.65, 0, Math.PI * 2);
          break;
      }
      ctx.fill();
    }
  }

  private drawBirds(ctx: CanvasRenderingContext2D): void {
    const time = Date.now() / 1000;
    for (const bird of this.birds) {
      bird.x += bird.speed;
      bird.wingPhase += bird.wingSpeed;
      if (bird.x > 幸福镇地图.width * 32 + 50) { bird.x = -50; bird.y = Math.random() * 幸福镇地图.height * 32; }
      const wingY = Math.sin(bird.wingPhase) * 3 * bird.size * bird.altitude;
      const floatY = Math.sin(time * 2 + bird.x * 0.01) * 2 * bird.altitude;
      const drawY = bird.y + floatY;
      ctx.strokeStyle = `rgba(${bird.color},0.7)`;
      ctx.lineWidth = Math.max(1, 1.5 * bird.size);
      ctx.beginPath();
      switch (bird.type) {
        case "sparrow":
          ctx.moveTo(bird.x - 3 * bird.size, drawY + wingY);
          ctx.quadraticCurveTo(bird.x, drawY - 1 * bird.size, bird.x + 3 * bird.size, drawY + wingY);
          break;
        case "swallow":
          ctx.moveTo(bird.x - 5 * bird.size, drawY + wingY);
          ctx.quadraticCurveTo(bird.x - 2 * bird.size, drawY - 3 * bird.size, bird.x, drawY);
          ctx.quadraticCurveTo(bird.x + 2 * bird.size, drawY - 3 * bird.size, bird.x + 5 * bird.size, drawY + wingY);
          break;
        case "eagle":
          ctx.moveTo(bird.x - 6 * bird.size, drawY + wingY * 0.7);
          ctx.quadraticCurveTo(bird.x - 3 * bird.size, drawY - 4 * bird.size, bird.x, drawY - 1 * bird.size);
          ctx.quadraticCurveTo(bird.x + 3 * bird.size, drawY - 4 * bird.size, bird.x + 6 * bird.size, drawY + wingY * 0.7);
          break;
        case "crane":
          ctx.moveTo(bird.x - 7 * bird.size, drawY + wingY * 0.8);
          ctx.quadraticCurveTo(bird.x - 3 * bird.size, drawY - 5 * bird.size, bird.x, drawY - 2 * bird.size);
          ctx.quadraticCurveTo(bird.x + 3 * bird.size, drawY - 5 * bird.size, bird.x + 7 * bird.size, drawY + wingY * 0.8);
          ctx.moveTo(bird.x, drawY - 2 * bird.size);
          ctx.lineTo(bird.x, drawY + 3 * bird.size);
          break;
        case "pigeon":
          ctx.moveTo(bird.x - 4 * bird.size, drawY + wingY);
          ctx.quadraticCurveTo(bird.x - 1 * bird.size, drawY - 2 * bird.size, bird.x, drawY);
          ctx.quadraticCurveTo(bird.x + 1 * bird.size, drawY - 2 * bird.size, bird.x + 4 * bird.size, drawY + wingY);
          break;
      }
      ctx.stroke();
    }
  }

  private drawSelection(ctx: CanvasRenderingContext2D): void {
    if (!this.selectedNpc) return;
    const npc = this.selectedNpc;
    const px = npc.x * 32;
    const py = npc.y * 32;
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 215, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDialogues(ctx: CanvasRenderingContext2D): void {
    const allDialogues = this.dialogueSystem.getAllActiveDialogues();
    for (const [npcId, dialogues] of allDialogues) {
      const npc = this.npcs.find(n => n.data.id === npcId);
      if (!npc || dialogues.length === 0) continue;
      const dialogue = dialogues[0];
      const screenX = npc.x * 32; const screenY = npc.y * 32 - 20;
      const text = dialogue.text;
      ctx.font = `bold 11px "Microsoft YaHei", sans-serif`;
      const textWidth = ctx.measureText(text).width;
      const padding = 6;
      const boxW = textWidth + padding * 2;
      const boxH = 20;
      const boxX = screenX - boxW / 2 + 16;
      const boxY = screenY - boxH;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(text, boxX + boxW / 2, boxY + 14);
    }
  }

  private drawDayNightEffect(ctx: CanvasRenderingContext2D, viewX: number, viewY: number, viewW: number, viewH: number): void {
    if (this.ambientLight >= 1) return;
    const darkness = 1 - this.ambientLight;
    let overlayColor: string;
    switch (this.dayPhase) {
      case "dawn": overlayColor = `rgba(255,200,150,${darkness * 0.3})`; break;
      case "dusk": overlayColor = `rgba(100,50,80,${darkness * 0.5})`; break;
      case "night": overlayColor = `rgba(10,15,40,${darkness * 0.7})`; break;
      default: overlayColor = `rgba(0,0,0,${darkness * 0.3})`;
    }
    ctx.fillStyle = overlayColor;
    ctx.fillRect(viewX, viewY, viewW, viewH);
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