/**
 * 感知系统 - 通用机制
 * NPC只能感知到感知范围内的对象
 */

import type { MapManager } from "../world/mapData";

// ==================== 感知对象 ====================
export interface Perceivable {
  id: string;
  x: number;
  y: number;
  type: "npc" | "player" | "building" | "item";
  // 视觉属性
  visual?: {
    颜值?: number;
    穿着?: string;
    动作?: string;
  };
  // 听觉属性
  auditory?: {
    声音大小?: number;
    说话内容?: string;
  };
  // 可被感知的数据
  data?: Record<string, any>;
}

// ==================== 感知结果 ====================
export interface PerceptionResult {
  // 视觉感知到的对象
  visual: Perceivable[];
  // 听觉感知到的对象
  auditory: Perceivable[];
  // 感知到的建筑
  buildings: Perceivable[];
}

// ==================== 感知系统配置 ====================
export interface PerceptionConfig {
  // 视野范围（格子数）
  sightRange: number;
  // 听觉范围（格子数）
  hearingRange: number;
  // 视野角度（360度 = 全向）
  sightAngle: number;
  // 是否受障碍物阻挡
  blockedByObstacles: boolean;
}

// 默认感知配置
export const DEFAULT_PERCEPTION: PerceptionConfig = {
  sightRange: 8,
  hearingRange: 12,
  sightAngle: 360,
  blockedByObstacles: true,
};

// ==================== 感知系统 ====================
export class PerceptionSystem {
  private mapManager: MapManager;

  constructor(mapManager: MapManager) {
    this.mapManager = mapManager;
  }

  /**
   * 感知周围环境
   * @param observer 观察者（NPC自己）
   * @param targets 世界中所有可被感知的对象
   * @param config 感知配置
   */
  perceive(
    observer: Perceivable,
    targets: Perceivable[],
    config: PerceptionConfig = DEFAULT_PERCEPTION
  ): PerceptionResult {
    const result: PerceptionResult = {
      visual: [],
      auditory: [],
      buildings: [],
    };

    for (const target of targets) {
      if (target.id === observer.id) continue; // 忽略自己

      const distance = this.getDistance(observer, target);

      // 视觉检查
      if (distance <= config.sightRange) {
        const canSee = this.checkLineOfSight(observer, target, config);
        if (canSee) {
          result.visual.push(target);
        }
      }

      // 听觉检查（范围更大，不受阻挡）
      if (distance <= config.hearingRange) {
        result.auditory.push(target);
      }
    }

    // 感知建筑（始终可见，如果够近）
    const buildings = this.getNearbyBuildings(observer.x, observer.y, config.sightRange);
    result.buildings = buildings;

    return result;
  }

  /**
   * 计算两点距离
   */
  private getDistance(a: Perceivable, b: Perceivable): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 检查视线是否通畅
   */
  private checkLineOfSight(
    observer: Perceivable,
    target: Perceivable,
    config: PerceptionConfig
  ): boolean {
    if (!config.blockedByObstacles) return true;

    // 简单的视线检查 - 使用Bresenham线段算法
    const x1 = Math.floor(observer.x);
    const y1 = Math.floor(observer.y);
    const x2 = Math.floor(target.x);
    const y2 = Math.floor(target.y);

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      // 检查当前位置是否阻挡视线（建筑阻挡）
      if (x !== x1 || y !== y1) {
        const terrain = this.mapManager.getTerrainAt(x, y);
        if (terrain === 5) { // BUILDING
          return false; // 被建筑阻挡
        }
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return true;
  }

  /**
   * 获取附近的建筑
   */
  private getNearbyBuildings(x: number, y: number, range: number): Perceivable[] {
    const buildings = this.mapManager.getBuildings();
    const result: Perceivable[] = [];

    for (const building of buildings) {
      // 计算建筑中心点
      const centerX = (building.bounds[0] + building.bounds[2]) / 2;
      const centerY = (building.bounds[1] + building.bounds[3]) / 2;

      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );

      if (distance <= range) {
        result.push({
          id: building.id,
          x: centerX,
          y: centerY,
          type: "building",
          data: {
            name: building.name,
            type: building.type,
            owner: building.owner,
            color: building.color,
          },
        });
      }
    }

    return result;
  }

  /**
   * 检查两个NPC是否足够近可以对话
   */
  canInteract(a: Perceivable, b: Perceivable, range: number = 2): boolean {
    const distance = this.getDistance(a, b);
    return distance <= range;
  }

  /**
   * 获取最近的特定类型对象
   */
  findNearestOfType(
    observer: Perceivable,
    targets: Perceivable[],
    type: string
  ): Perceivable | null {
    let nearest: Perceivable | null = null;
    let minDistance = Infinity;

    for (const target of targets) {
      if (target.type === type) {
        const distance = this.getDistance(observer, target);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = target;
        }
      }
    }

    return nearest;
  }
}
