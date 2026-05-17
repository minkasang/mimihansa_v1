/**
 * 世界地图演示：地形 + NPC（32×64 精美像素精灵）+ WASD 连续走格 + 边缘卷屏 + 走路动画。
 * 规范见 docs《世界系统》地图演示程序、《角色系统》NPC 单文件存储、《角色精灵与动画规范》。
 */

import npcDemo01 from "../../../NPC/npc_demo_01.json";
import npcVillager01 from "../../../NPC/npc_villager_01.json";
import { bindWasdContinuousGrid } from "./interaction/continuousWasd";
import { generateSampleSpriteSheet, getFrameFromSpriteSheet, type Facing, type AnimationState } from "./npc/spriteSheetGenerator";
import { Terrain, TERRAIN_NAMES } from "./terrain";
import type { WorldNpcFile } from "./types/worldNpcFile";
import { buildTerrainGrid, pickColor } from "./world/terrainGen";

const MAP_WIDTH_TILES = 100;
const MAP_HEIGHT_TILES = 100;
const TILE_PX = 32; // 增大到 32x32 格子
const EDGE_MARGIN_PX = 80;

const WALK_FRAME_MS = 120;
const NPC_WALK_FRAME_MS = 180; // NPC 走路稍慢

function facingFromDelta(dx: number, dy: number): Facing {
  if (dx < 0) return "left";
  if (dx > 0) return "right";
  if (dy < 0) return "up";
  return "down";
}

// NPC 类
class Npc {
  tileX: number;
  tileY: number;
  facing: Facing = "down";
  animState: AnimationState = "idle";
  walkFrame = 0;
  lastWalkFrameTime = 0;
  name: string;
  id: string;
  isMoving = false;
  patrolRange: [[number, number], [number, number]] | null = null;
  targetX: number | null = null;
  targetY: number | null = null;
  moveTimer: number | null = null;

  constructor(data: WorldNpcFile & { 巡逻范围?: [[number, number], [number, number]] }) {
    this.tileX = data.坐标[0]!;
    this.tileY = data.坐标[1]!;
    this.name = data.姓名;
    this.id = data.角色id;
    if (data.巡逻范围) {
      this.patrolRange = data.巡逻范围;
    }
  }

  update(now: number, grid: Uint8Array, mapW: number, mapH: number): void {
    // AI 行为：随机巡逻
    if (this.patrolRange && !this.isMoving) {
      if (this.moveTimer === null || now - this.moveTimer > 2000 + Math.random() * 3000) {
        this.decideNextMove(grid, mapW, mapH);
        this.moveTimer = now;
      }
    }

    // 执行移动
    if (this.isMoving && this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.tileX;
      const dy = this.targetY - this.tileY;
      
      // 每帧移动 0.05 格，约 20 帧到达（约 1 秒）
      const moveSpeed = 0.05;
      
      if (Math.abs(dx) > moveSpeed || Math.abs(dy) > moveSpeed) {
        // 还在移动中
        this.tileX += Math.sign(dx) * Math.min(Math.abs(dx), moveSpeed);
        this.tileY += Math.sign(dy) * Math.min(Math.abs(dy), moveSpeed);
        this.isMoving = true;
      } else {
        // 到达目标
        this.tileX = this.targetX;
        this.tileY = this.targetY;
        this.targetX = null;
        this.targetY = null;
        this.isMoving = false;
      }
    }

    // 更新动画帧
    if (this.isMoving) {
      this.animState = "walk";
      if (now - this.lastWalkFrameTime >= NPC_WALK_FRAME_MS) {
        this.walkFrame = (this.walkFrame + 1) % 4;
        this.lastWalkFrameTime = now;
      }
    } else {
      this.animState = "idle";
      this.walkFrame = 0;
    }
  }

  decideNextMove(grid: Uint8Array, mapW: number, mapH: number): void {
    if (!this.patrolRange) return;

    const [[minX, minY], [maxX, maxY]] = this.patrolRange;
    
    // 随机选择一个方向
    const directions = [
      { dx: 0, dy: -1 }, // 上
      { dx: 0, dy: 1 },  // 下
      { dx: -1, dy: 0 }, // 左
      { dx: 1, dy: 0 },  // 右
    ];
    
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const newX = this.tileX + dir.dx;
    const newY = this.tileY + dir.dy;

    // 检查是否在巡逻范围内且可通行
    if (newX >= minX && newX <= maxX && newY >= minY && newY <= maxY) {
      const terrain = grid[newY * mapW + newX];
      if (terrain !== Terrain.Stone && terrain !== Terrain.Water) {
        this.targetX = newX;
        this.targetY = newY;
        this.facing = facingFromDelta(dir.dx, dir.dy);
        this.isMoving = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, spriteSheet: HTMLCanvasElement, tilePx: number): void {
    const animIndex = this.animState === "idle" ? 0 : 1;
    const dirIndex = this.facing === "down" ? 0 : this.facing === "up" ? 1 : 2;
    const frameRect = getFrameFromSpriteSheet(
      spriteSheet,
      32, 64,
      animIndex,
      dirIndex,
      this.walkFrame,
      3
    );

    const spriteX = this.tileX * tilePx + (tilePx - 32) / 2;
    const spriteY = this.tileY * tilePx + tilePx - 64;

    ctx.drawImage(
      spriteSheet,
      frameRect.x, frameRect.y, frameRect.width, frameRect.height,
      spriteX, spriteY, 32, 64
    );

    // 绘制 NPC 名字
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.name, spriteX + 16, spriteY - 5);
  }
}

function main(): void {
  const canvas = document.getElementById("c") as HTMLCanvasElement | null;
  const hud = document.getElementById("hud");
  if (!canvas || !hud) {
    console.log("地图演示：缺少 canvas 或 hud 节点");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const context = ctx;

  const c = canvas;
  const hudEl = hud;

  context.imageSmoothingEnabled = false;

  const worldPxW = MAP_WIDTH_TILES * TILE_PX;
  const worldPxH = MAP_HEIGHT_TILES * TILE_PX;

  const grid = buildTerrainGrid(MAP_WIDTH_TILES, MAP_HEIGHT_TILES);

  // 玩家数据
  const npcData = npcDemo01 as WorldNpcFile;
  let playerTileX = npcData.坐标[0]!;
  let playerTileY = npcData.坐标[1]!;
  let facing: Facing = "down";

  // NPC 数据
  const villagerData = npcVillager01 as WorldNpcFile & { 巡逻范围?: [[number, number], [number, number]] };
  const npc = new Npc(villagerData);

  let camX = 0;
  let camY = 0;
  let scale = 1;
  let hoverTileX = 0;
  let hoverTileY = 0;

  let animState: AnimationState = "idle";
  let walkFrame = 0;
  let lastWalkFrameTime = 0;
  let isMoving = false;

  // 生成精灵表
  const spriteSheet = generateSampleSpriteSheet();
  console.log("精灵表已生成，尺寸:", spriteSheet.width, "x", spriteSheet.height);

  function centerCameraOnPlayer(): void {
    const viewW = c.width / scale;
    const viewH = c.height / scale;
    camX = playerTileX * TILE_PX + TILE_PX / 2 - viewW / 2;
    camY = playerTileY * TILE_PX + TILE_PX / 2 - viewH / 2 - 16;
    clampCam();
  }

  function clampCam(): void {
    const viewW = c.width / scale;
    const viewH = c.height / scale;
    const maxX = Math.max(0, worldPxW - viewW);
    const maxY = Math.max(0, worldPxH - viewH);
    camX = Math.max(0, Math.min(maxX, camX));
    camY = Math.max(0, Math.min(maxY, camY));
  }

  function resize(): void {
    const margin = 48;
    const w = Math.min(800, window.innerWidth - margin);
    const h = Math.min(600, window.innerHeight - margin - hudEl.offsetHeight);
    c.width = Math.max(320, Math.floor(w));
    c.height = Math.max(240, Math.floor(h));
    centerCameraOnPlayer();
    draw();
  }

  function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    const rect = c.getBoundingClientRect();
    const x = sx - rect.left;
    const y = sy - rect.top;
    return {
      wx: camX + x / scale,
      wy: camY + y / scale,
    };
  }

  function updateWalkAnimation(now: number): void {
    if (isMoving) {
      animState = "walk";
      if (now - lastWalkFrameTime >= WALK_FRAME_MS) {
        walkFrame = (walkFrame + 1) % 4;
        lastWalkFrameTime = now;
      }
    } else {
      animState = "idle";
      walkFrame = 0;
    }
  }

  function draw(): void {
    const now = performance.now();
    updateWalkAnimation(now);
    npc.update(now, grid, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);

    context.fillStyle = "#1a252f";
    context.fillRect(0, 0, c.width, c.height);

    context.save();
    context.scale(scale, scale);
    context.translate(-camX, -camY);

    const x0 = Math.floor(camX / TILE_PX);
    const y0 = Math.floor(camY / TILE_PX);
    const x1 = Math.ceil((camX + c.width / scale) / TILE_PX);
    const y1 = Math.ceil((camY + c.height / scale) / TILE_PX);

    for (let ty = Math.max(0, y0); ty < Math.min(MAP_HEIGHT_TILES, y1); ty++) {
      for (let tx = Math.max(0, x0); tx < Math.min(MAP_WIDTH_TILES, x1); tx++) {
        const kind = grid[ty * MAP_WIDTH_TILES + tx] as Terrain;
        context.fillStyle = pickColor(kind, tx, ty);
        context.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
      }
    }

    context.strokeStyle = "rgba(0,0,0,0.12)";
    context.lineWidth = 1 / scale;
    for (let ty = Math.max(0, y0); ty < Math.min(MAP_HEIGHT_TILES, y1); ty++) {
      for (let tx = Math.max(0, x0); tx < Math.min(MAP_WIDTH_TILES, x1); tx++) {
        context.strokeRect(tx * TILE_PX + 0.5, ty * TILE_PX + 0.5, TILE_PX - 1, TILE_PX - 1);
      }
    }

    // 绘制 NPC（在玩家下方，如果 NPC 在玩家后面）
    if (npc.tileY <= playerTileY) {
      npc.draw(context, spriteSheet, TILE_PX);
    }

    // 绘制玩家角色
    const animIndex = animState === "idle" ? 0 : 1;
    const dirIndex = facing === "down" ? 0 : facing === "up" ? 1 : 2;
    const frameRect = getFrameFromSpriteSheet(
      spriteSheet,
      32, 64,
      animIndex,
      dirIndex,
      walkFrame,
      3
    );

    const spriteX = playerTileX * TILE_PX + (TILE_PX - 32) / 2;
    const spriteY = playerTileY * TILE_PX + TILE_PX - 64;

    context.drawImage(
      spriteSheet,
      frameRect.x, frameRect.y, frameRect.width, frameRect.height,
      spriteX, spriteY, 32, 64
    );

    // 绘制 NPC（在玩家上方，如果 NPC 在玩家前面）
    if (npc.tileY > playerTileY) {
      npc.draw(context, spriteSheet, TILE_PX);
    }

    context.restore();

    const hKind = grid[hoverTileY * MAP_WIDTH_TILES + hoverTileX] as Terrain;
    hudEl.textContent = `地图演示 · ${npcData.姓名} (${npcData.角色id}) + NPC:${npc.name} 格[${playerTileX},${playerTileY}] · 32×64像素角色 · 悬停[${hoverTileX},${hoverTileY}] ${TERRAIN_NAMES[hKind]} · WASD移动 · 滚轮缩放`;
  }

  const unbindWalk = bindWasdContinuousGrid({
    grid,
    mapW: MAP_WIDTH_TILES,
    mapH: MAP_HEIGHT_TILES,
    tilePx: TILE_PX,
    getPlayer: () => ({ x: playerTileX, y: playerTileY }),
    setPlayer: (x, y) => {
      playerTileX = x;
      playerTileY = y;
    },
    setFacingFromDelta: (dx, dy) => {
      facing = facingFromDelta(dx, dy);
    },
    canvas: c,
    getCam: () => ({ camX, camY, scale }),
    setCam: (x, y) => {
      camX = x;
      camY = y;
    },
    clampCam,
    edgeMarginPx: EDGE_MARGIN_PX,
    onFrame: () => {
      draw();
    },
    onMoveStart: () => {
      isMoving = true;
    },
    onMoveEnd: () => {
      isMoving = false;
    },
  });

  c.addEventListener("mousemove", (e) => {
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    hoverTileX = Math.max(0, Math.min(MAP_WIDTH_TILES - 1, Math.floor(wx / TILE_PX)));
    hoverTileY = Math.max(0, Math.min(MAP_HEIGHT_TILES - 1, Math.floor(wy / TILE_PX)));
    draw();
  });

  c.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.max(0.35, Math.min(3, scale * factor));
      camX = wx - (e.clientX - rect.left) / newScale;
      camY = wy - (e.clientY - rect.top) / newScale;
      scale = newScale;
      clampCam();
      draw();
    },
    { passive: false }
  );

  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", unbindWalk);
  resize();

  console.log("地图演示已加载：32×64像素角色 + NPC AI + 精灵表系统 + WASD移动 + 滚轮缩放");
}

main();
