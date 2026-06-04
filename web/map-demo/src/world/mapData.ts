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
  width: 300,
  height: 300,
  tileSize: 32,

  // 地形生成器 — 草地、农田土、池塘、石岸
  terrainGenerator: (x, y) => {
    // 地图边缘石岸（300格→3格宽边框）
    if (x <= 3 || y <= 3 || x >= 296 || y >= 296) return TerrainType.STONE;

    // 东南池塘（扩大3倍）
    const pondDx = x - 264;
    const pondDy = y - 234;
    if (pondDx * pondDx + pondDy * pondDy < 147) return TerrainType.WATER;

    // 北侧湖泊
    const lakeDx = x - 60;
    const lakeDy = y - 45;
    if (lakeDx * lakeDx + lakeDy * lakeDy < 80) return TerrainType.WATER;

    // 西南湿地水洼
    const marshDx = x - 40;
    const marshDy = y - 260;
    if (marshDx * marshDx + marshDy * marshDy < 50) return TerrainType.WATER;

    // 西侧农田土区
    if (x >= 234 && x <= 291 && y >= 114 && y <= 174) return TerrainType.DIRT;

    // 镇中心花坛草地
    const cx = 150 - x;
    const cy = 150 - y;
    if (cx * cx + cy * cy < 108) return TerrainType.GRASS;

    // 自然起伏
    const noise =
      Math.sin(x * 0.07) * Math.cos(y * 0.06) +
      Math.sin((x + y) * 0.04) * 0.6 +
      Math.sin(x * 0.15 - y * 0.1) * 0.25;
    if (noise > 0.75) return TerrainType.DIRT;
    return TerrainType.GRASS;
  },

  // 道路网络（坐标×3）
  roads: [
    { type: "curve", start: [30, 90], end: [270, 90], width: 3, controlPoints: [[150, 84]] },
    { type: "curve", start: [150, 30], end: [150, 270], width: 3, controlPoints: [[144, 150]] },
    { type: "curve", start: [75, 45], end: [225, 45], width: 2, controlPoints: [[150, 42]] },
    { type: "curve", start: [75, 180], end: [225, 180], width: 2, controlPoints: [[150, 183]] },
    { type: "curve", start: [225, 75], end: [225, 165], width: 2, controlPoints: [[228, 120]] },
    { type: "curve", start: [75, 75], end: [75, 165], width: 2, controlPoints: [[72, 120]] },
    { type: "curve", start: [75, 90], end: [75, 45], width: 1, controlPoints: [] },
    { type: "curve", start: [225, 90], end: [225, 45], width: 1, controlPoints: [] },
    { type: "curve", start: [75, 180], end: [75, 90], width: 1, controlPoints: [] },
    { type: "curve", start: [225, 180], end: [225, 90], width: 1, controlPoints: [] },
    { type: "curve", start: [150, 45], end: [150, 90], width: 1, controlPoints: [] },
    { type: "curve", start: [150, 180], end: [150, 90], width: 1, controlPoints: [] },
  ],

  buildings: [
    { id: "fruit_shop", name: "周明哲水果店", type: "商店", owner: "周明哲", bounds: [92, 36, 95, 38], color: "#ff9800", entrance: [93, 38] },
    { id: "flower_shop", name: "陈晓燕花店", type: "商店", owner: "陈晓燕", bounds: [167, 36, 170, 38], color: "#e91e63", entrance: [168, 38] },
    { id: "clothes_shop", name: "林玉芳服装店", type: "商店", owner: "林玉芳", bounds: [132, 36, 135, 38], color: "#9c27b0", entrance: [133, 38] },
    { id: "yunfei_home", name: "张文博家", type: "住宅", owner: "张文博", bounds: [92, 183, 94, 185], color: "#4caf50", entrance: [93, 183] },
    { id: "qilinlin_home", name: "李秀兰家", type: "住宅", owner: "李秀兰", bounds: [167, 183, 169, 185], color: "#2196f3", entrance: [168, 183] },
    { id: "liukun_home", name: "陈德厚家", type: "住宅", owner: "陈德厚", bounds: [132, 183, 134, 185], color: "#795548", entrance: [133, 183] },
    { id: "wheat_field", name: "麦田", type: "农田", bounds: [250, 126, 260, 136], color: "#ffc107" },
    { id: "square", name: "小广场", type: "公共", bounds: [24, 126, 29, 131], color: "#607d8b" },
  ],

  spawnPoints: [
    { id: "yunfei", x: 93, y: 178, type: "player" },
    { id: "qilinlin", x: 168, y: 178, type: "npc" },
    { id: "liukun", x: 255, y: 140, type: "npc" },
    { id: "wuping", x: 93, y: 42, type: "npc" },
    { id: "yunxiang", x: 168, y: 42, type: "npc" },
    { id: "huqian", x: 133, y: 42, type: "npc" },
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
