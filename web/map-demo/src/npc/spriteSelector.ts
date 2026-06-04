/**
 * 精灵图选择器
 * 根据外观属性选择或生成对应的精灵图
 * 
 * 核心原则：不是为每个"职业"准备精灵图，而是基于属性组合
 */

import type { Appearance, BodyType, SkinTone, HairColor, FaceStyle, Expression } from "./appearanceGenerator";
import { SKIN_COLORS, HAIR_COLORS, AppearanceGenerator } from "./appearanceGenerator";

// ============ 精灵图配置 ============

export interface SpriteConfig {
  /** 基础模板 */
  baseTemplate: "male" | "female";
  /** 身高缩放 0.85-1.10 */
  heightScale: number;
  /** 体型宽度缩放 0.85-1.25 */
  bodyWidthScale: number;
  /** 肤色色值 */
  skinColor: string;
  /** 发色色值 */
  hairColor: string;
  /** 发型 */
  hairStyle: "short" | "medium" | "long" | "bun";
  /** 五官风格 */
  faceStyle: "soft" | "sharp" | "square" | "round";
  /** 表情基调 */
  expression: "serious" | "gentle" | "lively" | "melancholy";
}

// ============ 属性映射表 ============

const BODY_TYPE_MAP: Record<BodyType, number> = {
  瘦: 0.85,
  标准: 1.0,
  壮: 1.15,
  胖: 1.25,
};

const HAIR_STYLE_MAP: Record<string, "short" | "medium" | "long" | "bun"> = {
  短发: "short",
  中长: "medium",
  长发: "long",
  束发: "bun",
};

const FACE_STYLE_MAP: Record<FaceStyle, "soft" | "sharp" | "square" | "round"> = {
  柔和: "soft",
  锐利: "sharp",
  方正: "square",
  圆润: "round",
};

const EXPRESSION_MAP: Record<Expression, "serious" | "gentle" | "lively" | "melancholy"> = {
  严肃: "serious",
  温和: "gentle",
  活泼: "lively",
  忧郁: "melancholy",
};

// ============ 精灵图选择器 ============

export class SpriteSelector {
  /**
   * 根据外观属性生成精灵图配置
   */
  generateConfig(appearance: Appearance, gender: "男" | "女"): SpriteConfig {
    return {
      baseTemplate: gender === "男" ? "male" : "female",
      heightScale: AppearanceGenerator.getHeightScale(appearance),
      bodyWidthScale: AppearanceGenerator.getBodyWidthScale(appearance),
      skinColor: AppearanceGenerator.getFinalSkinColor(appearance),
      hairColor: AppearanceGenerator.getHairColorValue(appearance),
      hairStyle: HAIR_STYLE_MAP[appearance.发型],
      faceStyle: FACE_STYLE_MAP[appearance.五官风格],
      expression: EXPRESSION_MAP[appearance.表情基调],
    };
  }

  /**
   * 选择最接近的预置精灵图
   * 简化版：基于关键属性选择
   */
  selectPresetSprite(appearance: Appearance, gender: "男" | "女"): string {
    // 构建精灵图标识符
    const parts: string[] = [];

    // 体型
    parts.push(this.getBodyTypeCode(appearance.体型));

    // 肤色
    parts.push(this.getSkinToneCode(appearance.肤色基调));

    // 发色
    parts.push(this.getHairColorCode(appearance.发色));

    // 性别
    parts.push(gender === "男" ? "m" : "f");

    // 风格
    parts.push(this.getFaceStyleCode(appearance.五官风格));

    return `sprites/${parts.join("_")}.png`;
  }

  /**
   * 生成AI绘画提示词
   */
  generateAIPrompt(appearance: Appearance, gender: "男" | "女"): string {
    const config = this.generateConfig(appearance, gender);

    const descriptions: string[] = [];

    // 体型描述
    if (config.bodyWidthScale > 1.1) {
      descriptions.push(gender === "男" ? "muscular build" : "curvy figure");
    } else if (config.bodyWidthScale < 0.9) {
      descriptions.push("slender build");
    }

    // 肤色
    const skinDesc = this.getSkinDescription(appearance.肤色基调);
    descriptions.push(`${skinDesc} skin`);

    // 发色发型
    const hairDesc = this.getHairDescription(appearance.发色, appearance.发型);
    descriptions.push(hairDesc);

    // 面部
    descriptions.push(`${config.faceStyle} facial features`);
    descriptions.push(`${config.expression} expression`);

    // 书生气
    if (appearance.书生气 > 5) {
      descriptions.push("scholarly aura");
    }

    const basePrompt = `Professional pixel art character sprite sheet, 12-frame animation, 32x64px per frame,
top-down RPG, 4-directional walk cycle, Q-chibi big head style,

Character: ${gender === "男" ? "Male" : "Female"} villager, ${descriptions.join(", ")},
16-bit palette, flat shading, Stardew Valley style,
transparent background, game asset, high quality`;

    return basePrompt;
  }

  // ============ 辅助方法 ============

  private getBodyTypeCode(bodyType: BodyType): string {
    const codeMap: Record<BodyType, string> = {
      瘦: "thin",
      标准: "std",
      壮: "strong",
      胖: "heavy",
    };
    return codeMap[bodyType];
  }

  private getSkinToneCode(skinTone: SkinTone): string {
    const codeMap: Record<SkinTone, string> = {
      白皙: "pale",
      暖色: "warm",
      麦色: "wheat",
      深色: "dark",
    };
    return codeMap[skinTone];
  }

  private getHairColorCode(hairColor: HairColor): string {
    const codeMap: Record<HairColor, string> = {
      黑色: "black",
      深棕: "brn",
      浅棕: "lbrn",
      金色: "blond",
      红色: "red",
      灰色: "gray",
      蓝色: "blue",
    };
    return codeMap[hairColor];
  }

  private getFaceStyleCode(faceStyle: FaceStyle): string {
    const codeMap: Record<FaceStyle, string> = {
      柔和: "soft",
      锐利: "sharp",
      方正: "square",
      圆润: "round",
    };
    return codeMap[faceStyle];
  }

  private getSkinDescription(skinTone: SkinTone): string {
    const descMap: Record<SkinTone, string> = {
      白皙: "pale",
      暖色: "warm beige",
      麦色: "wheat-toned",
      深色: "deep",
    };
    return descMap[skinTone];
  }

  private getHairDescription(hairColor: HairColor, hairStyle: string): string {
    const colorMap: Record<HairColor, string> = {
      黑色: "black",
      深棕: "dark brown",
      浅棕: "light brown",
      金色: "blonde",
      红色: "red",
      灰色: "gray",
      蓝色: "blue",
    };

    const styleMap: Record<string, string> = {
      短发: "short hair",
      中长: "medium length hair",
      长发: "long hair",
      束发: "hair in a bun",
    };

    return `${colorMap[hairColor]} ${styleMap[hairStyle]}`;
  }
}

// ============ 便捷函数 ============

export function generateSpriteConfig(appearance: Appearance, gender: "男" | "女"): SpriteConfig {
  const selector = new SpriteSelector();
  return selector.generateConfig(appearance, gender);
}

export function selectSprite(appearance: Appearance, gender: "男" | "女"): string {
  const selector = new SpriteSelector();
  return selector.selectPresetSprite(appearance, gender);
}

export function generateAIPrompt(appearance: Appearance, gender: "男" | "女"): string {
  const selector = new SpriteSelector();
  return selector.generateAIPrompt(appearance, gender);
}

// ============ 批量生成工具 ============

/**
 * 批量生成NPC外观和对应的AI提示词
 */
export function batchGenerateNPCs(count: number): Array<{
  id: number;
  gender: "男" | "女";
  appearance: Appearance;
  description: string;
  aiPrompt: string;
  spritePath: string;
}> {
  const { generateInitialAppearance, generateAppearanceDescription } = await import(
    "./appearanceGenerator"
  );

  const results = [];
  const selector = new SpriteSelector();

  for (let i = 0; i < count; i++) {
    const gender = Math.random() > 0.5 ? "男" : "女";
    const appearance = generateInitialAppearance(gender);

    results.push({
      id: i + 1,
      gender,
      appearance,
      description: generateAppearanceDescription(appearance, gender),
      aiPrompt: selector.generateAIPrompt(appearance, gender),
      spritePath: selector.selectPresetSprite(appearance, gender),
    });
  }

  return results;
}

// ============ 导出默认实例 ============

export const spriteSelector = new SpriteSelector();
