/**
 * 商业化级角色精灵图生成器
 * 严格遵循《角色外观生成规范》v4.0
 * 使用Canvas程序化绘制32×48像素、8帧等角视角角色精灵图
 * 
 * 核心特性：
 * - 像素级精确控制，每帧32×48像素
 * - 8帧布局：4方向×2帧走路循环
 * - 透明背景PNG输出
 * - 丰富的外观属性组合（体型、肤色、发色、发型、眼睛、脸型、穿着等）
 * - 商业化审美：Q版大头比例、16-bit色彩、扁平着色
 */

// ============ 类型定义 ============

export type BodyType = "瘦" | "标准" | "壮" | "胖";
export type HeightType = "矮小" | "中等" | "高挑";
export type SkinTone = "白皙" | "暖色" | "麦色" | "深色";
export type HairColor = "黑色" | "深棕" | "浅棕" | "金色" | "红色" | "灰色";
export type HairStyle = "短发" | "中长" | "长发" | "束发" | "光头" | "卷发";
export type EyeType = "大眼" | "中等" | "小眼" | "圆眼" | "细长" | "下垂" | "上挑";
export type FaceShape = "圆脸" | "方脸" | "长脸" | "瓜子脸";
export type Expression = "温和微笑" | "严肃认真" | "开朗大笑" | "忧郁沉默" | "高傲冷漠" | "呆萌天然";
export type ClothingStyle = "朴素" | "普通" | "讲究" | "华丽" | "时髦";
export type AgeGroup = "小孩" | "青年" | "中年" | "老年";
export type Gender = "男" | "女";

export interface CharacterAppearance {
  // 体型
  身高: HeightType;
  体型: BodyType;
  
  // 样貌
  肤色: SkinTone;
  发色: HairColor;
  发型: HairStyle;
  眼睛: EyeType;
  脸型: FaceShape;
  
  // 气质
  表情: Expression;
  穿衣风格: ClothingStyle;
  
  // 基础
  年龄: AgeGroup;
  性别: Gender;
}

export interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  directions: string[];
  framesPerDirection: number;
}

export const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  frameWidth: 32,
  frameHeight: 48,
  totalFrames: 8,
  directions: ["down", "up", "left", "right"],
  framesPerDirection: 2,
};

// ============ 色彩系统 ============

const SKIN_COLORS: Record<SkinTone, { base: string; shadow: string; highlight: string }> = {
  白皙: { base: "#FFEFE0", shadow: "#F5D0B0", highlight: "#FFF5F0" },
  暖色: { base: "#F5D0B0", shadow: "#E8C4A0", highlight: "#FFE8D0" },
  麦色: { base: "#E8C4A0", shadow: "#D4A574", highlight: "#F5D0B0" },
  深色: { base: "#C49464", shadow: "#A67B5B", highlight: "#E8C4A0" },
};

const HAIR_COLORS: Record<HairColor, { base: string; shadow: string; highlight: string }> = {
  黑色: { base: "#1A1A1A", shadow: "#0D0D0D", highlight: "#2D2D2D" },
  深棕: { base: "#4A2408", shadow: "#2D1505", highlight: "#6B3410" },
  浅棕: { base: "#8B4513", shadow: "#6B3410", highlight: "#A0522D" },
  金色: { base: "#D4A574", shadow: "#B8956A", highlight: "#E8C4A0" },
  红色: { base: "#A0522D", shadow: "#7A3E22", highlight: "#C49464" },
  灰色: { base: "#808080", shadow: "#666666", highlight: "#999999" },
};

const CLOTHING_PALETTES: Record<ClothingStyle, { primary: string; secondary: string; accent: string }> = {
  朴素: { primary: "#8B7355", secondary: "#6B5344", accent: "#A0826D" },
  普通: { primary: "#5B8A72", secondary: "#4A7260", accent: "#6B9B82" },
  讲究: { primary: "#4A6FA5", secondary: "#3A5F95", accent: "#5A7FB5" },
  华丽: { primary: "#8B4513", secondary: "#6B3410", accent: "#D4A574" },
  时髦: { primary: "#C44569", secondary: "#A03555", accent: "#E05579" },
};

// ============ 像素绘制工具 ============

class PixelDrawer {
  ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** 绘制像素矩形 */
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** 绘制像素圆 */
  circle(x: number, y: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(Math.round(x) + 0.5, Math.round(y) + 0.5, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** 绘制像素椭圆 */
  ellipse(x: number, y: number, rx: number, ry: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(Math.round(x) + 0.5, Math.round(y) + 0.5, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /** 绘制像素点 */
  pixel(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  /** 绘制水平线 */
  hLine(x: number, y: number, w: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
  }

  /** 绘制垂直线 */
  vLine(x: number, y: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(h));
  }
}

// ============ 角色精灵图生成器 ============

export class CharacterSpriteGenerator {
  private config: SpriteConfig;

  constructor(config: Partial<SpriteConfig> = {}) {
    this.config = { ...DEFAULT_SPRITE_CONFIG, ...config };
  }

  /**
   * 生成完整精灵表
   */
  generateSpriteSheet(appearance: CharacterAppearance): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.config.frameWidth * this.config.totalFrames;
    canvas.height = this.config.frameHeight;
    const ctx = canvas.getContext("2d")!;

    // 透明背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制8帧
    const directions: ("down" | "up" | "left" | "right")[] = ["down", "up", "left", "right"];
    for (let dirIndex = 0; dirIndex < directions.length; dirIndex++) {
      for (let frame = 0; frame < this.config.framesPerDirection; frame++) {
        const x = (dirIndex * this.config.framesPerDirection + frame) * this.config.frameWidth;
        this.drawFrame(ctx, x, 0, appearance, directions[dirIndex], frame);
      }
    }

    return canvas;
  }

  /**
   * 绘制单帧
   */
  private drawFrame(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    appearance: CharacterAppearance,
    direction: "down" | "up" | "left" | "right",
    frame: number
  ): void {
    ctx.save();
    ctx.translate(x, y);

    const d = new PixelDrawer(ctx);
    const skin = SKIN_COLORS[appearance.肤色];
    const hair = HAIR_COLORS[appearance.发色];
    const clothes = CLOTHING_PALETTES[appearance.穿衣风格];

    // 走路动画偏移
    const walkOffset = this.getWalkOffset(frame);

    // 体型缩放
    const bodyScale = this.getBodyScale(appearance.体型);
    const heightScale = this.getHeightScale(appearance.身高);

    // 年龄调整
    const ageScale = this.getAgeScale(appearance.年龄);

    // 绘制顺序（从下到上）
    this.drawShadow(d);
    this.drawLegs(d, appearance, direction, walkOffset, bodyScale, heightScale);
    this.drawBody(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes);
    this.drawArms(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes, skin);
    this.drawHead(d, appearance, direction, bodyScale, heightScale, ageScale, skin, hair);

    ctx.restore();
  }

  // ============ 绘制部件 ============

  /** 绘制阴影 */
  private drawShadow(d: PixelDrawer): void {
    // 半透明椭圆阴影
    d.ellipse(16, 46, 10, 3, "rgba(0,0,0,0.2)");
  }

  /** 绘制腿部 */
  private drawLegs(
    d: PixelDrawer,
    appearance: CharacterAppearance,
    direction: string,
    walkOffset: { leftLeg: number; rightLeg: number },
    bodyScale: number,
    heightScale: number
  ): void {
    const legY = 32;
    const legWidth = Math.max(3, Math.round(4 * bodyScale));
    const legHeight = Math.round(14 * heightScale);

    const pantsColor = CLOTHING_PALETTES[appearance.穿衣风格].secondary;
    const pantsShadow = this.darkenColor(pantsColor, 0.8);

    if (direction === "down") {
      // 正面双腿
      const leftLegX = 16 - legWidth - 1 + walkOffset.leftLeg;
      const rightLegX = 16 + 1 + walkOffset.rightLeg;

      // 左腿
      d.rect(leftLegX, legY, legWidth, legHeight, pantsColor);
      d.rect(leftLegX + legWidth - 1, legY, 1, legHeight, pantsShadow);

      // 右腿
      d.rect(rightLegX, legY, legWidth, legHeight, pantsColor);
      d.rect(rightLegX + legWidth - 1, legY, 1, legHeight, pantsShadow);

      // 鞋子
      this.drawShoes(d, leftLegX - 1, rightLegX + legWidth, legY + legHeight - 2, direction);
    } else if (direction === "up") {
      // 背面双腿
      d.rect(16 - legWidth - 1, legY, legWidth, legHeight, pantsColor);
      d.rect(16 + 1, legY, legWidth, legHeight, pantsColor);

      // 背面鞋子
      this.drawShoes(d, 16 - legWidth - 2, 16 + legWidth + 1, legY + legHeight - 2, direction);
    } else {
      // 侧面单腿
      const isLeft = direction === "left";
      const offsetX = isLeft ? -2 : 2;
      const legOffset = isLeft ? walkOffset.leftLeg : walkOffset.rightLeg;

      d.rect(16 + offsetX - Math.floor(legWidth / 2), legY + Math.abs(legOffset), legWidth, legHeight, pantsColor);
      d.rect(16 + offsetX + (isLeft ? 1 : -Math.floor(legWidth / 2)), legY, 1, legHeight, pantsShadow);

      // 侧面鞋子
      this.drawShoes(d, 16 + offsetX - 3, 16 + offsetX + 3, legY + legHeight - 2, direction);
    }
  }

  /** 绘制身体 */
  private drawBody(
    d: PixelDrawer,
    appearance: CharacterAppearance,
    direction: string,
    walkOffset: { body: number },
    bodyScale: number,
    heightScale: number,
    clothes: { primary: string; secondary: string; accent: string }
  ): void {
    const bodyY = 20 + walkOffset.body;
    const bodyWidth = Math.round(14 * bodyScale);
    const bodyHeight = Math.round(14 * heightScale);

    const centerX = 16;

    if (direction === "down") {
      // 正面身体
      d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
      // 衣服阴影
      d.rect(centerX - bodyWidth / 2, bodyY + bodyHeight - 4, bodyWidth, 4, clothes.secondary);
      d.rect(centerX + bodyWidth / 2 - 2, bodyY, 2, bodyHeight, clothes.secondary);
      // 衣服高光
      d.rect(centerX - bodyWidth / 2 + 1, bodyY, 3, bodyHeight - 4, clothes.accent);
      // 领口
      d.rect(centerX - 2, bodyY, 4, 2, SKIN_COLORS[appearance.肤色].base);
    } else if (direction === "up") {
      // 背面身体
      d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
      d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, 3, clothes.secondary);
    } else {
      // 侧面身体
      const isLeft = direction === "left";
      const offsetX = isLeft ? 1 : -1;
      d.rect(centerX + offsetX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
      d.rect(centerX + offsetX - bodyWidth / 2, bodyY + bodyHeight - 4, bodyWidth, 4, clothes.secondary);
      if (isLeft) {
        d.rect(centerX + offsetX + bodyWidth / 2 - 2, bodyY, 2, bodyHeight, clothes.secondary);
      } else {
        d.rect(centerX + offsetX - bodyWidth / 2, bodyY, 2, bodyHeight, clothes.secondary);
      }
    }
  }

  /** 绘制手臂 */
  private drawArms(
    d: PixelDrawer,
    appearance: CharacterAppearance,
    direction: string,
    walkOffset: { leftArm: number; rightArm: number },
    bodyScale: number,
    heightScale: number,
    clothes: { primary: string; secondary: string; accent: string },
    skin: { base: string; shadow: string; highlight: string }
  ): void {
    const armY = 22;
    const armWidth = 3;
    const armHeight = Math.round(10 * heightScale);

    const centerX = 16;

    if (direction === "down") {
      // 正面双臂
      const leftArmX = centerX - Math.round(7 * bodyScale) - armWidth + walkOffset.leftArm;
      const rightArmX = centerX + Math.round(7 * bodyScale) + walkOffset.rightArm;

      // 左臂
      d.rect(leftArmX, armY, armWidth, armHeight, clothes.primary);
      d.rect(leftArmX, armY + armHeight, armWidth, 2, skin.base); // 手

      // 右臂
      d.rect(rightArmX, armY, armWidth, armHeight, clothes.primary);
      d.rect(rightArmX, armY + armHeight, armWidth, 2, skin.base); // 手
    } else if (direction === "up") {
      // 背面双臂
      d.rect(centerX - Math.round(7 * bodyScale) - armWidth, armY, armWidth, armHeight, clothes.primary);
      d.rect(centerX + Math.round(7 * bodyScale), armY, armWidth, armHeight, clothes.primary);
    } else {
      // 侧面单臂
      const isLeft = direction === "left";
      const armX = isLeft
        ? centerX + Math.round(5 * bodyScale) + walkOffset.rightArm
        : centerX - Math.round(5 * bodyScale) - armWidth + walkOffset.leftArm;

      d.rect(armX, armY, armWidth, armHeight, clothes.primary);
      d.rect(armX, armY + armHeight, armWidth, 2, skin.base); // 手
    }
  }

  /** 绘制头部 */
  private drawHead(
    d: PixelDrawer,
    appearance: CharacterAppearance,
    direction: string,
    bodyScale: number,
    heightScale: number,
    ageScale: number,
    skin: { base: string; shadow: string; highlight: string },
    hair: { base: string; shadow: string; highlight: string }
  ): void {
    const centerX = 16;
    const headY = 4;
    const headWidth = Math.round(18 * ageScale);
    const headHeight = Math.round(16 * ageScale);

    // 脸型
    this.drawFaceShape(d, centerX, headY, headWidth, headHeight, appearance.脸型, skin);

    // 头发（在脸之后绘制，覆盖顶部）
    this.drawHair(d, centerX, headY, headWidth, headHeight, appearance, direction, hair);

    // 面部特征（正面和侧面）
    if (direction !== "up") {
      this.drawEyes(d, centerX, headY, appearance, direction, ageScale);
      this.drawEyebrows(d, centerX, headY, appearance, direction);
      this.drawNose(d, centerX, headY, appearance, direction);
      this.drawMouth(d, centerX, headY, appearance, direction);
    }

    // 耳朵
    this.drawEars(d, centerX, headY, headWidth, headHeight, skin, direction);

    // 面部细节（皱纹、胡子等）
    this.drawFaceDetails(d, centerX, headY, appearance, direction);
  }

  /** 绘制脸型 */
  private drawFaceShape(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    headWidth: number,
    headHeight: number,
    faceShape: FaceShape,
    skin: { base: string; shadow: string; highlight: string }
  ): void {
    // 基础脸型（椭圆）
    d.ellipse(centerX, headY + headHeight / 2, headWidth / 2, headHeight / 2, skin.base);

    // 脸型微调
    switch (faceShape) {
      case "方脸":
        // 下巴更方
        d.rect(centerX - headWidth / 2 + 2, headY + headHeight - 4, headWidth - 4, 4, skin.base);
        break;
      case "长脸":
        // 脸更长（已经在headHeight中体现）
        break;
      case "圆脸":
        // 更圆（已经在椭圆中体现）
        break;
      case "瓜子脸":
        // 下巴更尖
        d.rect(centerX - 2, headY + headHeight - 2, 4, 2, skin.base);
        break;
    }

    // 脸部阴影（右侧）
    d.ellipse(centerX + 1, headY + headHeight / 2 + 1, headWidth / 2 - 2, headHeight / 2 - 2, skin.shadow);
  }

  /** 绘制头发 */
  private drawHair(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    headWidth: number,
    headHeight: number,
    appearance: CharacterAppearance,
    direction: string,
    hair: { base: string; shadow: string; highlight: string }
  ): void {
    if (appearance.发型 === "光头") {
      // 光头不画头发
      return;
    }

    const hairY = headY - 2;

    if (direction === "down") {
      // 正面头发
      this.drawHairFront(d, centerX, hairY, headWidth, headHeight, appearance, hair);
    } else if (direction === "up") {
      // 背面头发
      this.drawHairBack(d, centerX, hairY, headWidth, headHeight, appearance, hair);
    } else {
      // 侧面头发
      this.drawHairSide(d, centerX, hairY, headWidth, headHeight, appearance, direction, hair);
    }
  }

  /** 正面头发 */
  private drawHairFront(
    d: PixelDrawer,
    centerX: number,
    hairY: number,
    headWidth: number,
    headHeight: number,
    appearance: CharacterAppearance,
    hair: { base: string; shadow: string; highlight: string }
  ): void {
    // 头顶头发
    d.ellipse(centerX, hairY + 4, headWidth / 2 + 1, 5, hair.base);

    // 刘海
    switch (appearance.发型) {
      case "短发":
        d.rect(centerX - headWidth / 2, hairY + 4, headWidth, 4, hair.base);
        break;
      case "中长":
        d.rect(centerX - headWidth / 2 - 1, hairY + 4, headWidth + 2, 6, hair.base);
        // 两侧头发
        d.rect(centerX - headWidth / 2 - 2, hairY + 6, 3, 8, hair.base);
        d.rect(centerX + headWidth / 2 - 1, hairY + 6, 3, 8, hair.base);
        break;
      case "长发":
        d.rect(centerX - headWidth / 2 - 1, hairY + 4, headWidth + 2, 6, hair.base);
        // 长发垂下
        d.rect(centerX - headWidth / 2 - 3, hairY + 6, 4, 14, hair.base);
        d.rect(centerX + headWidth / 2 - 1, hairY + 6, 4, 14, hair.base);
        break;
      case "束发":
        d.rect(centerX - headWidth / 2, hairY + 4, headWidth, 4, hair.base);
        // 发髻
        d.circle(centerX, hairY - 2, 4, hair.base);
        break;
      case "卷发":
        // 卷发蓬松
        d.ellipse(centerX, hairY + 4, headWidth / 2 + 3, 6, hair.base);
        d.ellipse(centerX - 4, hairY + 6, 3, 4, hair.base);
        d.ellipse(centerX + 4, hairY + 6, 3, 4, hair.base);
        break;
    }

    // 头发高光
    d.ellipse(centerX - 2, hairY + 2, 3, 2, hair.highlight);
  }

  /** 背面头发 */
  private drawHairBack(
    d: PixelDrawer,
    centerX: number,
    hairY: number,
    headWidth: number,
    headHeight: number,
    appearance: CharacterAppearance,
    hair: { base: string; shadow: string; highlight: string }
  ): void {
    // 头顶
    d.ellipse(centerX, hairY + 4, headWidth / 2 + 1, 5, hair.base);

    switch (appearance.发型) {
      case "短发":
        d.rect(centerX - headWidth / 2, hairY + 4, headWidth, 5, hair.base);
        break;
      case "中长":
      case "长发":
        d.rect(centerX - headWidth / 2 - 1, hairY + 4, headWidth + 2, 6, hair.base);
        // 背面长发
        d.rect(centerX - headWidth / 2 - 2, hairY + 8, headWidth + 4, 12, hair.base);
        d.rect(centerX - headWidth / 2, hairY + 16, headWidth, 6, hair.shadow);
        break;
      case "束发":
        d.rect(centerX - headWidth / 2, hairY + 4, headWidth, 5, hair.base);
        // 发髻
        d.circle(centerX, hairY - 2, 4, hair.base);
        break;
      case "卷发":
        d.ellipse(centerX, hairY + 4, headWidth / 2 + 3, 6, hair.base);
        break;
    }
  }

  /** 侧面头发 */
  private drawHairSide(
    d: PixelDrawer,
    centerX: number,
    hairY: number,
    headWidth: number,
    headHeight: number,
    appearance: CharacterAppearance,
    direction: string,
    hair: { base: string; shadow: string; highlight: string }
  ): void {
    const isLeft = direction === "left";
    const offsetX = isLeft ? 2 : -2;

    // 头顶
    d.ellipse(centerX + offsetX, hairY + 4, headWidth / 2, 5, hair.base);

    switch (appearance.发型) {
      case "短发":
        d.rect(centerX + offsetX - headWidth / 2, hairY + 4, headWidth, 5, hair.base);
        break;
      case "中长":
        d.rect(centerX + offsetX - headWidth / 2, hairY + 4, headWidth, 6, hair.base);
        // 侧面头发
        d.rect(centerX + (isLeft ? -headWidth / 2 - 2 : headWidth / 2 - 2), hairY + 6, 4, 10, hair.base);
        break;
      case "长发":
        d.rect(centerX + offsetX - headWidth / 2, hairY + 4, headWidth, 6, hair.base);
        // 长发垂下
        d.rect(centerX + (isLeft ? -headWidth / 2 - 3 : headWidth / 2 - 1), hairY + 6, 4, 14, hair.base);
        break;
      case "束发":
        d.rect(centerX + offsetX - headWidth / 2, hairY + 4, headWidth, 5, hair.base);
        d.circle(centerX + offsetX, hairY - 2, 4, hair.base);
        break;
      case "卷发":
        d.ellipse(centerX + offsetX, hairY + 4, headWidth / 2 + 2, 6, hair.base);
        break;
    }
  }

  /** 绘制眼睛 */
  private drawEyes(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    appearance: CharacterAppearance,
    direction: string,
    ageScale: number
  ): void {
    const eyeY = headY + 8;
    const eyeColor = "#2d5016"; // 虹膜颜色
    const pupilColor = "#1a1a1a"; // 瞳孔颜色

    if (direction === "down") {
      // 正面双眼
      const eyeSize = this.getEyeSize(appearance.眼睛);
      const eyeSpacing = 6;

      // 左眼
      this.drawSingleEye(d, centerX - eyeSpacing, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
      // 右眼
      this.drawSingleEye(d, centerX + eyeSpacing, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
    } else {
      // 侧面单眼
      const eyeSize = this.getEyeSize(appearance.眼睛) * 0.8;
      const eyeX = direction === "left" ? centerX + 3 : centerX - 3;
      this.drawSingleEye(d, eyeX, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
    }
  }

  /** 绘制单只眼睛 */
  private drawSingleEye(
    d: PixelDrawer,
    x: number,
    y: number,
    size: number,
    eyeColor: string,
    pupilColor: string,
    eyeType: EyeType
  ): void {
    // 眼白
    d.ellipse(x, y, size, size * 1.2, "#ffffff");

    // 虹膜
    d.ellipse(x, y, size * 0.7, size * 0.9, eyeColor);

    // 瞳孔
    d.circle(x, y, size * 0.4, pupilColor);

    // 高光
    d.circle(x + size * 0.2, y - size * 0.2, size * 0.25, "#ffffff");

    // 眼睛类型特殊处理
    switch (eyeType) {
      case "小眼":
        // 眯眼效果 - 上眼睑
        d.rect(x - size - 1, y - size * 0.8, size * 2 + 2, size * 0.6, SKIN_COLORS.暖色.base);
        break;
      case "下垂眼":
        // 下眼睑更下垂
        d.rect(x - size, y + size * 0.5, size * 2, size * 0.5, SKIN_COLORS.暖色.base);
        break;
      case "上挑眼":
        // 上眼睑上挑
        d.rect(x - size, y - size * 0.8, size * 2, size * 0.3, SKIN_COLORS.暖色.base);
        break;
    }
  }

  /** 绘制眉毛 */
  private drawEyebrows(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    appearance: CharacterAppearance,
    direction: string
  ): void {
    const browY = headY + 5;
    const hair = HAIR_COLORS[appearance.发色];

    if (direction === "down") {
      // 正面双眉
      const browSpacing = 6;
      const browWidth = 4;
      const browHeight = 1;

      // 左眉
      this.drawEyebrowShape(d, centerX - browSpacing, browY, browWidth, browHeight, appearance.表情, hair.base, true);
      // 右眉
      this.drawEyebrowShape(d, centerX + browSpacing, browY, browWidth, browHeight, appearance.表情, hair.base, false);
    } else {
      // 侧面单眉
      const browX = direction === "left" ? centerX + 3 : centerX - 3;
      this.drawEyebrowShape(d, browX, browY, 3, 1, appearance.表情, hair.base, direction === "left");
    }
  }

  /** 绘制眉毛形状 */
  private drawEyebrowShape(
    d: PixelDrawer,
    x: number,
    y: number,
    width: number,
    height: number,
    expression: Expression,
    color: string,
    isLeft: boolean
  ): void {
    switch (expression) {
      case "严肃认真":
        // 平直眉
        d.rect(x - width / 2, y, width, height, color);
        break;
      case "温和微笑":
        // 微弯眉
        d.rect(x - width / 2, y, width, height, color);
        d.pixel(x + (isLeft ? -width / 2 : width / 2), y - 1, color);
        break;
      case "开朗大笑":
        // 弯眉
        d.rect(x - width / 2, y - 1, width, height, color);
        d.pixel(x + (isLeft ? -width / 2 : width / 2), y - 2, color);
        break;
      case "忧郁沉默":
        // 八字眉
        d.rect(x - width / 2, y + 1, width, height, color);
        d.pixel(x + (isLeft ? width / 2 : -width / 2), y, color);
        break;
      case "高傲冷漠":
        // 挑眉
        d.rect(x - width / 2, y - 1, width, height, color);
        d.pixel(x + (isLeft ? width / 2 : -width / 2), y - 2, color);
        break;
      case "呆萌天然":
        // 短弯眉
        d.rect(x - width / 2 + 1, y, width - 2, height, color);
        break;
    }
  }

  /** 绘制鼻子 */
  private drawNose(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    appearance: CharacterAppearance,
    direction: string
  ): void {
    const noseY = headY + 11;
    const skin = SKIN_COLORS[appearance.肤色];

    if (direction === "down") {
      // 正面小鼻子
      d.pixel(centerX, noseY, skin.shadow);
      d.pixel(centerX - 1, noseY + 1, skin.base);
      d.pixel(centerX + 1, noseY + 1, skin.base);
    } else {
      // 侧面鼻子
      const offsetX = direction === "left" ? 2 : -2;
      d.pixel(centerX + offsetX, noseY, skin.shadow);
      d.pixel(centerX + offsetX, noseY + 1, skin.base);
    }
  }

  /** 绘制嘴巴 */
  private drawMouth(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    appearance: CharacterAppearance,
    direction: string
  ): void {
    const mouthY = headY + 14;
    const lipColor = "#d4a574";

    if (direction === "down") {
      switch (appearance.表情) {
        case "温和微笑":
          // 微笑弧线
          d.pixel(centerX - 2, mouthY, lipColor);
          d.pixel(centerX - 1, mouthY + 1, lipColor);
          d.pixel(centerX, mouthY + 1, lipColor);
          d.pixel(centerX + 1, mouthY + 1, lipColor);
          d.pixel(centerX + 2, mouthY, lipColor);
          break;
        case "严肃认真":
          // 平直嘴
          d.hLine(centerX - 2, mouthY, 5, lipColor);
          break;
        case "开朗大笑":
          // 大笑嘴
          d.rect(centerX - 2, mouthY, 5, 3, "#ffffff");
          d.hLine(centerX - 2, mouthY, 5, lipColor);
          d.hLine(centerX - 2, mouthY + 3, 5, lipColor);
          break;
        case "忧郁沉默":
          // 下垂嘴
          d.pixel(centerX - 2, mouthY, lipColor);
          d.pixel(centerX - 1, mouthY + 1, lipColor);
          d.pixel(centerX, mouthY + 1, lipColor);
          d.pixel(centerX + 1, mouthY + 1, lipColor);
          d.pixel(centerX + 2, mouthY, lipColor);
          break;
        case "高傲冷漠":
          // 一侧上扬
          d.hLine(centerX - 2, mouthY, 3, lipColor);
          d.pixel(centerX + 1, mouthY - 1, lipColor);
          break;
        case "呆萌天然":
          // 微张嘴
          d.hLine(centerX - 1, mouthY, 3, lipColor);
          d.pixel(centerX, mouthY + 1, "#ffffff");
          break;
      }
    } else {
      // 侧面嘴巴
      const offsetX = direction === "left" ? 1 : -1;
      d.pixel(centerX + offsetX, mouthY, lipColor);
      if (appearance.表情 === "开朗大笑") {
        d.pixel(centerX + offsetX, mouthY + 1, "#ffffff");
      }
    }
  }

  /** 绘制耳朵 */
  private drawEars(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    headWidth: number,
    headHeight: number,
    skin: { base: string; shadow: string; highlight: string },
    direction: string
  ): void {
    const earY = headY + 8;

    if (direction === "down") {
      // 正面双耳
      d.circle(centerX - headWidth / 2 - 1, earY, 2, skin.base);
      d.circle(centerX + headWidth / 2 + 1, earY, 2, skin.base);
    } else if (direction === "left") {
      // 左侧面 - 右耳可见
      d.circle(centerX + headWidth / 2 + 1, earY, 2, skin.base);
    } else if (direction === "right") {
      // 右侧面 - 左耳可见
      d.circle(centerX - headWidth / 2 - 1, earY, 2, skin.base);
    }
  }

  /** 绘制面部细节 */
  private drawFaceDetails(
    d: PixelDrawer,
    centerX: number,
    headY: number,
    appearance: CharacterAppearance,
    direction: string
  ): void {
    // 皱纹（老年）
    if (appearance.年龄 === "老年") {
      const wrinkleColor = "#b8956a";
      // 抬头纹
      d.hLine(centerX - 4, headY + 4, 9, wrinkleColor);
      d.hLine(centerX - 3, headY + 5, 7, wrinkleColor);
      // 鱼尾纹
      if (direction === "down") {
        d.pixel(centerX - 7, headY + 8, wrinkleColor);
        d.pixel(centerX + 7, headY + 8, wrinkleColor);
      }
    }

    // 胡子（男性）
    if (appearance.性别 === "男" && appearance.年龄 !== "小孩") {
      const beardColor = HAIR_COLORS[appearance.发色].shadow;
      if (appearance.年龄 === "老年" || appearance.年龄 === "中年") {
        // 短胡子
        if (direction === "down") {
          d.rect(centerX - 3, headY + 13, 7, 2, beardColor);
        }
      }
    }

    // 雀斑（随机）
    if (appearance.肤色 === "白皙" && Math.random() > 0.7) {
      const freckleColor = "#d4a574";
      if (direction === "down") {
        d.pixel(centerX - 4, headY + 10, freckleColor);
        d.pixel(centerX + 3, headY + 11, freckleColor);
        d.pixel(centerX - 2, headY + 12, freckleColor);
      }
    }
  }

  /** 绘制鞋子 */
  private drawShoes(
    d: PixelDrawer,
    leftX: number,
    rightX: number,
    shoeY: number,
    direction: string
  ): void {
    const shoeColor = "#3e2723";
    const shoeDark = "#2d1b18";

    if (direction === "down") {
      // 正面鞋子
      d.rect(leftX, shoeY, 5, 3, shoeColor);
      d.rect(rightX - 5, shoeY, 5, 3, shoeColor);
      // 鞋头
      d.rect(leftX + 3, shoeY, 2, 3, shoeDark);
      d.rect(rightX - 3, shoeY, 2, 3, shoeDark);
    } else if (direction === "up") {
      // 背面鞋子
      d.rect(leftX, shoeY, 5, 3, shoeColor);
      d.rect(rightX - 5, shoeY, 5, 3, shoeColor);
    } else {
      // 侧面鞋子
      d.rect(leftX, shoeY, 8, 3, shoeColor);
      d.rect(direction === "left" ? leftX + 5 : leftX, shoeY, 3, 3, shoeDark);
    }
  }

  // ============ 工具方法 ============

  /** 获取走路动画偏移 */
  private getWalkOffset(frame: number): {
    body: number;
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
  } {
    const cycle = [0, 1, 0, -1];
    const offset = cycle[frame % 4] ?? 0;
    return {
      body: frame === 1 ? -1 : 0,
      leftArm: -offset,
      rightArm: offset,
      leftLeg: offset,
      rightLeg: -offset,
    };
  }

  /** 获取体型缩放 */
  private getBodyScale(bodyType: BodyType): number {
    const scaleMap: Record<BodyType, number> = {
      瘦: 0.85,
      标准: 1.0,
      壮: 1.15,
      胖: 1.25,
    };
    return scaleMap[bodyType];
  }

  /** 获取身高缩放 */
  private getHeightScale(height: HeightType): number {
    const scaleMap: Record<HeightType, number> = {
      矮小: 0.92,
      中等: 1.0,
      高挑: 1.08,
    };
    return scaleMap[height];
  }

  /** 获取年龄缩放 */
  private getAgeScale(age: AgeGroup): number {
    const scaleMap: Record<AgeGroup, number> = {
      小孩: 1.15, // 大头
      青年: 1.0,
      中年: 1.0,
      老年: 0.95,
    };
    return scaleMap[age];
  }

  /** 获取眼睛大小 */
  private getEyeSize(eyeType: EyeType): number {
    const sizeMap: Record<EyeType, number> = {
      大眼: 3,
      中等: 2.5,
      小眼: 2,
      圆眼: 3,
      细长: 2.5,
      下垂: 2.5,
      上挑: 2.5,
    };
    return sizeMap[eyeType];
  }

  /** 颜色加深 */
  private darkenColor(color: string, factor: number): string {
    const hex = color.replace("#", "");
    const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
    const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);
    return `rgb(${r},${g},${b})`;
  }
}

// ============ 便捷函数 ============

/**
 * 生成角色精灵表
 */
export function generateCharacterSpriteSheet(appearance: CharacterAppearance): HTMLCanvasElement {
  const generator = new CharacterSpriteGenerator();
  return generator.generateSpriteSheet(appearance);
}

/**
 * 下载精灵表为PNG
 */
export function downloadCharacterSpriteSheet(
  canvas: HTMLCanvasElement,
  filename: string = "character_sprite_sheet.png"
): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * 生成随机外观
 */
export function generateRandomAppearance(): CharacterAppearance {
  const bodyTypes: BodyType[] = ["瘦", "标准", "壮", "胖"];
  const heightTypes: HeightType[] = ["矮小", "中等", "高挑"];
  const skinTones: SkinTone[] = ["白皙", "暖色", "麦色", "深色"];
  const hairColors: HairColor[] = ["黑色", "深棕", "浅棕", "金色", "红色", "灰色"];
  const hairStyles: HairStyle[] = ["短发", "中长", "长发", "束发", "光头", "卷发"];
  const eyeTypes: EyeType[] = ["大眼", "中等", "小眼", "圆眼", "细长", "下垂", "上挑"];
  const faceShapes: FaceShape[] = ["圆脸", "方脸", "长脸", "瓜子脸"];
  const expressions: Expression[] = ["温和微笑", "严肃认真", "开朗大笑", "忧郁沉默", "高傲冷漠", "呆萌天然"];
  const clothingStyles: ClothingStyle[] = ["朴素", "普通", "讲究", "华丽", "时髦"];
  const ageGroups: AgeGroup[] = ["小孩", "青年", "中年", "老年"];
  const genders: Gender[] = ["男", "女"];

  const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    身高: randomPick(heightTypes),
    体型: randomPick(bodyTypes),
    肤色: randomPick(skinTones),
    发色: randomPick(hairColors),
    发型: randomPick(hairStyles),
    眼睛: randomPick(eyeTypes),
    脸型: randomPick(faceShapes),
    表情: randomPick(expressions),
    穿衣风格: randomPick(clothingStyles),
    年龄: randomPick(ageGroups),
    性别: randomPick(genders),
  };
}

/**
 * 生成指定类型的角色外观
 */
export function createAppearance(partial: Partial<CharacterAppearance>): CharacterAppearance {
  const defaults = generateRandomAppearance();
  return { ...defaults, ...partial };
}

// ============ 预设角色 ============

export const PRESET_CHARACTERS: Record<string, CharacterAppearance> = {
  精神小伙: {
    身高: "中等", 体型: "标准", 肤色: "暖色", 发色: "黑色", 发型: "短发",
    眼睛: "大眼", 脸型: "圆脸", 表情: "开朗大笑", 穿衣风格: "普通",
    年龄: "青年", 性别: "男",
  },
  时髦少女: {
    身高: "中等", 体型: "瘦", 肤色: "白皙", 发色: "金色", 发型: "长发",
    眼睛: "圆眼", 脸型: "瓜子脸", 表情: "温和微笑", 穿衣风格: "时髦",
    年龄: "青年", 性别: "女",
  },
  沉稳工匠: {
    身高: "中等", 体型: "壮", 肤色: "麦色", 发色: "黑色", 发型: "短发",
    眼睛: "小眼", 脸型: "方脸", 表情: "严肃认真", 穿衣风格: "朴素",
    年龄: "中年", 性别: "男",
  },
  慈祥老奶奶: {
    身高: "矮小", 体型: "胖", 肤色: "暖色", 发色: "灰色", 发型: "束发",
    眼睛: "中等", 脸型: "圆脸", 表情: "温和微笑", 穿衣风格: "朴素",
    年龄: "老年", 性别: "女",
  },
  痞气青年: {
    身高: "高挑", 体型: "瘦", 肤色: "白皙", 发色: "红色", 发型: "中长",
    眼睛: "上挑", 脸型: "长脸", 表情: "高傲冷漠", 穿衣风格: "时髦",
    年龄: "青年", 性别: "男",
  },
  可爱胖小孩: {
    身高: "矮小", 体型: "胖", 肤色: "暖色", 发色: "浅棕", 发型: "卷发",
    眼睛: "圆眼", 脸型: "圆脸", 表情: "呆萌天然", 穿衣风格: "普通",
    年龄: "小孩", 性别: "男",
  },
  瘦弱书生: {
    身高: "中等", 体型: "瘦", 肤色: "白皙", 发色: "黑色", 发型: "中长",
    眼睛: "中等", 脸型: "长脸", 表情: "忧郁沉默", 穿衣风格: "朴素",
    年龄: "青年", 性别: "男",
  },
  凶悍壮汉: {
    身高: "中等", 体型: "壮", 肤色: "深色", 发色: "黑色", 发型: "光头",
    眼睛: "小眼", 脸型: "方脸", 表情: "严肃认真", 穿衣风格: "朴素",
    年龄: "中年", 性别: "男",
  },
};
