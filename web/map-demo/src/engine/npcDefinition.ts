/**
 * NPC定义类型 - 从NPCManager到Npc类使用的标准接口
 */

export interface NpcPersonality {
  [trait: string]: number;
}

export interface NpcDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  personality: NpcPersonality;
  state: Record<string, number>;
  perceptionRange: number;
  controllable: boolean;
  roleType?: "merchant" | "farmer" | "villager" | "player";
  shopId?: string;
  activityCenter?: [number, number];
  activityRadius?: number;
  speedMultiplier?: number;
  // 原始JSON数据透传（给BrainEngine用）
  rawData?: {
    家坐标?: [number, number];
    物品栏?: Array<{ 物品id: string; 名称: string; 数量: number; 类型: string }>;
    金钱?: number;
    记忆标签?: string[];
    知识库?: {
      已知地点?: Record<string, any>;
      已知人物?: Record<string, any>;
    };
    当前状态?: string;
  };
}
