/**
 * 🔀 A* 寻路 — 替代直线移动
 * 地形代价：草地=1, 泥土=1, 石头=3, 水=不可通, 建筑=不可通
 */

import { MapManager } from "../world/mapData";

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathFinder {
  findPath(sx: number, sy: number, tx: number, ty: number, map: MapManager): [number, number][] {
    const startX = Math.floor(sx);
    const startY = Math.floor(sy);
    const targetX = Math.floor(tx);
    const targetY = Math.floor(ty);

    if (!map.isPassable(targetX, targetY)) return [];

    const open: PathNode[] = [];
    const closed: Set<string> = new Set();
    const key = (x: number, y: number) => `${x},${y}`;

    open.push({ x: startX, y: startY, g: 0, h: this.heuristic(startX, startY, targetX, targetY), f: 0, parent: null });

    let safety = 0;
    while (open.length > 0 && safety < 5000) {
      safety++;

      // 选 f 最小
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const current = open[bestIdx];
      open.splice(bestIdx, 1);

      if (current.x === targetX && current.y === targetY) {
        return this.reconstructPath(current);
      }

      closed.add(key(current.x, current.y));

      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nk = key(nx, ny);

        if (closed.has(nk)) continue;
        if (!map.isPassable(nx, ny)) continue;

        const cost = this.terrainCost(nx, ny, map);
        const ng = current.g + cost;

        const existingOpen = open.find(o => o.x === nx && o.y === ny);
        if (existingOpen) {
          if (ng < existingOpen.g) {
            existingOpen.g = ng;
            existingOpen.f = ng + existingOpen.h;
            existingOpen.parent = current;
          }
          continue;
        }

        const nh = this.heuristic(nx, ny, targetX, targetY);
        open.push({ x: nx, y: ny, g: ng, h: nh, f: ng + nh, parent: current });
      }
    }

    return [];
  }

  private heuristic(x: number, y: number, tx: number, ty: number): number {
    return Math.abs(x - tx) + Math.abs(y - ty);
  }

  private terrainCost(x: number, y: number, map: MapManager): number {
    const t = map.getTerrainAt(x, y);
    switch (t) {
      case 0: return 1; // grass
      case 1: return 1; // dirt
      case 2: return 1; // stone
      case 3: return 1; // water
      case 4: return 2; // building
      case 5: return 1; // road
      default: return 1;
    }
  }

  private reconstructPath(node: PathNode): [number, number][] {
    const path: [number, number][] = [];
    let current: PathNode | null = node;
    while (current) {
      path.unshift([current.x, current.y]);
      current = current.parent;
    }
    return path;
  }
}
