/**
 * NPC 完整类型定义
 * 与 docs/005_愿景与设计/NPC参数总表.md 对齐
 * 命名规范：JSON字段/配置 → 中文；变量名/函数名/类名 → 英文
 */

// ========== 基础类型 ==========

export type Gender = "男" | "女";
export type Season = "春" | "夏" | "秋" | "冬";
export type TimeOfDay = "白天" | "黑夜";
export type TerrainType = "草地" | "森林" | "河流" | "山地" | "沙地";
export type CropState = "未开垦" | "已耕地" | "已播种" | "生长中" | "成熟" | "枯萎";
export type AnimalState = "野生" | "圈养" | "驯化";
export type BuildingType = "住所" | "铁匠铺" | "学校" | "仓库" | "商店" | "公示栏" | "其他";
export type Direction = "上" | "下" | "左" | "右";

// ========== 物品系统 ==========

export interface Item {
  物品id: string;
  名称: string;
  数量: number;
  类型: string;
  标签: string[];
  耐久度?: number;      // 0-100，有耐久度的物品才有此字段
  品质?: string;        // "普通" | "良好" | "耐用" | "精良" | "完美"
}

// ========== 生理状态 ==========

export interface PhysiologicalState {
  饥饿: number;         // 1-10，1=很饱，10=极度饥饿
  口渴: number;         // 1-10，1=不渴，10=极度口渴（原始生存系统新增）
  疲劳: number;         // 1-10，1=精力充沛，10=濒临崩溃
  精力: number;         // 0-100，0=精疲力竭，100=精力充沛。与疲劳互补
  性欲: number;         // 0-100，注意：范围与其他生理状态不同！
  健康值: number;       // 0-100，0=死亡，100=完全健康
  开心: number;         // 1-10，心情值
  当前经期日: number;    // 0-28，女性专属，男性固定为0
  孕期天数: number;     // 0-300，未怀孕为0
}

// ========== 社会关系 ==========

export interface SocialRelations {
  好感度: Record<string, number>;   // 目标NPC_ID → -100~+100
  配偶ID: string | null;
  父母ID: string[];
  子女ID: string[];
  师徒ID: string[];
}

// ========== 择偶偏好 ==========

export interface MatePreference {
  维度: string;         // "颜值" | "财富" | "性格" | "善良" | "勤劳" | ...
  权重: number;         // 0-1，三项权重之和=1
}

export interface MatePreferences {
  偏好项: MatePreference[];  // 固定3项
}

// ========== 知识库 ==========

export interface KnowledgeLocation {
  名称: string;
  方向: string;           // "东北偏东"
  大概距离: string;       // "走路约80步"
  参考物: string;         // "河边有一棵大树"
  坐标?: [number, number]; // 如果亲自去过，有精确坐标
}

export interface KnowledgePerson {
  目标ID: string;
  印象: string;           // "看起来很友善"
  职业?: string;
}

export interface KnowledgeEvent {
  事件类型: string;       // "偷窃" | "结婚" | "死亡" | "打架"
  涉及人物: string[];
}

export interface KnowledgePrice {
  物品: string;
  价格: number;
  地点: string;
}

export type KnowledgeType = "地点" | "人物" | "事件" | "价格" | "技能" | "资源";

export interface KnowledgeItem {
  id: string;
  类型: KnowledgeType;
  内容: string;             // 自然语言摘要
  来源: string;             // 谁告诉我的 / 自己看到的 / "direct"
  可信度: number;           // 0-1
  时间戳: number;           // 什么时候知道的（Tick数）

  // 类型专属字段
  地点?: KnowledgeLocation;
  人物?: KnowledgePerson;
  事件?: KnowledgeEvent;
  价格?: KnowledgePrice;
}

// ========== 持续性意图 ==========

export type IntentType = "追求" | "学习" | "攒钱" | "储备" | "建造" | "复仇" | "探索";

export interface PersistentIntent {
  id: string;
  类型: IntentType;
  目标: any;                     // 目标对象（NPC_ID / 技能名 / 物品名）
  优先级: number;                // 1-10
  进度: number;                  // 0-100
  子目标: string[];              // 当前阶段的子目标ID列表
  创建时间: number;              // Tick数
  截止时间?: number;             // Tick数（可选）
}

// ========== NPC 完整定义 ==========

export interface NPC {
  // === 持久化字段（存JSON） ===
  id: string;
  姓名: string;
  性别: Gender;
  年龄: number;

  生理状态: PhysiologicalState;
  性格: Record<string, number>;   // 34维性格，来自 Brains_Library.json
  技能: Record<string, number>;   // 技能名 → 等级

  物品栏: Item[];
  金钱: number;

  标签: string[];                  // 所有标签统一存放，如 ["婴儿", "需要照料", "学生"]

  社会关系: SocialRelations;
  择偶偏好: MatePreferences;

  知识库: KnowledgeItem[];
  记忆标签: string[];              // [愉快聊天] [被偷过] 等短期记忆标签

  家坐标: [number, number] | null;
  工作场所ID: string | null;

  // === 运行时计算值（不存JSON，每Tick更新） ===
  当前位置: [number, number];
  当前动作: string;
  当前目标: any;
  意图栈: PersistentIntent[];
}

// ========== 运行时NPC状态（给BrainEngine用，比NPC更轻量） ==========

export interface NpcRuntimeState {
  id: string;
  姓名: string;
  性别: Gender;
  年龄: number;

  生理状态: PhysiologicalState;
  性格: Record<string, number>;
  技能: Record<string, number>;

  物品栏: Item[];
  金钱: number;

  标签: string[];
  记忆标签: string[];

  社会关系: SocialRelations;

  家坐标: [number, number] | null;
  工作场所ID: string | null;

  当前位置: [number, number];
  当前动作: string;
  意图栈: PersistentIntent[];

  知识库: KnowledgeItem[];
}

// ========== 旧版兼容接口（逐步迁移后删除） ==========

/** 与仓库根目录 NPC/*.json 对齐的最小演示结构 */
export interface WorldNpcFile {
  角色id: string;
  姓名: string;
  坐标: [number, number];
  占位说明?: string;
}

/** 旧版NPC定义 - 用于BrainEngine等现有代码的过渡 */
export interface NpcDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  personality: Record<string, number>;
  state: Record<string, number>;
  perceptionRange: number;
  controllable: boolean;
  roleType?: "merchant" | "farmer" | "villager" | "player";
  shopId?: string;
  activityCenter?: [number, number];
  activityRadius?: number;
  speedMultiplier?: number;
  rawData?: {
    家坐标?: [number, number];
    物品栏?: Item[];
    金钱?: number;
    记忆标签?: string[];
    标签?: string[];
    好感度?: Record<string, number>;
    技能?: Record<string, number>;
    知识库?: {
      已知地点?: Record<string, any>;
      已知人物?: Record<string, any>;
    };
    当前状态?: string;
  };
}
