/**
 * 地图数据系统 - 通用地图定义
 * 支持任意地图配置，不硬编码特定场景
 */

import { TileGrid } from "./tileGrid";
import { RoadNetwork, type RoadPath } from "./roadNetwork";

// ==================== 地形类型 ====================
export enum TerrainType {
  GRASS = 0,    // 草地 - 可通行
  DIRT = 1,     // 泥土 - 可通行
  ROAD = 2,     // 道路 - 可通行
  STONE = 3,    // 石头 - 不可通行
  WATER = 4,    // 水面 - 不可通行
  BUILDING = 5, // 建筑 - 不可通行
  WALL = 6,     // 围墙 - 不可通行
}

// 可通行地形
export const PASSABLE_TERRAIN = [TerrainType.GRASS, TerrainType.DIRT, TerrainType.ROAD];

// 地形颜色
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.GRASS]: "#7cb342",
  [TerrainType.DIRT]: "#8d6e63",
  [TerrainType.ROAD]: "#bdbdbd",
  [TerrainType.STONE]: "#757575",
  [TerrainType.WATER]: "#42a5f5",
  [TerrainType.BUILDING]: "#5d4037",
  [TerrainType.WALL]: "#424242",
};

// ==================== 地图配置接口 ====================
export interface MapConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  // 地形生成器
  terrainGenerator: TerrainGenerator;
  // 建筑列表
  buildings: BuildingDef[];
  // 道路网络
  roads: RoadDef[];
  // 初始NPC位置
  spawnPoints: SpawnPoint[];
}

// 地形生成器函数类型
export type TerrainGenerator = (x: number, y: number, config: MapConfig) => TerrainType;

// 建筑定义
export interface BuildingDef {
  id: string;
  name: string;
  type: string;
  owner?: string;
  // 矩形区域 [x1, y1, x2, y2]
  bounds: [number, number, number, number];
  // 入口位置
  entrance?: [number, number];
  // 颜色（可选）
  color?: string;
}

// 道路定义
export interface RoadDef {
  // 道路类型: horizontal | vertical | path | curve
  type: "horizontal" | "vertical" | "cross" | "path" | "curve";
  // 起点和终点 [x, y]
  start: [number, number];
  end: [number, number];
  // 道路宽度（默认1格）
  width?: number;
  // 曲线控制点（仅curve类型使用）
  controlPoints?: [number, number][];
}

// 出生点
export interface SpawnPoint {
  id: string;
  x: number;
  y: number;
  type: "player" | "npc" | "random";
}

// ==================== 通用工具函数 ====================

/**
 * 检查点是否在矩形内
 */
export function pointInRect(
  x: number, y: number,
  x1: number, y1: number, x2: number, y2: number
): boolean {
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

/**
 * 二次贝塞尔曲线采样
 */
function quadraticBezierPoint(p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] {
  const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
  const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
  return [x, y];
}

/**
 * 三次贝塞尔曲线采样
 */
function cubicBezierPoint(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t: number): [number, number] {
  const x = (1 - t) * (1 - t) * (1 - t) * p0[0] + 3 * (1 - t) * (1 - t) * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t * t * t * p3[0];
  const y = (1 - t) * (1 - t) * (1 - t) * p0[1] + 3 * (1 - t) * (1 - t) * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

/**
 * 获取曲线道路上的点
 */
export function getCurveRoadPoints(road: RoadDef, steps = 50): [number, number][] {
  const points: [number, number][] = [];
  if (!road.controlPoints || road.controlPoints.length === 0) {
    // 无控制点，退化为直线
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push([
        road.start[0] + (road.end[0] - road.start[0]) * t,
        road.start[1] + (road.end[1] - road.start[1]) * t,
      ]);
    }
  } else if (road.controlPoints.length === 1) {
    // 二次贝塞尔曲线
    for (let i = 0; i <= steps; i++) {
      points.push(quadraticBezierPoint(road.start, road.controlPoints[0], road.end, i / steps));
    }
  } else {
    // 三次贝塞尔曲线
    for (let i = 0; i <= steps; i++) {
      points.push(cubicBezierPoint(road.start, road.controlPoints[0], road.controlPoints[1], road.end, i / steps));
    }
  }
  return points;
}

/**
 * 检查点是否在道路范围内
 */
export function pointOnRoad(x: number, y: number, road: RoadDef): boolean {
  const width = road.width || 1;
  const halfWidth = Math.floor(width / 2);

  if (road.type === "horizontal") {
    const minX = Math.min(road.start[0], road.end[0]);
    const maxX = Math.max(road.start[0], road.end[0]);
    const roadY = road.start[1];
    return x >= minX && x <= maxX && y >= roadY - halfWidth && y <= roadY + halfWidth;
  }

  if (road.type === "vertical") {
    const minY = Math.min(road.start[1], road.end[1]);
    const maxY = Math.max(road.start[1], road.end[1]);
    const roadX = road.start[0];
    return y >= minY && y <= maxY && x >= roadX - halfWidth && x <= roadX + halfWidth;
  }

  if (road.type === "path") {
    const minX = Math.min(road.start[0], road.end[0]);
    const maxX = Math.max(road.start[0], road.end[0]);
    const minY = Math.min(road.start[1], road.end[1]);
    const maxY = Math.max(road.start[1], road.end[1]);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  if (road.type === "curve") {
    const curvePoints = getCurveRoadPoints(road);
    for (const point of curvePoints) {
      const dx = x - point[0];
      const dy = y - point[1];
      if (dx * dx + dy * dy <= halfWidth * halfWidth + 0.5) {
        return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * 检查点是否在建筑内
 */
export function pointInBuilding(x: number, y: number, building: BuildingDef): boolean {
  return pointInRect(x, y, building.bounds[0], building.bounds[1], building.bounds[2], building.bounds[3]);
}

/**
 * 获取指定位置的地面地形（不含建筑、不含道路部件）
 * 道路请用 TileGrid.getRoadAt / hasRoad
 */
export function getGroundTerrainAt(x: number, y: number, config: MapConfig): TerrainType {
  return config.terrainGenerator(x, y, config);
}

/** 兼容：有道路部件时视为 ROAD 地形（通行判定） */
export function hasRoadAt(x: number, y: number, tileGrid?: { hasRoad(x: number, y: number): boolean }): boolean {
  if (tileGrid) return tileGrid.hasRoad(x, y);
  return false;
}

/**
 * 获取指定位置的建筑（如果有）
 */
export function getBuildingAt(x: number, y: number, config: MapConfig): BuildingDef | null {
  for (const building of config.buildings) {
    if (pointInBuilding(x, y, building)) {
      return building;
    }
  }
  return null;
}

/**
 * 获取指定位置的地形（包含建筑，用于碰撞检测）
 */
export function getTerrainAt(
  x: number,
  y: number,
  config: MapConfig,
  tileGrid?: { hasRoad(x: number, y: number): boolean }
): TerrainType {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  for (const building of config.buildings) {
    if (pointInBuilding(ix, iy, building)) {
      return TerrainType.BUILDING;
    }
  }

  if (tileGrid?.hasRoad(ix, iy)) {
    return TerrainType.ROAD;
  }

  return config.terrainGenerator(ix, iy, config);
}

/**
 * 检查是否可通行
 */
export function isPassable(
  x: number,
  y: number,
  config: MapConfig,
  tileGrid?: { hasRoad(x: number, y: number): boolean }
): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= config.width || iy < 0 || iy >= config.height) return false;
  const terrain = getTerrainAt(ix, iy, config, tileGrid);
  return PASSABLE_TERRAIN.includes(terrain);
}

/**
 * 查找最近的通行点
 */
export function findNearestPassable(
  x: number,
  y: number,
  config: MapConfig,
  tileGrid?: { hasRoad(x: number, y: number): boolean }
): [number, number] {
  if (isPassable(x, y, config, tileGrid)) return [x, y];

  // 螺旋搜索最近的通行点
  for (let radius = 1; radius < 10; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          const nx = x + dx;
          const ny = y + dy;
          if (isPassable(nx, ny, config, tileGrid)) {
            return [nx, ny];
          }
        }
      }
    }
  }
  return [x, y]; // 找不到就返回原位置
}

// ==================== 幸福镇地图配置 ====================

export const 幸福镇地图: MapConfig = {
  id: "happy_town",
  name: "幸福镇",
  width: 100,
  height: 100,
  tileSize: 32,

  // 地形生成器 — 草地、农田土、池塘、石岸
  terrainGenerator: (x, y) => {
    // 地图边缘石岸
    if (x <= 1 || y <= 1 || x >= 98 || y >= 98) return TerrainType.STONE;

    // 东南池塘
    const pondDx = x - 88;
    const pondDy = y - 78;
    if (pondDx * pondDx + pondDy * pondDy < 49) return TerrainType.WATER;

    // 西侧农田土区（麦田周边）
    if (x >= 78 && x <= 97 && y >= 38 && y <= 58) return TerrainType.DIRT;

    // 镇中心花坛草地（十字路口附近保持绿茵）
    const cx = 50 - x;
    const cy = 50 - y;
    if (cx * cx + cy * cy < 36) return TerrainType.GRASS;

    // 自然起伏：草甸与土路痕迹
    const noise =
      Math.sin(x * 0.07) * Math.cos(y * 0.06) +
      Math.sin((x + y) * 0.04) * 0.6 +
      Math.sin(x * 0.15 - y * 0.1) * 0.25;
    if (noise > 0.75) return TerrainType.DIRT;
    return TerrainType.GRASS;
  },

  // 道路网络 - 小镇主干道（简洁清晰的布局）
  roads: [
    // 东西主街 - 主干道，轻微弯曲
    { type: "curve", start: [10, 30], end: [90, 30], width: 3, controlPoints: [[50, 28]] },
    // 南北主街 - 主干道，轻微弯曲
    { type: "curve", start: [50, 10], end: [50, 90], width: 3, controlPoints: [[48, 50]] },
    // 北侧商业街 - 简单弧线
    { type: "curve", start: [25, 15], end: [75, 15], width: 2, controlPoints: [[50, 14]] },
    // 南侧住宅街 - 简单弧线
    { type: "curve", start: [25, 60], end: [75, 60], width: 2, controlPoints: [[50, 61]] },
    // 东侧小路
    { type: "curve", start: [75, 25], end: [75, 55], width: 2, controlPoints: [[76, 40]] },
    // 西侧小路
    { type: "curve", start: [25, 25], end: [25, 55], width: 2, controlPoints: [[24, 40]] },
    // 连接小路（简化）
    { type: "curve", start: [25, 30], end: [25, 15], width: 1, controlPoints: [] },
    { type: "curve", start: [75, 30], end: [75, 15], width: 1, controlPoints: [] },
    { type: "curve", start: [25, 60], end: [25, 30], width: 1, controlPoints: [] },
    { type: "curve", start: [75, 60], end: [75, 30], width: 1, controlPoints: [] },
    { type: "curve", start: [50, 15], end: [50, 30], width: 1, controlPoints: [] },
    { type: "curve", start: [50, 60], end: [50, 30], width: 1, controlPoints: [] },
  ],

  // 建筑 - 沿路分布（注意：建筑不要与道路重叠）
  buildings: [
    // 北侧商业街（y=15是商业街道路，建筑在道路上方 y=8-13）
    { id: "fruit_shop", name: "吴平水果店", type: "商店", owner: "吴平", bounds: [30, 8, 40, 13], color: "#ff9800", entrance: [35, 13] },
    { id: "flower_shop", name: "云香花店", type: "商店", owner: "云香", bounds: [55, 8, 65, 13], color: "#e91e63", entrance: [60, 13] },
    { id: "clothes_shop", name: "胡倩服装店", type: "商店", owner: "胡倩", bounds: [42, 8, 52, 13], color: "#9c27b0", entrance: [47, 13] },

    // 南侧住宅区（y=60是住宅街道路，建筑在道路下方 y=63-68）
    { id: "yunfei_home", name: "云飞家", type: "住宅", owner: "云飞", bounds: [30, 63, 38, 68], color: "#4caf50", entrance: [34, 63] },
    { id: "qilinlin_home", name: "齐琳琳家", type: "住宅", owner: "齐琳琳", bounds: [55, 63, 63, 68], color: "#2196f3", entrance: [59, 63] },
    { id: "liukun_home", name: "刘坤家", type: "住宅", owner: "刘坤", bounds: [42, 63, 50, 68], color: "#795548", entrance: [46, 63] },

    // 东侧农田（远离道路）
    { id: "wheat_field", name: "麦田", type: "农田", bounds: [82, 42, 95, 55], color: "#ffc107" },

    // 西侧小广场（远离道路）
    { id: "square", name: "小广场", type: "公共", bounds: [8, 42, 18, 52], color: "#607d8b" },
  ],

  // 出生点
  spawnPoints: [
    { id: "yunfei", x: 34, y: 70, type: "player" },
    { id: "qilinlin", x: 59, y: 70, type: "npc" },
    { id: "liukun", x: 88, y: 48, type: "npc" },  // 农民在农田
    { id: "wuping", x: 35, y: 18, type: "npc" },
    { id: "yunxiang", x: 60, y: 18, type: "npc" },
    { id: "huqian", x: 47, y: 18, type: "npc" },
  ],
};

// ==================== 地图管理器 ====================
export class MapManager {
  private config: MapConfig;
  private terrainCache: Map<string, TerrainType> = new Map();
  readonly tileGrid: TileGrid;
  /** 整图底图（启动时烘焙一次，运行时只 blit） */
  staticMapCanvas: HTMLCanvasElement | null = null;
  /** 独立道路网络系统 */
  roadNetwork: RoadNetwork;

  constructor(config: MapConfig) {
    this.config = config;
    this.tileGrid = new TileGrid(config);
    this.roadNetwork = new RoadNetwork(config.tileSize);
  }

  /**
   * 从JSON加载道路网络
   */
  loadRoadNetworkFromJSON(data: { paths: RoadPath[]; tileSize: number }): void {
    this.roadNetwork = RoadNetwork.fromJSON(data);
    // 设置地图尺寸并触发烘焙
    const mapWidth = this.config.width * (this.config.tileSize || 32);
    const mapHeight = this.config.height * (this.config.tileSize || 32);
    this.roadNetwork.setMapSize(mapWidth, mapHeight);
  }

  /**
   * 渲染道路网络
   */
  renderRoads(ctx: CanvasRenderingContext2D, viewport: { x: number; y: number; width: number; height: number }): void {
    this.roadNetwork.render(ctx, viewport);
  }

  getConfig(): MapConfig {
    return this.config;
  }

  getTerrainAt(x: number, y: number): TerrainType {
    const key = `${x},${y}`;
    if (!this.terrainCache.has(key)) {
      this.terrainCache.set(key, getTerrainAt(x, y, this.config, this.tileGrid));
    }
    return this.terrainCache.get(key)!;
  }

  getTile(x: number, y: number) {
    return this.tileGrid.getTile(x, y);
  }

  isPassable(x: number, y: number): boolean {
    return isPassable(x, y, this.config, this.tileGrid);
  }

  findNearestPassable(x: number, y: number): [number, number] {
    return findNearestPassable(x, y, this.config, this.tileGrid);
  }

  getBuildingAt(x: number, y: number): BuildingDef | null {
    for (const building of this.config.buildings) {
      if (pointInBuilding(x, y, building)) {
        return building;
      }
    }
    return null;
  }

  getSpawnPoint(id: string): SpawnPoint | undefined {
    return this.config.spawnPoints.find(sp => sp.id === id);
  }

  // 获取所有道路
  getRoads(): RoadDef[] {
    return this.config.roads;
  }

  // 获取所有建筑
  getBuildings(): BuildingDef[] {
    return this.config.buildings;
  }

  // 清除缓存
  clearCache(): void {
    this.terrainCache.clear();
  }
}
