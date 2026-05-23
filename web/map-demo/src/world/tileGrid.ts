/**
 * 地图格子层 — 每格一个「地表类型」属性（像图层像素，互斥）
 * 有路的格子就是道路，不再「草地 + 道路叠两层」
 */

import {
  type MapConfig,
  type RoadDef,
  getCurveRoadPoints,
} from "./mapData";

/** 格子地表类型（每格仅此一项） */
export enum CellTerrain {
  GRASS = 0,
  DIRT = 1,
  STONE = 2,
  WATER = 3,
  ROAD_EDGE = 4,   // 道路-路边
  ROAD_CENTER = 5, // 道路-路心
  ROAD_CROSS = 6,  // 道路-路口（多条路重叠）
}

export interface MapCell {
  terrain: CellTerrain;
}

const ROAD_KINDS = new Set([
  CellTerrain.ROAD_EDGE,
  CellTerrain.ROAD_CENTER,
  CellTerrain.ROAD_CROSS,
]);

function naturalTerrain(x: number, y: number, config: MapConfig): CellTerrain {
  const t = config.terrainGenerator(x, y, config);
  switch (t) {
    case 1: return CellTerrain.DIRT;
    case 3: return CellTerrain.STONE;
    case 4: return CellTerrain.WATER;
    default: return CellTerrain.GRASS;
  }
}

function getWidthOffsets(width: number): { offset: number; kind: CellTerrain }[] {
  const w = Math.max(1, width);
  if (w === 1) return [{ offset: 0, kind: CellTerrain.ROAD_CENTER }];
  const out: { offset: number; kind: CellTerrain }[] = [];
  for (let i = 0; i < w; i++) {
    const offset = i - Math.floor(w / 2);
    const isEdge = i === 0 || i === w - 1;
    out.push({ offset, kind: isEdge ? CellTerrain.ROAD_EDGE : CellTerrain.ROAD_CENTER });
  }
  return out;
}

function mergeKind(a: CellTerrain, b: CellTerrain): CellTerrain {
  if (a === CellTerrain.ROAD_CENTER || b === CellTerrain.ROAD_CENTER) return CellTerrain.ROAD_CENTER;
  if (a === CellTerrain.ROAD_EDGE || b === CellTerrain.ROAD_EDGE) return CellTerrain.ROAD_EDGE;
  return b;
}

function popcount16(n: number): number {
  let c = 0;
  let v = n;
  while (v) { c += v & 1; v >>= 1; }
  return c;
}

function rasterizeRoad(
  road: RoadDef,
  roadIndex: number,
  config: MapConfig,
  roadMask: Uint16Array,
  roadKinds: Uint8Array
): void {
  const w = config.width;
  const roadLen = Math.hypot(road.end[0] - road.start[0], road.end[1] - road.start[1]);
  const steps = Math.max(50, Math.ceil(roadLen * 4));
  const points = getCurveRoadPoints(road, steps);
  const offsets = getWidthOffsets(road.width ?? 1);
  const bit = 1 << roadIndex;

  function fillRoadCell(px: number, py: number): void {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix < 0 || ix >= w || iy < 0 || iy >= config.height) return;
    const idx = iy * w + ix;
    roadMask[idx] |= bit;
    const cur = roadKinds[idx] as CellTerrain;
    roadKinds[idx] = cur === 0 ? CellTerrain.ROAD_CENTER : mergeKind(cur, CellTerrain.ROAD_CENTER);
  }

  function fillRoadEdge(px: number, py: number): void {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix < 0 || ix >= w || iy < 0 || iy >= config.height) return;
    const idx = iy * w + ix;
    const cur = roadKinds[idx] as CellTerrain;
    if (cur === 0) {
      roadMask[idx] |= bit;
      roadKinds[idx] = CellTerrain.ROAD_EDGE;
    }
  }

  for (let i = 0; i < points.length; i++) {
    const px = points[i][0];
    const py = points[i][1];

    // 当前采样点的方向向量
    let dx: number, dy: number;
    if (i < points.length - 1) {
      dx = points[i + 1][0] - px;
      dy = points[i + 1][1] - py;
    } else {
      dx = px - points[i - 1][0];
      dy = py - points[i - 1][1];
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    for (const { offset, kind } of offsets) {
      const tx = px + nx * offset;
      const ty = py + ny * offset;
      if (kind === CellTerrain.ROAD_CENTER) {
        fillRoadCell(tx, ty);
      } else {
        fillRoadEdge(tx, ty);
      }
    }

    // 在当前点和下一个点之间做逐格插值
    if (i < points.length - 1) {
      const npx = points[i + 1][0];
      const npy = points[i + 1][1];
      const segDist = Math.hypot(npx - px, npy - py);
      if (segDist > 0.6) {
        const segSteps = Math.ceil(segDist * 2);
        const sdx = (npx - px) / segSteps;
        const sdy = (npy - py) / segSteps;
        for (let s = 1; s < segSteps; s++) {
          const ipx = px + sdx * s;
          const ipy = py + sdy * s;
          const sdLen = Math.hypot(sdx, sdy);
          const inx = -sdy / sdLen;
          const iny = sdx / sdLen;
          for (const { offset, kind } of offsets) {
            const tx = ipx + inx * offset;
            const ty = ipy + iny * offset;
            if (kind === CellTerrain.ROAD_CENTER) {
              fillRoadCell(tx, ty);
            } else {
              fillRoadEdge(tx, ty);
            }
          }
        }
      }
    }
  }
}

export function bakeMapCells(config: MapConfig): MapCell[][] {
  const w = config.width;
  const h = config.height;
  const size = w * h;
  const roadMask = new Uint16Array(size);
  const roadKinds = new Uint8Array(size);

  config.roads.forEach((road, i) => {
    if (i < 16) rasterizeRoad(road, i, config, roadMask, roadKinds);
  });

  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const idx = y * w + x;
      let terrain: CellTerrain;
      if (popcount16(roadMask[idx]) >= 2) {
        terrain = CellTerrain.ROAD_CROSS;
      } else if (roadMask[idx] !== 0) {
        terrain = roadKinds[idx] as CellTerrain;
      } else {
        terrain = naturalTerrain(x, y, config);
      }
      return { terrain };
    })
  );
}

export class TileGrid {
  private cells: MapCell[][];
  readonly width: number;
  readonly height: number;

  constructor(config: MapConfig) {
    this.width = config.width;
    this.height = config.height;
    this.cells = bakeMapCells(config);
  }

  getCell(x: number, y: number): MapCell | null {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (iy < 0 || iy >= this.height || ix < 0 || ix >= this.width) return null;
    return this.cells[iy][ix];
  }

  /** @deprecated 用 getCell */
  getTile(x: number, y: number): MapCell | null {
    return this.getCell(x, y);
  }

  getTerrain(x: number, y: number): CellTerrain {
    return this.getCell(x, y)?.terrain ?? CellTerrain.GRASS;
  }

  isRoad(x: number, y: number): boolean {
    return ROAD_KINDS.has(this.getTerrain(x, y));
  }

  hasRoad(x: number, y: number): boolean {
    return this.isRoad(x, y);
  }

  isRoadKind(x: number, y: number, kind: CellTerrain): boolean {
    return this.getTerrain(x, y) === kind;
  }
}
