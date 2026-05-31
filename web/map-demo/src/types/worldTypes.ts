/**
 * 世界状态完整类型定义
 * 与 docs/005_愿景与设计/ 各系统文档对齐
 */

import type { Direction, BuildingType, TerrainType, CropState, AnimalState } from "./npcTypes";

// ========== 时间系统 ==========

export interface WorldTime {
  当前Tick: number;         // 全局Tick计数器
  当前秒: number;           // 0-59
  当前分钟: number;         // 0-59
  当前小时: number;         // 0-23
  当前日: number;           // 1-30
  当前月: number;           // 1-12
  当前年: number;
  当前季节: "春" | "夏" | "秋" | "冬";
  是否白天: boolean;        // 6:00-18:00为白天
}

// ========== 地图格子 ==========

export interface GridCell {
  // 基础地形
  地形: TerrainType;
  踩踏度: number;           // 0-100，道路系统用，>80形成道路
  可通行: boolean;

  // 农耕系统
  耕地状态: CropState;
  作物类型: string | null;
  生长进度: number;         // 0-100
  水分: number;             // 0-100
  肥料: number;             // 0-100

  // 建筑占位
  建筑ID: string | null;

  // 其他实体占位
  火堆ID: string | null;
  动物ID: string | null;
}

// ========== 建筑 ==========

export interface BuildingBase {
  id: string;
  类型: BuildingType;
  位置: [number, number];    // 左上角坐标 [x, y]
  尺寸: [number, number];    // [宽, 高] 格子数
  等级: string;              // "草棚" | "木屋" | "瓦房" | "石屋" | ...
  耐久度: number;            // 0-100
  所有者ID: string | null;
  居住者ID: string[];        // 谁住这里
  门朝向: Direction;
  容量: number;              // 最多住几人 / 最多容纳几学生

  // 类型专属扩展数据
  扩展数据: Record<string, any>;
}

// 铁匠铺扩展
export interface BlacksmithExt {
  火炉状态: "熄灭" | "燃烧";
  可锻造物品: string[];
  当前锻造?: string;         // 正在锻造的物品
  锻造进度?: number;         // 0-100
}

// 学校扩展
export interface SchoolExt {
  教师ID: string | null;
  学生列表: string[];
  最大学生数: number;
  课程表?: string[];         // 每天的课程
}

// 仓库扩展
export interface WarehouseExt {
  存储物品: Array<{
    物品id: string;
    名称: string;
    数量: number;
  }>;
  最大容量: number;          // 总格子数
  已用容量: number;
}

// 商店扩展
export interface ShopExt {
  店主ID: string;
  商品列表: Array<{
    物品id: string;
    名称: string;
    价格: number;
    数量: number;
  }>;
  营业时间: [number, number]; // [开门小时, 关门小时]
}

// 公示栏扩展
export interface NoticeBoardExt {
  公告列表: Array<{
    id: string;
    标题: string;
    内容: string;
    发布者ID: string;
    发布时间: number;         // Tick数
    有效期: number;           // 持续多少Tick
  }>;
}

// ========== 火堆 ==========

export interface FirePit {
  id: string;
  位置: [number, number];
  状态: "熄灭" | "燃烧" | "旺盛";
  燃料剩余: number;          // 0-100
  烹饪中?: {
    物品id: string;
    名称: string;
    进度: number;            // 0-100
  };
}

// ========== 动物 ==========

export interface Animal {
  id: string;
  物种: "鸡" | "猪" | "羊" | "牛" | "狼" | "鹿" | "兔";
  当前状态: AnimalState;
  位置: [number, number];
  健康值: number;            // 0-100
  饥饿度: number;            // 1-10
  年龄: number;              // 天数
  性别: "雄" | "雌";

  // 行为参数（替代NPC的34维性格）
  攻击性: number;            // 0-10
  警觉性: number;            // 0-10
  群居性: number;            // 0-10

  // 群体行为
  所属群体ID: string | null;
  群体角色: "首领" | "成员" | null;

  // 家畜专属
  主人ID: string | null;
  产奶倒计时?: number;       // 牛/羊，距离下次产奶的Tick数
  产蛋倒计时?: number;       // 鸡，距离下次产蛋的Tick数

  // 运行时
  当前动作: string;
  当前目标: any;
}

// ========== 尸体 ==========

export interface Corpse {
  id: string;
  原NPC_ID: string;
  姓名: string;
  位置: [number, number];
  死亡时间: number;          // Tick数
  腐烂进度: number;          // 0-100
  可拾取物品: Array<{
    物品id: string;
    名称: string;
    数量: number;
  }>;
}

// ========== 世界状态 ==========

export interface WorldState {
  时间: WorldTime;

  // 地图
  grid: GridCell[][];         // 100×100
  地图宽度: number;
  地图高度: number;

  // 实体集合
  buildings: Record<string, BuildingBase>;
  fires: Record<string, FirePit>;
  animals: Record<string, Animal>;
  corpses: Corpse[];

  // NPC管理
  人口: number;
  NPC列表: string[];          // 所有存活NPC的ID
  死亡NPC列表: string[];      // 已死亡NPC的ID（用于历史记录）

  // 世界统计
  总交易次数: number;
  总出生人数: number;
  总死亡人数: number;
}

// ========== 事件系统 ==========

export interface GameEvent {
  类型: string;               // "NPC死亡" | "建筑完工" | "好感度变化" | "分娩" | ...
  来源: string;               // 触发者ID
  目标?: string;              // 目标ID
  数据: Record<string, any>;
  时间戳: number;             // Tick数
}

export type EventListener = (event: GameEvent) => void;

// ========== 感知触发器 ==========

export interface PerceptionTrigger {
  感知类型: "视觉" | "听觉" | "嗅觉" | "触觉";
  过滤条件: (感知结果: any, npc: any) => boolean;
  生成欲望: (npc: any, 感知结果: any) => { id: string; target?: any } | null;
  优先级: number;
  冷却时间: number;           // Tick数
}
