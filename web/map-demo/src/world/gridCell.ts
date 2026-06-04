/**
 * 网格单元 —— 每格的完整数据，支持子瓦片 + 地势 + 水流
 */

export const SUB_TILE_COUNT = 4;
export const LOGIC_TILE_SIZE = 32;
export const SUB_TILE_SIZE = LOGIC_TILE_SIZE / SUB_TILE_COUNT;

export type SubTileTerrain = "grass" | "dirt" | "road" | "water" | "stone" | "farmland";

export interface GridCell {
  格子id: string;
  坐标: [number, number];
  地形: SubTileTerrain;
  子瓦片: (SubTileTerrain | null)[];
  地势: number[];
  水量: number[];
  资源?: { 可挖泥土: number; 可采石头: number; };
  地表?: { 踩踏度: number; 湿度: number; };
  占用?: { 建筑id?: string; 归属NPC?: string; 火堆id?: string; };
}

export function createGrassCell(x: number, y: number): GridCell {
  return {
    格子id: `c_${x}_${y}`, 坐标: [x, y], 地形: "grass",
    子瓦片: Array(16).fill(null),
    地势: Array(16).fill(5),
    水量: Array(16).fill(0),
    资源: { 可挖泥土: 50, 可采石头: 0 },
    地表: { 踩踏度: 0, 湿度: 50 },
  };
}

export function createWaterCell(x: number, y: number): GridCell {
  return {
    格子id: `c_${x}_${y}`, 坐标: [x, y], 地形: "water",
    子瓦片: Array(16).fill(null),
    地势: Array(16).fill(0),
    水量: Array(16).fill(80),
    资源: { 可挖泥土: 0, 可采石头: 0 },
    地表: { 踩踏度: 0, 湿度: 100 },
  };
}

export function createStoneCell(x: number, y: number): GridCell {
  return {
    格子id: `c_${x}_${y}`, 坐标: [x, y], 地形: "stone",
    子瓦片: Array(16).fill(null),
    地势: Array(16).fill(8),
    水量: Array(16).fill(0),
    资源: { 可挖泥土: 0, 可采石头: 50 },
    地表: { 踩踏度: 0, 湿度: 30 },
  };
}

export function subTileToPixel(sx: number, sy: number): [number, number] {
  return [sx * SUB_TILE_SIZE, sy * SUB_TILE_SIZE];
}

export function setSubTile(cell: GridCell, subX: number, subY: number, terrain: SubTileTerrain | null): void {
  const idx = subY * SUB_TILE_COUNT + subX;
  if (idx >= 0 && idx < 16) cell.子瓦片[idx] = terrain;
}

export function getSubTileTerrain(cell: GridCell, subX: number, subY: number): SubTileTerrain {
  const idx = subY * SUB_TILE_COUNT + subX;
  if (idx >= 0 && idx < 16) return cell.子瓦片[idx] ?? cell.地形;
  return cell.地形;
}

export function getElevation(cell: GridCell, subX: number, subY: number): number {
  const idx = subY * SUB_TILE_COUNT + subX;
  return cell.地势[idx] ?? 5;
}

export function setElevation(cell: GridCell, subX: number, subY: number, val: number): void {
  const idx = subY * SUB_TILE_COUNT + subX;
  if (idx >= 0 && idx < 16) cell.地势[idx] = Math.max(0, Math.min(10, val));
}

export function getWater(cell: GridCell, subX: number, subY: number): number {
  const idx = subY * SUB_TILE_COUNT + subX;
  return cell.水量[idx] ?? 0;
}

export function setWater(cell: GridCell, subX: number, subY: number, val: number): void {
  const idx = subY * SUB_TILE_COUNT + subX;
  if (idx >= 0 && idx < 16) cell.水量[idx] = Math.max(0, Math.min(100, val));
}

export function setCellTerrain(cell: GridCell, terrain: SubTileTerrain): void {
  cell.地形 = terrain;
  cell.子瓦片 = Array(16).fill(null);
  const elevMap: Record<string, number> = { grass: 5, dirt: 4, road: 3, water: 0, stone: 8, farmland: 5 };
  cell.地势 = Array(16).fill(elevMap[terrain] ?? 5);
  cell.水量 = Array(16).fill(terrain === "water" ? 80 : 0);
}
