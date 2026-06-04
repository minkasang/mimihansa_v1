/**
 * 角色外观属性生成器
 * 基于遗传规则和随机变异生成NPC外观属性
 * 
 * 核心原则：外观是NPC的"天生硬件"，不是预设职业标签
 * 一个"看起来像农民"的人是因为他身高标准、体型壮、肤色麦色等属性组合
 */

import type { NPC } from "../types/npcTypes";

// ============ 类型定义 ============

export type BodyType = "瘦" | "标准" | "壮" | "胖";
export type SkinTone = "白皙" | "暖色" | "麦色" | "深色";
export type HairColor = "黑色" | "深棕" | "浅棕" | "金色" | "红色" | "灰色" | "蓝色";
export type HairStyle = "短发" | "中长" | "长发" | "束发";
export type FaceStyle = "柔和" | "锐利" | "方正" | "圆润";
export type Expression = "严肃" | "温和" | "活泼" | "忧郁";

export interface Appearance {
  /** 身高 1-10 */
  身高: number;
  /** 体型 */
  体型: BodyType;
  /** 肤色基调 */
  肤色基调: SkinTone;
  /** 肤色深浅 1-5 */
  肤色深浅: number;
  /** 发色 */
  发色: HairColor;
  /** 发型 */
  发型: HairStyle;
  /** 五官风格 */
  五官风格: FaceStyle;
  /** 表情基调 */
  表情基调: Expression;
  /** 书生气 0-10 (后天积累) */
  书生气: number;
  /** 时髦度 0-10 */
  时髦度: number;
}

export interface AppearanceConfig {
  /** 身高遗传度 0-1 */
  heightHeritability: number;
  /** 体型遗传度 */
  bodyTypeHeritability: number;
  /** 肤色遗传度 */
  skinToneHeritability: number;
  /** 发色遗传度 */
  hairColorHeritability: number;
}

// ============ 默认配置 ============

export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  heightHeritability: 0.7,
  bodyTypeHeritability: 0.6,
  skinToneHeritability: 0.8,
  hairColorHeritability: 0.85,
};

// ============ 色值映射 ============

export const SKIN_COLORS: Record<SkinTone, { base: string; light: string; dark: string }> = {
  白皙: { base: "#FFEFE0", light: "#FFF5F0", dark: "#F5D0B0" },
  暖色: { base: "#F5D0B0", light: "#FFE8D0", dark: "#E8C4A0" },
  麦色: { base: "#E8C4A0", light: "#F5D0B0", dark: "#D4A574" },
  深色: { base: "#C49464", light: "#E8C4A0", dark: "#A67B5B" },
};

export const HAIR_COLORS: Record<HairColor, string> = {
  黑色: "#1A1A1A",
  深棕: "#4A2408",
  浅棕: "#8B4513",
  金色: "#D4A574",
  红色: "#A0522D",
  灰色: "#808080",
  蓝色: "#4A90E2",
};

// ============ 工具函数 ============

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomPick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function weightedRandom<T>(options: { value: T; weight: number }[]): T {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const option of options) {
    random -= option.weight;
    if (random <= 0) {
      return option.value;
    }
  }
  
  return options[options.length - 1].value;
}

// ============ 外观生成器类 ============

export class AppearanceGenerator {
  private config: AppearanceConfig;

  constructor(config: Partial<AppearanceConfig> = {}) {
    this.config = { ...DEFAULT_APPEARANCE_CONFIG, ...config };
  }

  /**
   * 生成完整外观属性
   * @param father 父亲NPC（可为null）
   * @param mother 母亲NPC（可为null）
   * @param gender 性别
   * @returns 完整外观属性
   */
  generate(
    father: { 外观: Appearance } | null,
    mother: { 外观: Appearance } | null,
    gender: "男" | "女"
  ): Appearance {
    return {
      身高: this.generateHeight(father?.外观 ?? null, mother?.外观 ?? null),
      体型: this.generateBodyType(father?.外观 ?? null, mother?.外观 ?? null),
      肤色基调: this.generateSkinTone(father?.外观 ?? null, mother?.外观 ?? null),
      肤色深浅: this.generateSkinDepth(father?.外观 ?? null, mother?.外观 ?? null),
      发色: this.generateHairColor(father?.外观 ?? null, mother?.外观 ?? null),
      发型: this.generateHairStyle(gender),
      五官风格: this.generateFaceStyle(),
      表情基调: this.generateExpression(),
      书生气: 0, // 后天积累，初始为0
      时髦度: randomRange(1, 5), // 初始随机
    };
  }

  /**
   * 生成始祖NPC外观（无父母，完全随机）
   * @param gender 性别
   * @returns 完整外观属性
   */
  generateInitial(gender: "男" | "女"): Appearance {
    return this.generate(null, null, gender);
  }

  // ============ 各属性生成方法 ============

  /**
   * 生成身高 (1-10)
   * 遗传公式：父母均值 × 遗传系数 + 随机 × (1-遗传系数)
   */
  private generateHeight(father: Appearance | null, mother: Appearance | null): number {
    if (!father || !mother) {
      // 始祖NPC：正态分布，集中在4-8
      return clamp(randomRange(3, 8) + (Math.random() > 0.5 ? 1 : 0), 1, 10);
    }

    const parentMean = (father.身高 + mother.身高) / 2;
    const randomFactor = randomRange(1, 10);
    
    return clamp(
      Math.round(
        parentMean * this.config.heightHeritability +
        randomFactor * (1 - this.config.heightHeritability)
      ),
      1, 10
    );
  }

  /**
   * 生成体型
   * 有遗传倾向，但随机性较大
   */
  private generateBodyType(father: Appearance | null, mother: Appearance | null): BodyType {
    const options: { value: BodyType; weight: number }[] = [
      { value: "瘦", weight: 15 },
      { value: "标准", weight: 50 },
      { value: "壮", weight: 25 },
      { value: "胖", weight: 10 },
    ];

    // 如果父母体型相同，增加该体型的权重
    if (father && mother && father.体型 === mother.体型) {
      const sameType = father.体型;
      options.forEach(opt => {
        if (opt.value === sameType) {
          opt.weight *= 2; // 权重翻倍
        }
      });
    }

    return weightedRandom(options);
  }

  /**
   * 生成肤色基调
   * 强遗传
   */
  private generateSkinTone(father: Appearance | null, mother: Appearance | null): SkinTone {
    const options: { value: SkinTone; weight: number }[] = [
      { value: "白皙", weight: 25 },
      { value: "暖色", weight: 35 },
      { value: "麦色", weight: 25 },
      { value: "深色", weight: 15 },
    ];

    // 父母肤色影响
    if (father && mother) {
      // 如果父母肤色相同，极高概率遗传
      if (father.肤色基调 === mother.肤色基调) {
        return father.肤色基调;
      }
      // 否则在父母之间选择
      return Math.random() > 0.5 ? father.肤色基调 : mother.肤色基调;
    }

    return weightedRandom(options);
  }

  /**
   * 生成肤色深浅 (1-5)
   */
  private generateSkinDepth(father: Appearance | null, mother: Appearance | null): number {
    if (!father || !mother) {
      return randomRange(2, 4); // 始祖集中在中间值
    }

    const parentMean = (father.肤色深浅 + mother.肤色深浅) / 2;
    return clamp(
      Math.round(parentMean * 0.7 + randomRange(1, 5) * 0.3),
      1, 5
    );
  }

  /**
   * 生成发色
   * 强遗传
   */
  private generateHairColor(father: Appearance | null, mother: Appearance | null): HairColor {
    const options: { value: HairColor; weight: number }[] = [
      { value: "黑色", weight: 40 },
      { value: "深棕", weight: 25 },
      { value: "浅棕", weight: 15 },
      { value: "金色", weight: 10 },
      { value: "红色", weight: 8 },
      { value: "灰色", weight: 2 },
    ];

    // 特殊发色：蓝色（极低概率，可解释为染发）
    if (Math.random() < 0.001) {
      return "蓝色";
    }

    // 父母发色影响
    if (father && mother) {
      if (father.发色 === mother.发色) {
        // 相同发色，85%遗传
        return Math.random() < 0.85 ? father.发色 : weightedRandom(options);
      }
      // 不同发色，各50%
      return Math.random() > 0.5 ? father.发色 : mother.发色;
    }

    return weightedRandom(options);
  }

  /**
   * 生成发型（与性别强相关）
   */
  private generateHairStyle(gender: "男" | "女"): HairStyle {
    const maleOptions: { value: HairStyle; weight: number }[] = [
      { value: "短发", weight: 60 },
      { value: "中长", weight: 30 },
      { value: "长发", weight: 5 },
      { value: "束发", weight: 5 },
    ];

    const femaleOptions: { value: HairStyle; weight: number }[] = [
      { value: "短发", weight: 20 },
      { value: "中长", weight: 35 },
      { value: "长发", weight: 35 },
      { value: "束发", weight: 10 },
    ];

    return weightedRandom(gender === "男" ? maleOptions : femaleOptions);
  }

  /**
   * 生成五官风格
   */
  private generateFaceStyle(): FaceStyle {
    const options: { value: FaceStyle; weight: number }[] = [
      { value: "柔和", weight: 30 },
      { value: "锐利", weight: 25 },
      { value: "方正", weight: 25 },
      { value: "圆润", weight: 20 },
    ];
    return weightedRandom(options);
  }

  /**
   * 生成表情基调
   */
  private generateExpression(): Expression {
    const options: { value: Expression; weight: number }[] = [
      { value: "严肃", weight: 25 },
      { value: "温和", weight: 35 },
      { value: "活泼", weight: 25 },
      { value: "忧郁", weight: 15 },
    ];
    return weightedRandom(options);
  }

  // ============ 辅助方法 ============

  /**
   * 计算最终肤色色值
   */
  static getFinalSkinColor(appearance: Appearance): string {
    const baseColor = SKIN_COLORS[appearance.肤色基调];
    const depthFactor = 0.8 + appearance.肤色深浅 * 0.1;
    
    // 简单的色值调整（实际应用中可能需要更复杂的颜色计算）
    return baseColor.base;
  }

  /**
   * 获取发色色值
   */
  static getHairColorValue(appearance: Appearance): string {
    return HAIR_COLORS[appearance.发色];
  }

  /**
   * 获取身高缩放比例
   */
  static getHeightScale(appearance: Appearance): number {
    // 1-10 映射到 0.85-1.10
    return 0.85 + (appearance.身高 - 1) * (0.25 / 9);
  }

  /**
   * 获取体型宽度缩放
   */
  static getBodyWidthScale(appearance: Appearance): number {
    const scaleMap: Record<BodyType, number> = {
      瘦: 0.85,
      标准: 1.0,
      壮: 1.15,
      胖: 1.25,
    };
    return scaleMap[appearance.体型];
  }
}

// ============ 便捷函数 ============

/**
 * 快速生成外观属性
 */
export function generateAppearance(
  father: { 外观: Appearance } | null,
  mother: { 外观: Appearance } | null,
  gender: "男" | "女"
): Appearance {
  const generator = new AppearanceGenerator();
  return generator.generate(father, mother, gender);
}

/**
 * 生成始祖NPC外观
 */
export function generateInitialAppearance(gender: "男" | "女"): Appearance {
  const generator = new AppearanceGenerator();
  return generator.generateInitial(gender);
}

// ============ 外观描述生成 ============

/**
 * 生成外观的自然语言描述
 */
export function generateAppearanceDescription(
  appearance: Appearance,
  gender: "男" | "女"
): string {
  const parts: string[] = [];

  // 身高描述
  const heightDesc = getHeightDescription(appearance.身高);
  if (heightDesc) parts.push(heightDesc);

  // 体型描述
  const bodyDesc = getBodyTypeDescription(appearance.体型);
  if (bodyDesc) parts.push(bodyDesc);

  // 肤色描述
  parts.push(`${appearance.肤色基调}肤色`);

  // 发色发型
  const hairDesc = getHairDescription(appearance.发色, appearance.发型, gender);
  parts.push(hairDesc);

  // 面部描述
  parts.push(`${appearance.五官风格}的五官，表情${appearance.表情基调}`);

  // 气质
  if (appearance.书生气 > 5) {
    parts.push(`带着书卷气`);
  }
  if (appearance.时髦度 > 7) {
    parts.push(`穿着时髦`);
  }

  return parts.join("，");
}

function getHeightDescription(height: number): string {
  if (height <= 2) return "身材矮小";
  if (height <= 4) return "个子偏矮";
  if (height <= 7) return ""; // 标准身高不特别描述
  if (height <= 9) return "身材高挑";
  return "个子很高";
}

function getBodyTypeDescription(bodyType: BodyType): string {
  const descMap: Record<BodyType, string> = {
    瘦: "身形单薄",
    标准: "",
    壮: "体格健壮",
    胖: "体态丰满",
  };
  return descMap[bodyType];
}

function getHairDescription(
  hairColor: HairColor,
  hairStyle: HairStyle,
  gender: "男" | "女"
): string {
  const styleDescMap: Record<HairStyle, string> = {
    短发: "短发",
    中长: "中长发",
    长发: "长发",
    束发: "束发",
  };

  return `${hairColor}${styleDescMap[hairStyle]}`;
}

// ============ 导出默认实例 ============

export const appearanceGenerator = new AppearanceGenerator();
