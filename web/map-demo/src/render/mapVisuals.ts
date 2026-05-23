/**
 * 地图层渲染 — 像素风整图一次性烘焙
 * 每个格子只有一种地表属性（CellTerrain），互斥不叠加
 */
import type { BuildingDef } from "../world/mapData";
import { CellTerrain, type TileGrid } from "../world/tileGrid";

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.substring(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.substring(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.substring(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.substring(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.substring(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.substring(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const TS = 32;

export function bakeFullMapCanvas(grid: TileGrid, width: number, height: number, tileSize: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width * tileSize;
  canvas.height = height * tileSize;
  const ctx = canvas.getContext("2d")!;
  drawMapLayer(ctx, 0, 0, width, height, grid, tileSize);
  return canvas;
}

export function isOnRoad(x: number, y: number, grid: TileGrid): boolean {
  return grid.isRoad(x, y);
}

export function drawWaterAnimation(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, ex: number, ey: number,
  grid: TileGrid,
  time: number
): void {
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      if (grid.getTerrain(x, y) !== CellTerrain.WATER) continue;
      const px = x * TS;
      const py = y * TS;
      const w = Math.sin(time * 2 + x * 0.3 + y * 0.5) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.12 + w * 0.15})`;
      ctx.fillRect(px + 4, py + 10, 24, 2);
    }
  }
}

export function drawVegetationLayer(): void {}

export function drawPlazaPaving(ctx: CanvasRenderingContext2D, building: BuildingDef): void {
  const [x1, y1, x2, y2] = building.bounds;
  const bx = x1 * TS;
  const by = y1 * TS;
  const bw = (x2 - x1) * TS;
  const bh = (y2 - y1) * TS;

  // 广场基底
  ctx.fillStyle = "#C8C0B0";
  ctx.fillRect(bx, by, bw, bh);

  // 棋盘格铺装
  for (let py = by; py < by + bh; py += 16) {
    for (let px = bx; px < bx + bw; px += 16) {
      const isAlt = ((px / 16 + py / 16) & 1) === 0;
      ctx.fillStyle = isAlt ? "#D8D0C0" : "#B0BEC5";
      ctx.fillRect(px, py, 16, 16);
    }
  }

  // 边缘描线
  ctx.strokeStyle = "#8A8070";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
}

export function adjustColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function drawMapLayer(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, ex: number, ey: number,
  grid: TileGrid,
  tileSize: number
): void {
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const terrain = grid.getTerrain(x, y);
      const px = x * tileSize;
      const py = y * tileSize;
      const n1 = hash2D(x, y);
      const n2 = hash2D(x + 100, y + 100);
      const isRoadNeighbor = checkRoadNeighbor(grid, x, y);

      switch (terrain) {
        case CellTerrain.GRASS:
          drawGrassTile(ctx, px, py, tileSize, n1, n2, isRoadNeighbor);
          break;
        case CellTerrain.DIRT:
          drawDirtTile(ctx, px, py, tileSize, n1, n2);
          break;
        case CellTerrain.STONE:
          drawStoneTile(ctx, px, py, tileSize, n1, n2);
          break;
        case CellTerrain.WATER:
          drawWaterTile(ctx, px, py, tileSize, n1, n2);
          break;
        case CellTerrain.ROAD_EDGE:
          drawRoadEdgeTile(ctx, px, py, tileSize, n1, n2, grid, x, y);
          break;
        case CellTerrain.ROAD_CENTER:
          drawRoadCenterTile(ctx, px, py, tileSize, n1, n2);
          break;
        case CellTerrain.ROAD_CROSS:
          drawRoadCrossTile(ctx, px, py, tileSize, n1, n2);
          break;
      }
    }
  }
}

// ──── 草地 ────
function drawGrassTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number, isRoadNeighbor: boolean
): void {
  const baseColor = tween(n1, "#5D8C3A", "#4A7030");
  ctx.fillStyle = baseColor;
  ctx.fillRect(px, py, tileSize, tileSize);

  ctx.fillStyle = tween(n2, "#7AB54A", "#6AAF4A");
  ctx.fillRect(px + (n1 * 28), py + (n2 * 28), 4, 4);

  if (n2 > 0.6) {
    ctx.fillStyle = tween(n1, "#8BC34A", "#558B2F");
    ctx.fillRect(px + 4, py + 8, 2, 6);
    ctx.fillRect(px + 6, py + 6, 2, 8);
  }
  if (n1 > 0.75) {
    ctx.fillStyle = tween(n2, "#7AB54A", "#689F38");
    ctx.fillRect(px + 20, py + 18, 2, 4);
    ctx.fillRect(px + 22, py + 16, 2, 6);
  }
  if (n2 > 0.9) {
    ctx.fillStyle = lighten("#8BC34A", 20);
    ctx.fillRect(px + 14, py + 22, 4, 8);
  }

  // 邻路草地：边缘混入泥土碎粒（星露谷风格的道路-草地自然过渡）
  if (isRoadNeighbor) {
    for (let d = 0; d < 12; d++) {
      const dx = Math.floor(hash2D(px + d, py + d * 2) * tileSize);
      const dy = Math.floor(hash2D(px + d * 3, py + d) * tileSize);
      // 只在靠近道路的边缘出现
      const edgeDist = Math.min(dx, dy, tileSize - dx, tileSize - dy);
      if (edgeDist > 4) continue;
      const shade = tween(hash2D(px + d * 7, py - d), "#C4A574", "#A0845A");
      ctx.fillStyle = shade;
      ctx.fillRect(px + dx, py + dy, 1 + Math.floor(hash2D(d, px) * 2), 1 + Math.floor(hash2D(d, py) * 2));
    }
  }

  if (n1 > 0.94) {
    drawTree(ctx, px + 16, py + 16, 10 + n2 * 10, n1, n2);
  } else if (n1 > 0.88 && n1 <= 0.94) {
    drawBush(ctx, px + 16, py + 16, 6 + n2 * 6, n1, n2);
  } else if (n1 > 0.82 && n1 <= 0.88 && n2 > 0.45) {
    drawFlower(ctx, px + 8 + n1 * 16, py + 8 + n2 * 16, n2);
  } else if (n1 > 0.7 && n1 <= 0.82) {
    ctx.fillStyle = n1 > 0.78 ? "#689F38" : "#7CB342";
    ctx.fillRect(px + 8 + n1 * 16, py + 20, 1, 3);
    ctx.fillRect(px + 10 + n2 * 12, py + 22, 1, 2);
  }
}

// ──── 土壤路共用纹理（真正无缝版本）────
function drawDirtPathBase(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  // 暖棕色土路底色 — 铺满整个格子，不留缝隙
  const baseColor = tween(n1, "#C4A05A", "#A0804A");
  ctx.fillStyle = baseColor;
  ctx.fillRect(px, py, tileSize, tileSize);

  // 路面纹理：深色/浅色斑块（更细腻）
  for (let d = 0; d < 8; d++) {
    const rx = Math.floor(hash2D(px + d * 3, py + d) * tileSize);
    const ry = Math.floor(hash2D(px + d * 7, py - d) * tileSize);
    const rw = 1 + Math.floor(hash2D(d, px + py) * 2);
    const rh = 1 + Math.floor(hash2D(d + 10, px - py) * 2);
    const shade = tween(hash2D(rx, ry), "#D4B888", "#8B7040");
    ctx.fillStyle = shade;
    ctx.fillRect(px + rx, py + ry, rw, rh);
  }

  // 小石子散落（更少更自然）
  if (n1 > 0.7 && n2 > 0.5) {
    ctx.fillStyle = tween(n2, "#B0A090", "#908878");
    ctx.fillRect(px + 6 + (n1 * 18), py + 8 + (n2 * 14), 2, 2);
  }
}

// ──── 道路-路面（中心格，纯路面无边缘）────
function drawRoadCenterTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  // 纯土路铺满
  drawDirtPathBase(ctx, px, py, tileSize, n1, n2);
}

// ──── 道路-边缘（只在朝向外侧的一边画路缘石）────
function drawRoadEdgeTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number,
  grid: TileGrid, x: number, y: number
): void {
  // 先铺满土路（与 ROAD_CENTER 一致，确保无缝）
  drawDirtPathBase(ctx, px, py, tileSize, n1, n2);

  // 检测四个方向的邻居
  const topIsGrass = !grid.isRoad(x, y - 1);
  const bottomIsGrass = !grid.isRoad(x, y + 1);
  const leftIsGrass = !grid.isRoad(x - 1, y);
  const rightIsGrass = !grid.isRoad(x + 1, y);

  // 路缘石颜色 - 增强对比度
  const curbBase = "#B8A898";
  const curbHighlight = "#E8D8C8";
  const curbShadow = "#685848";

  const curbWidth = 4;

  // 在朝向草地的一侧画路缘石
  if (topIsGrass) {
    // 上路缘石 - 更明显的立体效果
    ctx.fillStyle = curbBase;
    ctx.fillRect(px, py, tileSize, curbWidth);
    // 顶部高光（更亮）
    ctx.fillStyle = curbHighlight;
    ctx.fillRect(px, py, tileSize, 2);
    // 底部阴影（更暗）
    ctx.fillStyle = curbShadow;
    ctx.fillRect(px, py + curbWidth - 2, tileSize, 2);
    // 与路面交界处的暗线
    ctx.fillStyle = "rgba(80,70,60,0.5)";
    ctx.fillRect(px, py + curbWidth, tileSize, 1);
  }

  if (bottomIsGrass) {
    // 下路缘石
    ctx.fillStyle = curbBase;
    ctx.fillRect(px, py + tileSize - curbWidth, tileSize, curbWidth);
    // 顶部高光
    ctx.fillStyle = curbHighlight;
    ctx.fillRect(px, py + tileSize - curbWidth, tileSize, 2);
    // 底部阴影
    ctx.fillStyle = curbShadow;
    ctx.fillRect(px, py + tileSize - 2, tileSize, 2);
    ctx.fillStyle = "rgba(80,70,60,0.5)";
    ctx.fillRect(px, py + tileSize - curbWidth - 1, tileSize, 1);
  }

  if (leftIsGrass) {
    // 左路缘石
    ctx.fillStyle = curbBase;
    ctx.fillRect(px, py, curbWidth, tileSize);
    // 左侧高光
    ctx.fillStyle = curbHighlight;
    ctx.fillRect(px, py, 2, tileSize);
    // 右侧阴影
    ctx.fillStyle = curbShadow;
    ctx.fillRect(px + curbWidth - 2, py, 2, tileSize);
    ctx.fillStyle = "rgba(80,70,60,0.5)";
    ctx.fillRect(px + curbWidth, py, 1, tileSize);
  }

  if (rightIsGrass) {
    // 右路缘石
    ctx.fillStyle = curbBase;
    ctx.fillRect(px + tileSize - curbWidth, py, curbWidth, tileSize);
    // 左侧高光
    ctx.fillStyle = curbHighlight;
    ctx.fillRect(px + tileSize - curbWidth, py, 2, tileSize);
    // 右侧阴影
    ctx.fillStyle = curbShadow;
    ctx.fillRect(px + tileSize - 2, py, 2, tileSize);
    ctx.fillStyle = "rgba(80,70,60,0.5)";
    ctx.fillRect(px + tileSize - curbWidth - 1, py, 1, tileSize);
  }
}

// ──── 道路-路口（无缝铺满）────
function drawRoadCrossTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  // 路口直接铺满土路
  drawDirtPathBase(ctx, px, py, tileSize, n1, n2);

  // 路口中心磨损标记
  const cx = px + tileSize / 2;
  const cy = py + tileSize / 2;
  ctx.fillStyle = "rgba(180,150,110,0.25)";
  ctx.fillRect(px + 4, cy - 2, tileSize - 8, 4);
  ctx.fillRect(cx - 2, py + 4, 4, tileSize - 8);
}

// ──── 邻居检测 ────
function checkRoadNeighbor(grid: TileGrid, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = grid.getTerrain(x + dx, y + dy);
      if (t === CellTerrain.ROAD_CENTER || t === CellTerrain.ROAD_EDGE || t === CellTerrain.ROAD_CROSS) {
        return true;
      }
    }
  }
  return false;
}
function drawDirtTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  const baseColor = tween(n1, "#B8956A", "#9A7B55");
  ctx.fillStyle = baseColor;
  ctx.fillRect(px, py, tileSize, tileSize);

  // 泥土纹理变化
  ctx.fillStyle = tween(n2, "#D4B896", "#C4A574");
  ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

  if (n2 > 0.7) {
    ctx.fillStyle = tween(n1, "#9A7B55", "#8B7355");
    ctx.fillRect(px + 8, py + 20, 16, 4);
  }

  if (n1 > 0.85) {
    ctx.fillStyle = tween(n2, "#D4B896", "#C4A574");
    ctx.fillRect(px + 4, py + 4, 6, 6);
  }

  // 小石子
  if (n1 > 0.5 && n1 < 0.6) {
    ctx.fillStyle = "#A8A8A8";
    ctx.fillRect(px + 12, py + 14, 3, 2);
  }
}

// ──── 石头 ────
function drawStoneTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  const baseColor = tween(n1, "#8A8A8A", "#6E6E6E");
  ctx.fillStyle = baseColor;
  ctx.fillRect(px, py, tileSize, tileSize);

  // 石头块面
  ctx.fillStyle = tween(n2, "#A8A8A8", "#999999");
  ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

  if (n1 > 0.6) {
    ctx.fillStyle = tween(n2, "#6E6E6E", "#555555");
    ctx.fillRect(px + 4, py + 4, 10, 10);
  }

  if (n2 > 0.5) {
    ctx.fillStyle = tween(n1, "#888888", "#777777");
    ctx.fillRect(px + 20, py + 18, 8, 8);
  }

  // 裂缝
  if (n1 > 0.85) {
    ctx.strokeStyle = darken(baseColor, 30);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 14);
    ctx.lineTo(px + 18, py + 14);
    ctx.lineTo(px + 18, py + 26);
    ctx.stroke();
  }
}

// ──── 水体 ────
function drawWaterTile(
  ctx: CanvasRenderingContext2D, px: number, py: number,
  tileSize: number, n1: number, n2: number
): void {
  const shade = Math.sin(n1 * 3.14) * 0.15 + 0.85;
  const r = Math.floor(58 * shade);
  const g = Math.floor(139 * shade);
  const b = Math.floor(200 * shade);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(px, py, tileSize, tileSize);

  // 水纹
  if (n1 > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,0.08)`;
    ctx.fillRect(px + 2, py + 6, tileSize - 4, 2);
  }
  if (n1 < 0.4) {
    ctx.fillStyle = `rgba(0,0,60,0.06)`;
    ctx.fillRect(px + 2, py + 18, tileSize - 4, 2);
  }
}

// ──── 植被：大树 ────
function drawTree(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  treeSize: number, n1: number, n2: number
): void {
  // 树荫
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + treeSize * 0.55, treeSize * 0.45, treeSize * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 底层树冠
  ctx.fillStyle = tween(n2, "#2E7D32", "#388E3C");
  ctx.beginPath();
  ctx.arc(cx, cy - treeSize * 0.25, treeSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // 中层树冠
  ctx.fillStyle = tween(n1, "#43A047", "#4CAF50");
  ctx.beginPath();
  ctx.arc(cx - treeSize * 0.08, cy - treeSize * 0.35, treeSize * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // 高光层
  ctx.fillStyle = "#66BB6A";
  ctx.beginPath();
  ctx.arc(cx - treeSize * 0.15, cy - treeSize * 0.45, treeSize * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // 树干
  ctx.fillStyle = "#5D4037";
  const trunkW = treeSize * 0.12;
  const trunkH = treeSize * 0.4;
  ctx.fillRect(cx - trunkW / 2, cy + treeSize * 0.05, trunkW, trunkH);
}

// ──── 植被：灌木丛 ────
function drawBush(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  bushSize: number, n1: number, n2: number
): void {
  // 阴影
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + bushSize * 0.4, bushSize * 0.5, bushSize * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 灌木主体
  ctx.fillStyle = "#558B2F";
  ctx.beginPath();
  ctx.arc(cx, cy - bushSize * 0.05, bushSize * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // 亮层
  ctx.fillStyle = "#7CB342";
  ctx.beginPath();
  ctx.arc(cx - bushSize * 0.1, cy - bushSize * 0.15, bushSize * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// ──── 植被：花朵 ────
function drawFlower(
  ctx: CanvasRenderingContext2D, fx: number, fy: number,
  n2: number
): void {
  const colors = ["#FF69B4", "#FFD700", "#FF6347", "#E6E6FA", "#FF1493", "#FFA500", "#DA70D6"];
  const color = colors[Math.floor(n2 * colors.length)];

  // 花茎
  ctx.fillStyle = "#228B22";
  ctx.fillRect(fx + 3, fy + 3, 1, 5);

  // 花瓣
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(fx + 3, fy + 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 花心
  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.arc(fx + 3, fy + 2, 1, 0, Math.PI * 2);
  ctx.fill();
}

function tween(n: number, a: string, b: string): string {
  // 在两个 hex 颜色之间按 n 插值
  const ar = parseInt(a.substring(1, 3), 16);
  const ag = parseInt(a.substring(3, 5), 16);
  const ab = parseInt(a.substring(5, 7), 16);
  const br = parseInt(b.substring(1, 3), 16);
  const bg = parseInt(b.substring(3, 5), 16);
  const bb = parseInt(b.substring(5, 7), 16);
  const t = Math.max(0, Math.min(1, n));
  const r = Math.round(ar + (br - ar) * t);
  const gr = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${gr.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}
