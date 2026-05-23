/**
 * NPC管理器 - 从 npc/ 文件夹自动加载NPC数据
 * 替代硬编码的 NPC_DEFINITIONS
 *
 * 使用方式：
 *   const npcDefs = NPCManager.loadAllNpcs();
 */

import type { NpcDefinition } from "./npcDefinition";

// 直接从NPC文件夹导入JSON数据
import yunfeiRaw from "../../../../NPC/云飞/个人信息.json";
import qilinlinRaw from "../../../../NPC/齐琳琳/个人信息.json";
import liukunRaw from "../../../../NPC/刘坤/个人信息.json";
import wupingRaw from "../../../../NPC/吴平/个人信息.json";
import yunxiangRaw from "../../../../NPC/云香/个人信息.json";
import huqianRaw from "../../../../NPC/胡倩/个人信息.json";
import wangwuRaw from "../../../../NPC/王五/个人信息.json";
import zhaoliuRaw from "../../../../NPC/赵六/个人信息.json";

// JSON导入的类型
interface RawNpcData {
  角色id: string;
  姓名: string;
  职业: string;
  描述?: string;
  当前坐标: number[];
  家坐标?: number[];
  店铺坐标?: { 左下角: number[]; 右上角: number[] };
  性格?: Record<string, number>;
  性格维度?: Record<string, number>;
  欲望?: Record<string, number>;
  身体素质?: Record<string, number>;
  生理状态?: Record<string, number>;
  物品栏?: any[];
  金钱?: number;
  大脑类型?: string;
  记忆标签?: string[];
  知识库?: { 已知地点?: Record<string, any>; 已知人物?: Record<string, any> };
  当前状态?: string;
}

// 角色类型映射
function deriveRoleType(职业: string): "merchant" | "farmer" | "villager" | "player" {
  if (职业.includes("店")) return "merchant";
  if (职业.includes("农")) return "farmer";
  return "villager";
}

// 颜色映射
function deriveColor(角色id: string, roleType: string): string {
  const colorMap: Record<string, string> = {
    "yunfei": "#4CAF50",
    "qilinlin": "#E91E63",
    "liukun": "#8B4513",
    "wuping": "#FF9800",
    "yunxiang": "#2196F3",
    "huqian": "#795548",
    "wangwu": "#607D8B",
    "zhaoliu": "#00BCD4",
  };
  return colorMap[角色id] || "#888888";
}

// 商铺ID映射
function deriveShopId(角色id: string): string | undefined {
  const shopMap: Record<string, string> = {
    "wuping": "fruit_shop",
    "yunxiang": "flower_shop",
    "huqian": "clothes_shop",
  };
  return shopMap[角色id];
}

// 速度倍率
function deriveSpeed(角色id: string, roleType: string): number {
  if (角色id === "liukun") return 0.7;
  if (roleType === "merchant") return 0.5;
  return 1.0;
}

// 感知范围
function derivePerceptionRange(roleType: string): number {
  return 8;
}

/**
 * 从原始NPC数据中提取简化的性格数据（兼容现有7维系统）
 */
function normalizePersonality(raw: RawNpcData): Record<string, number> {
  // 优先使用34维"性格"字段，但需要补充颜值和好色（它们在身体素质/欲望中）
  if (raw.性格) {
    const personality = { ...raw.性格 };
    // 颜值 → 从 身体素质.外貌 读取（感知系统和欲望系统依赖此字段）
    if (raw.身体素质?.["外貌"] !== undefined) {
      personality["颜值"] = raw.身体素质["外貌"];
    }
    // 好色 → 从 欲望.色欲 读取（搭讪/追求欲望依赖此字段）
    if (raw.欲望?.["色欲"] !== undefined) {
      personality["好色"] = raw.欲望["色欲"];
    }
    return personality;
  }

  // 商人类型使用"性格维度"字段，映射到标准维度
  if (raw.性格维度) {
    const dims = raw.性格维度;
    return {
      乐观: dims["情绪基调_积极倾向"] ?? 5,
      勤奋: dims["外显活力_行动意愿"] ?? 5,
      大方: dims["财富态度_分享意愿"] ?? 5,
      勇敢: dims["胆魄气量_勇气阈值"] ?? 5,
      好色: raw.欲望?.["色欲"] ?? 5,
      审美: raw.身体素质?.["外貌"] ?? 5,
      社交欲: dims["社交属性_自我坦露"] ?? 5,
      道德: dims["道德水准_利他意愿"] ?? 5,
      贪婪: dims["财富态度_获取欲望"] ?? 5,
      忠诚: dims["人际关系_忠诚度"] ?? 5,
      颜值: raw.身体素质?.["外貌"] ?? 5,
    };
  }

  return {};
}

/**
 * 从原始NPC数据中提取生理状态
 */
function normalizeState(raw: RawNpcData): Record<string, number> {
  if (raw.生理状态) {
    return {
      饥饿: raw.生理状态["饥饿"] ?? 6,
      疲劳: raw.生理状态["疲劳"] ?? 3,
    };
  }
  return { 饥饿: 6, 疲劳: 3 };
}

/**
 * 将原始NPC JSON数据规范化为NpcDefinition
 */
function normalizeNpc(raw: RawNpcData): NpcDefinition {
  const roleType = deriveRoleType(raw.职业);
  const isPlayer = raw.角色id === "云飞";
  const shopId = deriveShopId(raw.角色id);
  const personality = normalizePersonality(raw);
  const state = normalizeState(raw);

  let activityCenter: [number, number] | undefined;
  let activityRadius: number | undefined;

  if (roleType === "merchant") {
    activityCenter = [raw.当前坐标[0], raw.当前坐标[1] - 1];
    activityRadius = 3;
  } else if (raw.角色id === "liukun") {
    activityCenter = [raw.当前坐标[0], raw.当前坐标[1]];
    activityRadius = 6;
  }

  return {
    id: raw.角色id,
    name: raw.姓名,
    x: raw.当前坐标[0],
    y: raw.当前坐标[1],
    color: deriveColor(raw.角色id, roleType),
    personality,
    state,
    perceptionRange: derivePerceptionRange(roleType),
    controllable: isPlayer,
    roleType: isPlayer ? "player" : roleType,
    shopId,
    activityCenter,
    activityRadius,
    speedMultiplier: deriveSpeed(raw.角色id, roleType),
    rawData: {
      家坐标: raw.家坐标 ? [raw.家坐标[0], raw.家坐标[1]] : raw.当前坐标 ? [raw.当前坐标[0], raw.当前坐标[1]] : undefined,
      物品栏: raw.物品栏?.map(item => ({ 物品id: item.物品id || "", 名称: item.名称, 数量: item.数量, 类型: item.类型 })),
      金钱: raw.金钱 ?? 50,
      记忆标签: raw.记忆标签 ?? [],
      知识库: raw.知识库 ? { 已知地点: raw.知识库.已知地点, 已知人物: raw.知识库.已知人物 } : undefined,
      当前状态: raw.当前状态 ?? "空闲",
    },
  };
}

// 所有NPC原始数据
const rawNpcs: RawNpcData[] = [
  yunfeiRaw, qilinlinRaw, liukunRaw,
  wupingRaw, yunxiangRaw, huqianRaw,
  wangwuRaw, zhaoliuRaw,
];

/**
 * NPC管理器 - 数据驱动的NPC加载
 */
export class NPCManager {
  private static npcDefinitions: NpcDefinition[] | null = null;

  /**
   * 加载所有NPC定义
   */
  static loadAllNpcs(): NpcDefinition[] {
    if (this.npcDefinitions) return this.npcDefinitions;

    const npcs = rawNpcs.map(raw => normalizeNpc(raw));

    // 检查重复ID
    const ids = npcs.map(n => n.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.error("NPCManager: 发现重复的NPC ID:", duplicates);
    }

    console.log("NPCManager: 已加载", npcs.length, "个NPC:", ids.join(", "));
    this.npcDefinitions = npcs;
    return npcs;
  }

  /**
   * 按ID获取NPC
   */
  static getNpcById(id: string): NpcDefinition | undefined {
    const npcs = this.loadAllNpcs();
    return npcs.find(n => n.id === id);
  }

  /**
   * 获取所有NPC ID列表
   */
  static getAllNpcIds(): string[] {
    return this.loadAllNpcs().map(n => n.id);
  }

  /**
   * 获取玩家可控NPC
   */
  static getPlayerNpc(): NpcDefinition | undefined {
    return this.loadAllNpcs().find(n => n.controllable);
  }
}
