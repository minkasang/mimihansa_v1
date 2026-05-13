/**
 * 世界地图演示：地形 + NPC（星露谷风格 16×32 精灵）+ WASD 连续走格 + 边缘卷屏 + 走路动画。
 * 规范见 docs《世界系统》地图演示程序、《角色系统》NPC 单文件存储、《角色精灵与动画规范》。
 */

import npcDemo01 from "../../../NPC/npc_demo_01.json";
import { bindWasdContinuousGrid } from "./interaction/continuousWasd";
import { drawNpcSprite, type Facing, type AnimationState, type CharacterAppearance } from "./npc/drawNpcSprite";
import { Terrain, TERRAIN_NAMES } from "./terrain";
import type { WorldNpcFile } from "./types/worldNpcFile";
import { buildTerrainGrid, pickColor } from "./world/terrainGen";

const MAP_WIDTH_TILES = 100;
const MAP_HEIGHT_TILES = 100;
const TILE_PX = 16;
const EDGE_MARGIN_PX = 56;

const WALK_FRAME_MS = 120;

function facingFromDelta(dx: number, dy: number): Facing {
  if (dx < 0) return "left";
  if (dx > 0) return "right";
  if (dy < 0) return "up";
  return "down";
}

const APPEARANCES: Record<string, Partial<CharacterAppearance>> = {
  default: {
    发色: "#4a3728",
    肤色: "#f2d3b4",
    眼睛颜色: "#2c1810",
    衣服颜色: "#c45c4a",
    裤子颜色: "#3d5a80",
    鞋子颜色: "#5c4033",
  },
  farmer: {
    发色: "#8b4513",
    肤色: "#deb887",
    眼睛颜色: "#2c1810",
    衣服颜色: "#556b2f",
    裤子颜色: "#8b4513",
    鞋子颜色: "#654321",
  },
  merchant: {
    发色: "#2c1810",
    肤色: "#f2d3b4",
    眼睛颜色: "#4169e1",
    衣服颜色: "#4a4a8a",
    裤子颜色: "#2c2c2c",
    鞋子颜色: "#1a1a1a",
  },
  warrior: {
    发色: "#c9a227",
    肤色: "#d4a574",
    眼睛颜色: "#228b22",
    衣服颜色: "#8b0000",
    裤子颜色: "#3d3d3d",
    鞋子颜色: "#2c2c2c",
  },
  girl: {
    发色: "#ff6b6b",
    肤色: "#ffe4c4",
    眼睛颜色: "#4169e1",
    衣服颜色: "#ff69b4",
    裤子颜色: "#dda0dd",
    鞋子颜色: "#8b4513",
  },
};

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

  const npcData = npcDemo01 as WorldNpcFile;
  let playerTileX = npcData.坐标[0]!;
  let playerTileY = npcData.坐标[1]!;
  let facing: Facing = "down";

  let camX = 0;
  let camY = 0;
  let scale = 1;
  let hoverTileX = 0;
  let hoverTileY = 0;

  let animState: AnimationState = "idle";
  let walkFrame = 0;
  let lastWalkFrameTime = 0;
  let isMoving = false;

  const appearanceKeys = Object.keys(APPEARANCES);
  let currentAppearanceIdx = 0;
  let currentAppearance = APPEARANCES[appearanceKeys[0]!]!;

  function centerCameraOnPlayer(): void {
    const viewW = c.width / scale;
    const viewH = c.height / scale;
    camX = playerTileX * TILE_PX + TILE_PX / 2 - viewW / 2;
    camY = playerTileY * TILE_PX + TILE_PX / 2 - viewH / 2 - 8;
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

    drawNpcSprite(
      context,
      playerTileX * TILE_PX,
      playerTileY * TILE_PX,
      TILE_PX,
      facing,
      currentAppearance,
      animState,
      walkFrame
    );

    context.restore();

    const hKind = grid[hoverTileY * MAP_WIDTH_TILES + hoverTileX] as Terrain;
    const appearanceName = appearanceKeys[currentAppearanceIdx];
    hudEl.textContent = `地图演示 · ${npcData.姓名} (${npcData.角色id}) 格[${playerTileX},${playerTileY}] · 外观[${appearanceName}] · 悬停[${hoverTileX},${hoverTileY}] ${TERRAIN_NAMES[hKind]} · WASD移动 · E切换外观 · 滚轮缩放`;
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

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "e") {
      e.preventDefault();
      currentAppearanceIdx = (currentAppearanceIdx + 1) % appearanceKeys.length;
      currentAppearance = APPEARANCES[appearanceKeys[currentAppearanceIdx]!]!;
      draw();
    }
  });

  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", unbindWalk);
  resize();

  console.log("地图演示已加载：地形 + 星露谷风格NPC(16×32) + WASD移动 + E切换外观 + 滚轮缩放");
}

main();
