/**
 * 水流模拟引擎 v3 —— 增强现实感水流
 *
 * 核心物理：
 *   表面水位 = 地势 + 水量/WK
 *   水从高表面流向低表面
 *   重力效应：下坡时流速加快
 *   8方向流动：对角线也让水自然扩散
 *   连通水体趋于等水平面
 *
 * 参数：
 *   WK = 20（水量100 → 5格高度）
 *   ITERATIONS = 12（每Tick跑更多轮，水更快平衡）
 *   GRAVITY = 1.5（重力系数，下坡加速）
 *   DIAGONAL_FLOW = true（开启对角线流）
 */

import {
  SUB_TILE_COUNT, getElevation, setElevation, getWater, setWater, type GridCell
} from "../world/gridCell";

const WK = 20;
const ITERATIONS = 12;
const GRAVITY = 1.5;
const MIN_WATER = 0.3;
const BASE_FLOW = 0.45;

interface WaterVelocity {
  vx: number;
  vy: number;
}

const velocityMap = new Map<string, WaterVelocity>();

function getVelocityKey(cx: number, cy: number, sx: number, sy: number): string {
  return `${cx},${cy},${sx},${sy}`;
}

function surface(water: number, elev: number): number {
  return elev + water / WK;
}

function getNeighborDirs(diagonal: boolean): [number, number, number][] {
  const dirs: [number, number, number][] = [[0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1]];
  if (diagonal) {
    dirs.push([-1, -1, 0.707], [1, -1, 0.707], [-1, 1, 0.707], [1, 1, 0.707]);
  }
  return dirs;
}

function resolveSub(cellCoord: number, subCoord: number, delta: number): [number, number] {
  let nc = cellCoord, ns = subCoord + delta;
  if (ns < 0) { nc--; ns = SUB_TILE_COUNT - 1; }
  else if (ns >= SUB_TILE_COUNT) { nc++; ns = 0; }
  return [nc, ns];
}

export function tickWaterFlow(
  grid: GridCell[][], mapW: number, mapH: number,
  options: { diagonal?: boolean; iterations?: number } = {}
): { transfers: number; totalWater: number; maxSurface: number; minSurface: number } {
  const diagonal = options.diagonal ?? true;
  const iterations = options.iterations ?? ITERATIONS;

  let transfers = 0;
  let totalWater = 0;
  let maxSurface = -Infinity, minSurface = Infinity;

  for (let iter = 0; iter < iterations; iter++) {
    for (let cy = 0; cy < mapH; cy++) {
      for (let cx = 0; cx < mapW; cx++) {
        const cell = grid[cy]?.[cx];
        if (!cell) continue;

        for (let sy = 0; sy < SUB_TILE_COUNT; sy++) {
          for (let sx = 0; sx < SUB_TILE_COUNT; sx++) {
            const wHere = getWater(cell, sx, sy);
            if (wHere <= MIN_WATER) continue;

            const eHere = getElevation(cell, sx, sy);
            const surfHere = surface(wHere, eHere);

            const dirs = getNeighborDirs(diagonal);
            for (const [dx, dy, diagMult] of dirs) {
              const [ncx, nsx] = resolveSub(cx, sx, dx);
              const [ncy, nsy] = resolveSub(cy, sy, dy);
              const nCell = grid[ncy]?.[ncx];
              if (!nCell) continue;

              const wThere = getWater(nCell, nsx, nsy);
              const eThere = getElevation(nCell, nsx, nsy);
              const surfThere = surface(wThere, eThere);

              const deltaSurface = surfHere - surfThere;
              if (deltaSurface <= 0.01) continue;

              const slopeFactor = eThere < eHere ? GRAVITY : 1.0;
              const flowCoeff = BASE_FLOW * diagMult * slopeFactor;
              const want = Math.min(deltaSurface * flowCoeff * 25, wHere * 0.5);
              const actual = Math.max(MIN_WATER, Math.min(want, wHere, (100 - wThere)));

              if (actual <= MIN_WATER) continue;

              setWater(cell, sx, sy, wHere - actual);
              setWater(nCell, nsx, nsy, wThere + actual);

              const vKey = getVelocityKey(cx, cy, sx, sy);
              const vel = velocityMap.get(vKey) || { vx: 0, vy: 0 };
              vel.vx = (vel.vx * 0.7 + dx * actual * 0.3);
              vel.vy = (vel.vy * 0.7 + dy * actual * 0.3);
              velocityMap.set(vKey, vel);

              transfers++;
            }

            const vKey = getVelocityKey(cx, cy, sx, sy);
            const vel = velocityMap.get(vKey);
            if (vel) {
              vel.vx *= 0.85;
              vel.vy *= 0.85;
              if (Math.abs(vel.vx) < 0.1) vel.vx = 0;
              if (Math.abs(vel.vy) < 0.1) vel.vy = 0;
            }
          }
        }
      }
    }
  }

  for (let cy = 0; cy < mapH; cy++) {
    for (let cx = 0; cx < mapW; cx++) {
      const cell = grid[cy]?.[cx];
      if (!cell) continue;
      for (let sy = 0; sy < SUB_TILE_COUNT; sy++) {
        for (let sx = 0; sx < SUB_TILE_COUNT; sx++) {
          const w = getWater(cell, sx, sy);
          const s = surface(w, getElevation(cell, sx, sy));
          totalWater += w;
          if (w > 0) {
            if (s > maxSurface) maxSurface = s;
            if (s < minSurface) minSurface = s;
          }
        }
      }
    }
  }

  return { transfers, totalWater, maxSurface: isFinite(maxSurface) ? maxSurface : 0, minSurface: isFinite(minSurface) ? minSurface : 0 };
}

export function addWaterToSubTile(
  grid: GridCell[][], cx: number, cy: number, sx: number, sy: number, amount: number
): void {
  const cell = grid[cy]?.[cx];
  if (!cell) return;
  setWater(cell, sx, sy, getWater(cell, sx, sy) + amount);
}

export function removeWaterFromSubTile(
  grid: GridCell[][], cx: number, cy: number, sx: number, sy: number, amount: number
): void {
  const cell = grid[cy]?.[cx];
  if (!cell) return;
  setWater(cell, sx, sy, Math.max(0, getWater(cell, sx, sy) - amount));
}

export function digTile(
  grid: GridCell[][], cx: number, cy: number, sx: number, sy: number, amount: number = 1
): void {
  const cell = grid[cy]?.[cx];
  if (!cell) return;
  const elev = getElevation(cell, sx, sy);
  const newElev = Math.max(0, elev - amount);
  setElevation(cell, sx, sy, newElev);

  const idx = sy * SUB_TILE_COUNT + sx;
  cell.子瓦片[idx] = newElev <= 0 ? "water" : "dirt";
}

export function fillTile(
  grid: GridCell[][], cx: number, cy: number, sx: number, sy: number, amount: number = 1
): void {
  const cell = grid[cy]?.[cx];
  if (!cell) return;
  const elev = getElevation(cell, sx, sy);
  setElevation(cell, sx, sy, Math.min(10, elev + amount));

  const wHere = getWater(cell, sx, sy);
  if (wHere > 0) {
    const displaced = Math.min(wHere, 30);
    setWater(cell, sx, sy, wHere - displaced);
    const dirs: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const per = displaced / 4;
    for (const [dx, dy] of dirs) {
      const [ncx, nsx] = resolveSub(cx, sx, dx);
      const [ncy, nsy] = resolveSub(cy, sy, dy);
      if (grid[ncy]?.[ncx]) addWaterToSubTile(grid, ncx, ncy, nsx, nsy, per);
    }
  }

  const idx = sy * SUB_TILE_COUNT + sx;
  cell.子瓦片[idx] = "dirt";
}
