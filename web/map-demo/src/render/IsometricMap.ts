/**
 * 等距 2.5D 地图渲染器 v6 — 视觉升级版
 *
 * 第一次渲染→烘焙整图到 offscreen Canvas
 * 后续帧→直接用 drawImage 复制可见区域（O(1) 每帧，不管地图多大）
 */

import { CellTerrain, type TileGrid } from "../world/tileGrid";
import { type BuildingDef } from "../world/mapData";

const TILE_W = 64, TILE_H = 32;
const HW = 32, HH = 16, HS = 4, WD = 3;

// ==================== 颜色系统（更丰富的调色板）====================

const GRASS_COLORS = [
  { t: "#6B9E42", l: "#5A8A38", r: "#4A7A30" },
  { t: "#7CB342", l: "#6A9E38", r: "#5A8E30" },
  { t: "#5D8C3A", l: "#4D7C32", r: "#3D6C28" },
  { t: "#8BC34A", l: "#7AAF40", r: "#6A9F38" },
];

const DIRT_COLORS = [
  { t: "#B8956A", l: "#A08055", r: "#8B7048" },
  { t: "#A08050", l: "#8B7040", r: "#7A6038" },
  { t: "#C4A574", l: "#B09060", r: "#9A8050" },
  { t: "#9A7B55", l: "#8A6B48", r: "#7A5B40" },
];

const STONE_COLORS = [
  { t: "#9A9A9A", l: "#8A8A8A", r: "#7A7A7A" },
  { t: "#A8A8A8", l: "#989898", r: "#888888" },
  { t: "#B8B8B8", l: "#A8A8A8", r: "#989898" },
  { t: "#8A8A8A", l: "#7A7A7A", r: "#6A6A6A" },
];

const WATER_COLORS = [
  { t: "#4A9BC8", l: "#3A8BB8", r: "#2A7BA8" },
  { t: "#5AABD8", l: "#4A9BC8", r: "#3A8BB8" },
  { t: "#3A8BB8", l: "#2A7BA8", r: "#1E6B98" },
  { t: "#6BBBE8", l: "#5AABD8", r: "#4A9BC8" },
];

const ROAD_COLORS = [
  { t: "#C4A05A", l: "#B09050", r: "#A08048" },
  { t: "#B09050", l: "#A08048", r: "#907040" },
  { t: "#D0B070", l: "#C0A060", r: "#B09050" },
  { t: "#A08048", l: "#907040", r: "#806038" },
];

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function elev(t: CellTerrain): number {
  if (t === CellTerrain.WATER) return 0;
  if (t === CellTerrain.DIRT) return 3;
  if (t === CellTerrain.STONE) return 8;
  if (t >= CellTerrain.ROAD_EDGE) return t === CellTerrain.ROAD_EDGE ? 5 : 4;
  return 5;
}

function tc(t: CellTerrain, x: number, y: number) {
  const h = hash2D(x, y);
  const idx = Math.floor(h * 4);
  
  if (t === CellTerrain.WATER) return WATER_COLORS[idx];
  if (t === CellTerrain.STONE) return STONE_COLORS[idx];
  if (t === CellTerrain.DIRT) return DIRT_COLORS[idx];
  if (t >= CellTerrain.ROAD_EDGE) return ROAD_COLORS[idx];
  return GRASS_COLORS[idx];
}

function dim(hex: string, f: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}

function lighten(hex: string, f: number): string {
  return dim(hex, 1 + f);
}

// ============ 离屏缓存 ============
let bakedCanvas: HTMLCanvasElement | null = null;
let bakedMapW = 0, bakedMapH = 0;
let totalWorldW = 0, totalWorldH = 0;
export function invalidateCache() { 
  bakedCanvas = null; 
  console.log('[IsometricMap] 缓存已清除，下次渲染将重新烘焙');
}

// ============ 菱形绘制 ============
function drawBlock(ctx: CanvasRenderingContext2D, ox: number, oy: number, sideH: number, hw: number, hh: number, colT: string, colL: string, colR: string) {
  ctx.fillStyle = colL;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - hw, oy + hh); ctx.lineTo(ox - hw, oy + hh + sideH); ctx.lineTo(ox, oy + sideH); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colR;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + hw, oy + hh); ctx.lineTo(ox + hw, oy + hh + sideH); ctx.lineTo(ox, oy + sideH); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colT;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - hw, oy + hh); ctx.lineTo(ox, oy + hh * 2); ctx.lineTo(ox + hw, oy + hh); ctx.closePath(); ctx.fill();
}

// ============ 等距面参数化绘制 ============
function facePoint(corners: [number, number][], u: number, v: number): [number, number] {
  const [A, B, C, D] = corners;
  return [
    (1-u)*(1-v)*A[0] + u*(1-v)*B[0] + u*v*C[0] + (1-u)*v*D[0],
    (1-u)*(1-v)*A[1] + u*(1-v)*B[1] + u*v*C[1] + (1-u)*v*D[1]
  ];
}

function drawFaceRect(ctx: CanvasRenderingContext2D, corners: [number, number][], u1: number, v1: number, u2: number, v2: number, color: string) {
  const p1 = facePoint(corners, u1, v1);
  const p2 = facePoint(corners, u2, v1);
  const p3 = facePoint(corners, u2, v2);
  const p4 = facePoint(corners, u1, v2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
  ctx.fill();
}

// ============ 绘制等距树木 ============
function drawIsoTree(ctx: CanvasRenderingContext2D, hw: number, hh: number, n1: number, n2: number) {
  const treeH = 18 + n2 * 8;
  const trunkW = 4;
  
  // 树干
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(-trunkW/2, -treeH, trunkW, treeH);
  ctx.fillStyle = "#4A3328";
  ctx.fillRect(-trunkW/4, -treeH + 2, trunkW/2, treeH - 4);
  
  // 树冠 - 多层菱形
  const crownColors = [
    { t: "#2E7D32", l: "#1E6D22", r: "#0E5D12" },
    { t: "#43A047", l: "#339037", r: "#238027" },
    { t: "#66BB6A", l: "#56AB5A", r: "#469B4A" },
  ];
  
  for (let i = 0; i < 3; i++) {
    const layerY = -treeH - 4 - i * 6;
    const layerSize = 1.2 - i * 0.25;
    const c = crownColors[i];
    drawBlock(ctx, 0, layerY, 4, hw * layerSize, hh * layerSize, c.t, c.l, c.r);
  }
  
  // 顶部高光
  ctx.fillStyle = "#81C784";
  ctx.beginPath();
  ctx.moveTo(0, -treeH - 22);
  ctx.lineTo(-hw * 0.3, -treeH - 18);
  ctx.lineTo(0, -treeH - 14);
  ctx.lineTo(hw * 0.3, -treeH - 18);
  ctx.closePath();
  ctx.fill();
}

// ============ 绘制等距灌木 ============
function drawIsoBush(ctx: CanvasRenderingContext2D, hw: number, hh: number, n1: number, n2: number) {
  const bushColors = [
    { t: "#558B2F", l: "#457B1F", r: "#356B0F" },
    { t: "#689F38", l: "#588F28", r: "#487F18" },
    { t: "#7CB342", l: "#6CA332", r: "#5C9322" },
  ];
  
  for (let i = 0; i < 2; i++) {
    const layerY = -4 - i * 5;
    const layerSize = 0.8 - i * 0.2;
    const c = bushColors[i];
    drawBlock(ctx, 0, layerY, 3, hw * layerSize, hh * layerSize, c.t, c.l, c.r);
  }
  
  // 小果实
  if (n2 > 0.7) {
    ctx.fillStyle = n1 > 0.5 ? "#FF69B4" : "#FFD700";
    ctx.beginPath();
    ctx.arc(hw * 0.3, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============ 绘制等距花朵 ============
function drawIsoFlower(ctx: CanvasRenderingContext2D, n2: number) {
  const colors = ["#FF69B4", "#FFD700", "#FF6347", "#E6E6FA", "#FF1493", "#FFA500", "#DA70D6"];
  const color = colors[Math.floor(n2 * colors.length)];
  
  // 花茎
  ctx.fillStyle = "#228B22";
  ctx.fillRect(-0.5, -6, 1, 6);
  
  // 花瓣
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  // 花心
  ctx.fillStyle = "#FFD700";
  ctx.beginPath();
  ctx.arc(0, -7, 1, 0, Math.PI * 2);
  ctx.fill();
}

// ============ 绘制等距高草 ============
function drawIsoTallGrass(ctx: CanvasRenderingContext2D, n1: number, n2: number) {
  const colors = ["#7CB342", "#8BC34A", "#689F38", "#558B2F"];
  const color = colors[Math.floor(n1 * colors.length)];
  
  ctx.fillStyle = color;
  ctx.fillRect(-2, -4, 1, 4 + n2 * 2);
  ctx.fillRect(0, -5, 1, 5 + n1 * 2);
  ctx.fillRect(2, -3, 1, 3 + n2 * 2);
}

// ============ 烘焙整图 ============
function bakeMap(grid: TileGrid, mapW: number, mapH: number, buildings: BuildingDef[]) {
  const worldW = (mapW - 1 + mapH - 1) * HW + TILE_W;
  const worldH = (mapW - 1 + mapH - 1) * HH + TILE_H * 2 + 10 * HS;

  const minWX = -(mapH - 1) * HW;
  const minWY = 0;

  const canvas = document.createElement("canvas");
  canvas.width = worldW;
  canvas.height = worldH;
  const ctx = canvas.getContext("2d")!;

  totalWorldW = worldW;
  totalWorldH = worldH;

  const offsetX = -minWX;
  const offsetY = 20;

  // 建筑格子映射
  const cellBld = new Map<number, number>();
  const drawnBld = new Set<number>();
  for (let bi = 0; bi < buildings.length; bi++) {
    const [x1, y1, x2, y2] = buildings[bi].bounds;
    for (let by = y1; by <= y2; by++)
      for (let bx = x1; bx <= x2; bx++)
        cellBld.set(by * mapW + bx, bi);
  }

  function toWorld(mx: number, my: number, e: number): [number, number] {
    return [offsetX + (mx - my) * HW, offsetY + (mx + my) * HH - e * HS];
  }

  for (let sum = 0; sum <= (mapW - 1) + (mapH - 1); sum++) {
    for (let mx = Math.max(0, sum - (mapH - 1)); mx <= Math.min(mapW - 1, sum); mx++) {
      const my = sum - mx;
      const cell = grid.getCell(mx, my);
      if (!cell) continue;

      const bi = cellBld.get(my * mapW + mx);
      const isBld = bi !== undefined && bi !== null;
      const cellE = isBld ? 5 : elev(cell.terrain);
      const [sx, sy] = toWorld(mx, my, cellE);
      const water = !isBld && cell.terrain === CellTerrain.WATER ? WD : 0;
      const n1 = hash2D(mx, my);
      const n2 = hash2D(mx + 100, my + 100);

      ctx.save();
      ctx.translate(sx, sy);

      if (isBld) {
        if (drawnBld.has(bi!)) { ctx.restore(); continue; }
        drawnBld.add(bi!);
        const b = buildings[bi!];
        const [bx1, by1, bx2, by2] = b.bounds;
        const bW = bx2 - bx1 + 1;  // 建筑宽度（格数）
        const bH = by2 - by1 + 1;  // 建筑深度（格数）
        const bHw = bW * HW;       // 建筑半宽（像素）
        const bHh = bH * HH;       // 建筑半深（像素）
        const bc = b.color || "#8B6914";
        
        // 在当前瓦片位置绘制建筑（ctx已经translate到瓦片位置）
        // 建筑占据多个瓦片，只在第一个瓦片绘制一次
        
        // 建筑类型判断
        const bName = b.name || "";
        const isHouse = bName.includes("家") || bName.includes("屋") || bName.includes("房");
        const isShop = bName.includes("店") || bName.includes("铺") || bName.includes("商");
        const isPlaza = bName.includes("广场") || bName.includes("中心");
        const isField = bName.includes("田") || bName.includes("地");
        
        const baseH = 6 * HS;
        const baseColor = "#8d6e63";
        const baseColorL = "#7d5e53";
        const baseColorR = "#6d4c41";
        
        drawBlock(ctx, 0, 0, baseH, bHw, bHh, baseColor, baseColorL, baseColorR);
        
        if (!isField) {
          if (isPlaza) {
            const colH = 12;
            ctx.fillStyle = "#D4C4B0";
            ctx.fillRect(-bHw * 0.5, -baseH - colH, 4, colH);
            ctx.fillRect(bHw * 0.3, -baseH - colH, 4, colH);
          } else {
            const wHw = bHw * 0.8;
            const wHh = bHh * 0.8;
            const rHw = bHw * 0.95;
            const rHh = bHh * 0.95;
            const wallH = isHouse ? 22 : 16;
            const slabH = 3;
            const peakH = isHouse ? 12 : 8;
            
            // ===== 1. 墙体主体（drawBlock保证等距透视正确）=====
            const wallTop = isHouse ? "#FFF8E1" : "#F5F5F5";
            const wallLeft = isHouse ? "#FFE0B2" : "#E0E0E0";
            const wallRight = isHouse ? "#FFCC80" : "#BDBDBD";
            drawBlock(ctx, 0, -wallH, wallH, wHw, wHh, wallTop, wallLeft, wallRight);
            
            // ===== 2. 门（左面=正面，用参数化精确定位）=====
            const leftFace: [number, number][] = [
              [0, -wallH],
              [-wHw, -wallH + wHh],
              [-wHw, wHh],
              [0, 0],
            ];
            drawFaceRect(ctx, leftFace, 0.30, 0.45, 0.70, 0.97, "#3E2723");
            drawFaceRect(ctx, leftFace, 0.34, 0.48, 0.66, 0.94, "#5D4037");
            drawFaceRect(ctx, leftFace, 0.38, 0.52, 0.62, 0.90, "#4E342E");
            const hp = facePoint(leftFace, 0.58, 0.72);
            ctx.fillStyle = "#FFD700";
            ctx.beginPath();
            ctx.arc(hp[0], hp[1], 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // ===== 3. 窗户 =====
            if (isHouse) {
              drawFaceRect(ctx, leftFace, 0.03, 0.22, 0.24, 0.42, "#3E2723");
              drawFaceRect(ctx, leftFace, 0.06, 0.25, 0.21, 0.39, "#87CEEB");
              drawFaceRect(ctx, leftFace, 0.76, 0.22, 0.97, 0.42, "#3E2723");
              drawFaceRect(ctx, leftFace, 0.79, 0.25, 0.94, 0.39, "#87CEEB");
            } else {
              drawFaceRect(ctx, leftFace, 0.02, 0.18, 0.27, 0.55, "#3E2723");
              drawFaceRect(ctx, leftFace, 0.05, 0.21, 0.24, 0.52, "#87CEEB");
              drawFaceRect(ctx, leftFace, 0.73, 0.18, 0.98, 0.55, "#3E2723");
              drawFaceRect(ctx, leftFace, 0.76, 0.21, 0.95, 0.52, "#87CEEB");
            }
            
            const rightFace: [number, number][] = [
              [0, -wallH],
              [wHw, -wallH + wHh],
              [wHw, wHh],
              [0, 0],
            ];
            drawFaceRect(ctx, rightFace, 0.25, 0.22, 0.75, 0.42, "#3E2723");
            drawFaceRect(ctx, rightFace, 0.29, 0.25, 0.71, 0.39, "#87CEEB");
            
            // ===== 4. 屋檐板（drawBlock画薄板，比墙宽=出檐）=====
            drawBlock(ctx, 0, -wallH - slabH, slabH, rHw, rHh, "#D32F2F", "#C62828", "#B71C1C");
            
            // ===== 5. 人字形屋顶（前坡+后坡）=====
            const roofBaseY = -wallH - slabH;
            const ridgeY = roofBaseY + rHh - peakH;
            
            ctx.fillStyle = "#8E0000";
            ctx.beginPath();
            ctx.moveTo(-rHw, ridgeY);
            ctx.lineTo(-rHw, roofBaseY + rHh);
            ctx.lineTo(0, roofBaseY);
            ctx.lineTo(rHw, roofBaseY + rHh);
            ctx.lineTo(rHw, ridgeY);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = "#C62828";
            ctx.beginPath();
            ctx.moveTo(-rHw, ridgeY);
            ctx.lineTo(-rHw, roofBaseY + rHh);
            ctx.lineTo(0, roofBaseY + rHh * 2);
            ctx.lineTo(rHw, roofBaseY + rHh);
            ctx.lineTo(rHw, ridgeY);
            ctx.closePath();
            ctx.fill();
            
            ctx.strokeStyle = "#FF5252";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-rHw, ridgeY);
            ctx.lineTo(rHw, ridgeY);
            ctx.stroke();
            
            // ===== 6. 烟囱 =====
            if (n1 > 0.5) {
              const cx = rHw * 0.4;
              ctx.fillStyle = "#795548";
              ctx.fillRect(cx - 3, ridgeY - 10, 6, 10);
              ctx.fillStyle = "#5D4037";
              ctx.fillRect(cx - 3.5, ridgeY - 11, 7, 2);
              if (n2 > 0.3) {
                ctx.fillStyle = "rgba(200,200,200,0.4)";
                ctx.beginPath();
                ctx.arc(cx, ridgeY - 14, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + 1, ridgeY - 17, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        } else {
          ctx.fillStyle = "#8D6E63";
          ctx.fillRect(-bHw * 0.5, -4, bHw, 4);
        }
        
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.moveTo(-bHw, baseH + 2);
        ctx.lineTo(0, baseH + bHh + 2);
        ctx.lineTo(bHw, baseH + 2);
        ctx.lineTo(0, baseH - bHh + 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        continue;
      }

      const c = tc(cell.terrain, mx, my);
      drawBlock(ctx, 0, 0, cellE * HS, HW, HH, c.t, c.l, c.r);

      // 地形纹理细节
      if (cell.terrain === CellTerrain.GRASS) {
        // 草地纹理 - 随机小色块
        if (n1 > 0.5) {
          ctx.fillStyle = n2 > 0.5 ? "#8BC34A" : "#689F38";
          ctx.globalAlpha = 0.3;
          ctx.fillRect(-10 + n1 * 20, 2, 3, 2);
          ctx.globalAlpha = 1;
        }
      } else if (cell.terrain === CellTerrain.DIRT) {
        // 泥土纹理
        if (n2 > 0.6) {
          ctx.fillStyle = "#A08050";
          ctx.globalAlpha = 0.4;
          ctx.fillRect(-8 + n1 * 16, 4, 4, 2);
          ctx.globalAlpha = 1;
        }
      } else if (cell.terrain === CellTerrain.STONE) {
        // 石头纹理 - 砖缝
        ctx.strokeStyle = "rgba(80,80,80,0.3)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(0, 10);
        ctx.moveTo(0, 0); ctx.lineTo(10, 10);
        ctx.stroke();
      } else if (cell.terrain === CellTerrain.ROAD_CENTER || cell.terrain === CellTerrain.ROAD_EDGE) {
        // 道路车辙
        if (n1 > 0.7) {
          ctx.fillStyle = "rgba(100,80,50,0.2)";
          ctx.fillRect(-12, 6, 24, 1);
        }
      }

      // 水体效果
      if (water > 0) {
        const wo = water * HS;
        ctx.fillStyle = "rgba(66,165,245,0.55)";
        ctx.beginPath(); ctx.moveTo(0, -wo); ctx.lineTo(-HW, HH - wo); ctx.lineTo(0, HH * 2 - wo); ctx.lineTo(HW, HH - wo); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath(); ctx.moveTo(0, -wo); ctx.lineTo(-HW, HH - wo); ctx.lineTo(0, HH * 2 - wo); ctx.lineTo(HW, HH - wo); ctx.closePath(); ctx.fill();
      }

      // 植被
      if (cell.terrain === CellTerrain.GRASS && n1 > 0.94) {
        drawIsoTree(ctx, HW, HH, n1, n2);
      } else if (cell.terrain === CellTerrain.GRASS && n1 > 0.88 && n1 <= 0.94) {
        drawIsoBush(ctx, HW, HH, n1, n2);
      } else if (cell.terrain === CellTerrain.GRASS && n1 > 0.82 && n1 <= 0.88 && n2 > 0.45) {
        drawIsoFlower(ctx, n2);
      } else if (cell.terrain === CellTerrain.GRASS && n1 > 0.75 && n1 <= 0.82) {
        drawIsoTallGrass(ctx, n1, n2);
      }

      ctx.restore();
    }
  }

  bakedCanvas = canvas;
  bakedMapW = mapW;
  bakedMapH = mapH;
}

// ============ 主渲染（极快——只 drawImage） ============
export function renderIsoMap(
  ctx: CanvasRenderingContext2D,
  grid: TileGrid, mapW: number, mapH: number,
  buildings: BuildingDef[],
  zoom: number, px: number, py: number,
  _vw: number, _vh: number,
): void {
  // 首次/失效时烘焙
  if (!bakedCanvas || bakedMapW !== mapW || bakedMapH !== mapH) {
    bakeMap(grid, mapW, mapH, buildings);
  }

  const sw = ctx.canvas.width, sh = ctx.canvas.height;

  const minWX = -(mapH - 1) * HW;

  const srcW = sw / zoom;
  const srcH = sh / zoom;

  const sx = px - srcW / 2;
  const sy = py - srcH / 2;

  ctx.drawImage(bakedCanvas!,
    sx, sy, srcW, srcH,
    0, 0, sw, sh,
  );
}

// ============ 坐标转换：网格→等距世界 ============
export function gridToIso(x: number, y: number): [number, number] {
  const minWX = -(300 - 1) * HW; // 假设最大地图高度
  const offsetX = -minWX;
  const offsetY = 20;
  return [
    offsetX + (x - y) * HW,
    offsetY + (x + y) * HH - 5 * HS
  ];
}

// ============ 坐标转换：等距世界→网格（近似） ============
export function isoToGrid(wx: number, wy: number): [number, number] {
  const minWX = -(300 - 1) * HW;
  const offsetX = -minWX;
  const offsetY = 20;
  const sx = wx - offsetX;
  const sy = wy - offsetY + 5 * HS;
  const x = (sx / HW + sy / HH) / 2;
  const y = (sy / HH - sx / HW) / 2;
  return [Math.round(x), Math.round(y)];
}
