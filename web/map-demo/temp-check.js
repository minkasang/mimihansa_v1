
    // ============ 色彩系统 ============
    const SKIN_COLORS = {
      白皙: { base: "#FFEFE0", shadow: "#F5D0B0", highlight: "#FFF5F0" },
      暖色: { base: "#F5D0B0", shadow: "#E8C4A0", highlight: "#FFE8D0" },
      麦色: { base: "#E8C4A0", shadow: "#D4A574", highlight: "#F5D0B0" },
      深色: { base: "#C49464", shadow: "#A67B5B", highlight: "#E8C4A0" },
    };

    const HAIR_COLORS = {
      黑色: { base: "#1A1A1A", shadow: "#0D0D0D", highlight: "#2D2D2D" },
      深棕: { base: "#4A2408", shadow: "#2D1505", highlight: "#6B3410" },
      浅棕: { base: "#8B4513", shadow: "#6B3410", highlight: "#A0522D" },
      金色: { base: "#D4A574", shadow: "#B8956A", highlight: "#E8C4A0" },
      红色: { base: "#A0522D", shadow: "#7A3E22", highlight: "#C49464" },
      灰色: { base: "#808080", shadow: "#666666", highlight: "#999999" },
    };

    const CLOTHING_PALETTES = {
      朴素: { primary: "#8B7355", secondary: "#6B5344", accent: "#A0826D", shadow: "#5a4a3a", highlight: "#b8a090" },
      普通: { primary: "#5B8A72", secondary: "#4A7260", accent: "#6B9B82", shadow: "#3a5a50", highlight: "#7aac90" },
      讲究: { primary: "#4A6FA5", secondary: "#3A5F95", accent: "#5A7FB5", shadow: "#2a4f85", highlight: "#6a8fc5" },
      华丽: { primary: "#8B4513", secondary: "#6B3410", accent: "#D4A574", shadow: "#5a2a0a", highlight: "#e8c4a0" },
      时髦: { primary: "#C44569", secondary: "#A03555", accent: "#E05579", shadow: "#8a2549", highlight: "#f06589" },
    };

    // ============ 像素绘制工具 ============
    class PixelDrawer {
      constructor(ctx) { this.ctx = ctx; }
      rect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      }
      circle(x, y, r, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(Math.round(x) + 0.5, Math.round(y) + 0.5, r, 0, Math.PI * 2);
        this.ctx.fill();
      }
      ellipse(x, y, rx, ry, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(Math.round(x) + 0.5, Math.round(y) + 0.5, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
      pixel(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      hLine(x, y, w, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
      }
    }

    // ============ 角色精灵图生成器 ============
    class CharacterSpriteGenerator {
      generateSpriteSheet(appearance) {
        const canvas = document.createElement("canvas");
        canvas.width = 32 * 8;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const directions = ["down", "up", "left", "right"];
        for (let dirIndex = 0; dirIndex < directions.length; dirIndex++) {
          for (let frame = 0; frame < 2; frame++) {
            const x = (dirIndex * 2 + frame) * 32;
            this.drawFrame(ctx, x, 0, appearance, directions[dirIndex], frame);
          }
        }
        return canvas;
      }

      drawFrame(ctx, x, y, appearance, direction, frame) {
        ctx.save();
        ctx.translate(x, y);
        const d = new PixelDrawer(ctx);
        const skin = SKIN_COLORS[appearance.肤色];
        const hair = HAIR_COLORS[appearance.发色];
        const clothes = CLOTHING_PALETTES[appearance.穿衣风格];
        const walkOffset = this.getWalkOffset(frame);
        const bodyScale = this.getBodyScale(appearance.体型);
        const heightScale = this.getHeightScale(appearance.身高);
        const ageScale = this.getAgeScale(appearance.年龄);

        this.drawShadow(d);
        this.drawLegs(d, appearance, direction, walkOffset, bodyScale, heightScale);
        this.drawBody(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes);
        this.drawArms(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes, skin);
        this.drawHead(d, appearance, direction, bodyScale, heightScale, ageScale, skin, hair);
        ctx.restore();
      }

      drawShadow(d) {
        d.ellipse(16, 46, 10, 3, "rgba(0,0,0,0.2)");
      }

      drawLegs(d, appearance, direction, walkOffset, bodyScale, heightScale) {
        const legY = 32;
        const legWidth = Math.max(3, Math.round(4 * bodyScale));
        const legHeight = Math.round(14 * heightScale);
        const pantsColor = CLOTHING_PALETTES[appearance.穿衣风格].secondary;
        const pantsShadow = this.darkenColor(pantsColor, 0.8);
        const pantsHighlight = this.lightenColor(pantsColor, 1.15);

        if (direction === "down") {
          const leftLegX = 16 - legWidth - 1 + walkOffset.leftLeg;
          const rightLegX = 16 + 1 + walkOffset.rightLeg;
          d.rect(leftLegX, legY, legWidth, legHeight, pantsColor);
          d.rect(leftLegX + legWidth - 1, legY, 1, legHeight, pantsShadow);
          d.rect(leftLegX, legY, 1, legHeight - 2, pantsHighlight);
          d.pixel(leftLegX + 1, legY + legHeight - 3, pantsShadow);
          d.pixel(leftLegX + legWidth - 2, legY + legHeight - 2, pantsShadow);
          d.rect(rightLegX, legY, legWidth, legHeight, pantsColor);
          d.rect(rightLegX + legWidth - 1, legY, 1, legHeight, pantsShadow);
          d.rect(rightLegX, legY, 1, legHeight - 2, pantsHighlight);
          d.pixel(rightLegX + 1, legY + legHeight - 3, pantsShadow);
          d.pixel(rightLegX + legWidth - 2, legY + legHeight - 2, pantsShadow);
          this.drawShoes(d, leftLegX - 1, rightLegX + legWidth, legY + legHeight - 2, direction);
        } else if (direction === "up") {
          d.rect(16 - legWidth - 1, legY, legWidth, legHeight, pantsColor);
          d.rect(16 + 1, legY, legWidth, legHeight, pantsColor);
          d.pixel(16 - legWidth, legY + 3, pantsShadow);
          d.pixel(16 + legWidth - 1, legY + 3, pantsShadow);
          this.drawShoes(d, 16 - legWidth - 2, 16 + legWidth + 1, legY + legHeight - 2, direction);
        } else {
          const isLeft = direction === "left";
          const offsetX = isLeft ? -2 : 2;
          const legOffset = isLeft ? walkOffset.leftLeg : walkOffset.rightLeg;
          const legX = 16 + offsetX - Math.floor(legWidth / 2);
          d.rect(legX, legY + Math.abs(legOffset), legWidth, legHeight, pantsColor);
          d.rect(legX + (isLeft ? 1 : -Math.floor(legWidth / 2)), legY, 1, legHeight, pantsShadow);
          d.rect(legX + (isLeft ? legWidth - 1 : 0), legY, 1, legHeight - 2, pantsHighlight);
          d.pixel(legX + 1, legY + legHeight - 3 + Math.abs(legOffset), pantsShadow);
          this.drawShoes(d, 16 + offsetX - 3, 16 + offsetX + 3, legY + legHeight - 2, direction);
        }
      }

      drawBody(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes) {
        const bodyY = 20 + walkOffset.body;
        const bodyWidth = Math.round(14 * bodyScale);
        const bodyHeight = Math.round(14 * heightScale);
        const centerX = 16;

        if (direction === "down") {
          d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
          d.rect(centerX - bodyWidth / 2, bodyY + bodyHeight - 4, bodyWidth, 4, clothes.secondary);
          d.pixel(centerX - 2, bodyY + bodyHeight - 3, clothes.shadow);
          d.pixel(centerX + 1, bodyY + bodyHeight - 2, clothes.shadow);
          d.rect(centerX + bodyWidth / 2 - 2, bodyY, 2, bodyHeight, clothes.secondary);
          d.rect(centerX + bodyWidth / 2 - 1, bodyY + 2, 1, bodyHeight - 4, clothes.shadow);
          d.rect(centerX - bodyWidth / 2 + 1, bodyY, 3, bodyHeight - 4, clothes.accent);
          d.rect(centerX - bodyWidth / 2 + 2, bodyY + 1, 1, bodyHeight - 6, clothes.highlight);
          d.rect(centerX - 2, bodyY, 4, 2, SKIN_COLORS[appearance.肤色].base);
          d.pixel(centerX - 1, bodyY + 1, SKIN_COLORS[appearance.肤色].shadow);
          d.pixel(centerX + 1, bodyY + 1, SKIN_COLORS[appearance.肤色].shadow);
          d.pixel(centerX - 1, bodyY + 5, clothes.shadow);
          d.pixel(centerX + 2, bodyY + 7, clothes.shadow);
          d.pixel(centerX - 3, bodyY + 9, clothes.shadow);
          if (appearance.穿衣风格 === "华丽" || appearance.穿衣风格 === "讲究") {
            d.hLine(centerX - bodyWidth / 2 + 1, bodyY + bodyHeight - 6, bodyWidth - 2, clothes.accent);
            d.pixel(centerX, bodyY + bodyHeight - 6, clothes.highlight);
          }
          if (appearance.穿衣风格 === "讲究" || appearance.性别 === "男") {
            d.pixel(centerX, bodyY + 4, clothes.shadow);
            d.pixel(centerX, bodyY + 7, clothes.shadow);
            d.pixel(centerX, bodyY + 10, clothes.shadow);
          }
        } else if (direction === "up") {
          d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
          d.rect(centerX - bodyWidth / 2, bodyY, bodyWidth, 3, clothes.secondary);
          d.pixel(centerX, bodyY + 4, clothes.shadow);
          d.pixel(centerX - 1, bodyY + 6, clothes.shadow);
        } else {
          const isLeft = direction === "left";
          const offsetX = isLeft ? 1 : -1;
          d.rect(centerX + offsetX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, clothes.primary);
          d.rect(centerX + offsetX - bodyWidth / 2, bodyY + bodyHeight - 4, bodyWidth, 4, clothes.secondary);
          if (isLeft) {
            d.rect(centerX + offsetX + bodyWidth / 2 - 2, bodyY, 2, bodyHeight, clothes.secondary);
            d.rect(centerX + offsetX + bodyWidth / 2 - 1, bodyY + 2, 1, bodyHeight - 4, clothes.shadow);
          } else {
            d.rect(centerX + offsetX - bodyWidth / 2, bodyY, 2, bodyHeight, clothes.secondary);
            d.rect(centerX + offsetX - bodyWidth / 2 + 1, bodyY + 2, 1, bodyHeight - 4, clothes.shadow);
          }
          d.pixel(centerX + offsetX, bodyY + 5, clothes.shadow);
          d.pixel(centerX + offsetX + (isLeft ? -1 : 1), bodyY + 8, clothes.shadow);
        }
      }

      drawArms(d, appearance, direction, walkOffset, bodyScale, heightScale, clothes, skin) {
        const armY = 22;
        const armWidth = 3;
        const armHeight = Math.round(10 * heightScale);
        const centerX = 16;
        const armShadow = clothes.shadow;

        if (direction === "down") {
          const leftArmX = centerX - Math.round(7 * bodyScale) - armWidth + walkOffset.leftArm;
          const rightArmX = centerX + Math.round(7 * bodyScale) + walkOffset.rightArm;
          d.rect(leftArmX, armY, armWidth, armHeight, clothes.primary);
          d.rect(leftArmX + armWidth - 1, armY, 1, armHeight, armShadow);
          d.rect(leftArmX, armY + armHeight, armWidth, 2, skin.base);
          d.rect(leftArmX, armY + armHeight, 1, 2, skin.shadow);
          d.hLine(leftArmX, armY + armHeight - 1, armWidth, clothes.secondary);
          d.rect(rightArmX, armY, armWidth, armHeight, clothes.primary);
          d.rect(rightArmX + armWidth - 1, armY, 1, armHeight, armShadow);
          d.rect(rightArmX, armY + armHeight, armWidth, 2, skin.base);
          d.rect(rightArmX + armWidth - 1, armY + armHeight, 1, 2, skin.shadow);
          d.hLine(rightArmX, armY + armHeight - 1, armWidth, clothes.secondary);
        } else if (direction === "up") {
          d.rect(centerX - Math.round(7 * bodyScale) - armWidth, armY, armWidth, armHeight, clothes.primary);
          d.rect(centerX + Math.round(7 * bodyScale), armY, armWidth, armHeight, clothes.primary);
        } else {
          const isLeft = direction === "left";
          const armX = isLeft
            ? centerX + Math.round(5 * bodyScale) + walkOffset.rightArm
            : centerX - Math.round(5 * bodyScale) - armWidth + walkOffset.leftArm;
          d.rect(armX, armY, armWidth, armHeight, clothes.primary);
          d.rect(armX + (isLeft ? armWidth - 1 : 0), armY, 1, armHeight, armShadow);
          d.rect(armX, armY + armHeight, armWidth, 2, skin.base);
          d.rect(armX + (isLeft ? armWidth - 1 : 0), armY + armHeight, 1, 2, skin.shadow);
          d.hLine(armX, armY + armHeight - 1, armWidth, clothes.secondary);
        }
      }

      drawHead(d, appearance, direction, bodyScale, heightScale, ageScale, skin, hair) {
        const centerX = 16;
        const headY = 4;
        const headWidth = Math.round(18 * ageScale);
        const headHeight = Math.round(16 * ageScale);

        this.drawFaceShape(d, centerX, headY, headWidth, headHeight, appearance.脸型, skin);
        this.drawHair(d, centerX, headY, headWidth, headHeight, appearance, direction, hair);

        if (direction !== "up") {
          this.drawEyes(d, centerX, headY, appearance, direction, ageScale);
          this.drawEyebrows(d, centerX, headY, appearance, direction);
          this.drawNose(d, centerX, headY, appearance, direction);
          this.drawMouth(d, centerX, headY, appearance, direction);
        }

        this.drawEars(d, centerX, headY, headWidth, headHeight, skin, direction);
        this.drawFaceDetails(d, centerX, headY, appearance, direction);
      }

      drawFaceShape(d, centerX, headY, headWidth, headHeight, faceShape, skin) {
        d.ellipse(centerX, headY + headHeight / 2, headWidth / 2, headHeight / 2, skin.base);
        switch (faceShape) {
          case "方脸":
            d.rect(centerX - headWidth / 2 + 2, headY + headHeight - 4, headWidth - 4, 4, skin.base);
            break;
          case "瓜子脸":
            d.rect(centerX - 2, headY + headHeight - 2, 4, 2, skin.base);
            break;
        }
        d.ellipse(centerX + 1, headY + headHeight / 2 + 1, headWidth / 2 - 2, headHeight / 2 - 2, skin.shadow);
      }

      drawHair(d, centerX, headY, headWidth, headHeight, appearance, direction, hair) {
        if (appearance.发型 === "光头") return;
        const hairY = headY - 2;
        if (direction === "down") {
          this.drawHairFront(d, centerX, hairY, headWidth, headHeight, appearance, hair);
        } else if (direction === "up") {
          this.drawHairBack(d, centerX, hairY, headWidth, headHeight, appearance, hair);
        } else {
          this.drawHairSide(d, centerX, hairY, headWidth, headHeight, appearance, direction, hair);
        }
      }

      drawHairFront(d, centerX, hairY, headWidth, headHeight, appearance, hair) {
        const hw = headWidth / 2;
        d.ellipse(centerX, hairY + 4, hw + 2, 6, hair.shadow);
        d.ellipse(centerX, hairY + 3, hw + 1, 5, hair.base);

        switch (appearance.发型) {
          case "短发":
            d.ellipse(centerX, hairY + 1, hw, 3, hair.base);
            d.ellipse(centerX - 2, hairY + 2, hw - 1, 3, hair.highlight);
            d.pixel(centerX - 3, hairY + 5, hair.highlight);
            d.pixel(centerX - 1, hairY + 6, hair.base);
            d.pixel(centerX + 2, hairY + 5, hair.highlight);
            d.pixel(centerX + 4, hairY + 4, hair.base);
            d.rect(centerX - hw - 1, hairY + 4, 2, 5, hair.shadow);
            d.rect(centerX + hw - 1, hairY + 4, 2, 5, hair.shadow);
            break;
          case "中长":
            d.ellipse(centerX, hairY, hw + 1, 4, hair.base);
            d.ellipse(centerX - 2, hairY + 1, hw - 1, 3, hair.highlight);
            d.rect(centerX - hw - 2, hairY + 4, 3, 10, hair.base);
            d.rect(centerX + hw, hairY + 4, 3, 10, hair.base);
            d.rect(centerX - hw - 1, hairY + 12, 2, 3, hair.shadow);
            d.rect(centerX + hw, hairY + 12, 2, 3, hair.shadow);
            d.pixel(centerX - 3, hairY + 5, hair.highlight);
            d.pixel(centerX, hairY + 6, hair.base);
            d.pixel(centerX + 3, hairY + 5, hair.highlight);
            d.hLine(centerX - hw + 1, hairY + 7, hw - 2, hair.highlight);
            d.hLine(centerX + 2, hairY + 7, hw - 3, hair.highlight);
            break;
          case "长发":
            d.ellipse(centerX, hairY, hw + 1, 4, hair.base);
            d.ellipse(centerX - 2, hairY + 1, hw - 1, 3, hair.highlight);
            d.rect(centerX - hw - 3, hairY + 4, 4, 16, hair.base);
            d.rect(centerX + hw - 1, hairY + 4, 4, 16, hair.base);
            d.rect(centerX - hw - 1, hairY + 6, 2, 12, hair.shadow);
            d.rect(centerX + hw - 2, hairY + 6, 2, 12, hair.shadow);
            d.rect(centerX - hw - 2, hairY + 18, 3, 3, hair.shadow);
            d.rect(centerX + hw - 1, hairY + 18, 3, 3, hair.shadow);
            d.pixel(centerX - 4, hairY + 5, hair.highlight);
            d.pixel(centerX - 1, hairY + 6, hair.base);
            d.pixel(centerX + 2, hairY + 6, hair.base);
            d.pixel(centerX + 4, hairY + 5, hair.highlight);
            d.hLine(centerX - hw + 2, hairY + 8, 3, hair.highlight);
            d.hLine(centerX + hw - 4, hairY + 10, 3, hair.highlight);
            d.hLine(centerX - hw + 1, hairY + 14, 4, hair.highlight);
            break;
          case "束发":
            d.ellipse(centerX, hairY + 1, hw, 4, hair.base);
            d.ellipse(centerX - 1, hairY + 2, hw - 1, 3, hair.highlight);
            d.rect(centerX - hw, hairY + 4, headWidth, 3, hair.base);
            d.pixel(centerX - 2, hairY + 5, hair.highlight);
            d.pixel(centerX + 2, hairY + 5, hair.highlight);
            d.circle(centerX, hairY - 3, 5, hair.shadow);
            d.circle(centerX, hairY - 3, 4, hair.base);
            d.circle(centerX - 1, hairY - 4, 2, hair.highlight);
            d.pixel(centerX, hairY - 6, hair.highlight);
            d.pixel(centerX - 2, hairY - 5, hair.shadow);
            break;
          case "卷发":
            d.ellipse(centerX, hairY + 2, hw + 2, 5, hair.base);
            d.ellipse(centerX - 2, hairY + 1, hw, 4, hair.highlight);
            d.ellipse(centerX - 5, hairY + 6, 3, 4, hair.base);
            d.ellipse(centerX + 5, hairY + 6, 3, 4, hair.base);
            d.ellipse(centerX - 3, hairY + 9, 2, 3, hair.shadow);
            d.ellipse(centerX + 3, hairY + 9, 2, 3, hair.shadow);
            d.ellipse(centerX - 6, hairY + 4, 2, 3, hair.highlight);
            d.ellipse(centerX + 6, hairY + 4, 2, 3, hair.highlight);
            d.ellipse(centerX - 2, hairY + 5, 2, 3, hair.base);
            d.ellipse(centerX + 2, hairY + 5, 2, 3, hair.base);
            d.ellipse(centerX, hairY + 6, 2, 2, hair.highlight);
            break;
        }
        d.ellipse(centerX - 2, hairY + 1, 3, 2, hair.highlight);
        d.pixel(centerX + 1, hairY + 2, hair.highlight);
      }

      drawHairBack(d, centerX, hairY, headWidth, headHeight, appearance, hair) {
        const hw = headWidth / 2;
        d.ellipse(centerX, hairY + 4, hw + 2, 6, hair.shadow);
        d.ellipse(centerX, hairY + 3, hw + 1, 5, hair.base);
        switch (appearance.发型) {
          case "短发":
            d.ellipse(centerX, hairY + 1, hw, 3, hair.base);
            d.rect(centerX - hw, hairY + 4, headWidth, 5, hair.base);
            d.rect(centerX - hw + 1, hairY + 6, headWidth - 2, 2, hair.highlight);
            d.pixel(centerX - 2, hairY + 9, hair.shadow);
            d.pixel(centerX + 2, hairY + 9, hair.shadow);
            break;
          case "中长":
          case "长发":
            d.ellipse(centerX, hairY + 1, hw + 1, 4, hair.base);
            d.rect(centerX - hw - 1, hairY + 4, headWidth + 2, 6, hair.base);
            d.rect(centerX - hw - 2, hairY + 8, headWidth + 4, 14, hair.base);
            d.rect(centerX - hw, hairY + 10, headWidth, 10, hair.shadow);
            d.rect(centerX - hw - 1, hairY + 20, headWidth + 2, 4, hair.shadow);
            d.rect(centerX - hw + 1, hairY + 22, headWidth - 2, 2, hair.highlight);
            d.hLine(centerX - 2, hairY + 12, 5, hair.highlight);
            d.hLine(centerX - 3, hairY + 16, 7, hair.highlight);
            break;
          case "束发":
            d.ellipse(centerX, hairY + 1, hw, 4, hair.base);
            d.rect(centerX - hw, hairY + 4, headWidth, 5, hair.base);
            d.circle(centerX, hairY - 3, 5, hair.shadow);
            d.circle(centerX, hairY - 3, 4, hair.base);
            d.circle(centerX - 1, hairY - 4, 2, hair.highlight);
            d.rect(centerX - 1, hairY - 8, 3, 5, hair.base);
            d.rect(centerX, hairY - 9, 2, 3, hair.highlight);
            break;
          case "卷发":
            d.ellipse(centerX, hairY + 2, hw + 2, 5, hair.base);
            d.ellipse(centerX - 3, hairY + 6, 3, 4, hair.base);
            d.ellipse(centerX + 3, hairY + 6, 3, 4, hair.base);
            d.ellipse(centerX, hairY + 8, 4, 5, hair.shadow);
            d.ellipse(centerX - 2, hairY + 5, 2, 3, hair.highlight);
            d.ellipse(centerX + 2, hairY + 5, 2, 3, hair.highlight);
            break;
        }
      }

      drawHairSide(d, centerX, hairY, headWidth, headHeight, appearance, direction, hair) {
        const isLeft = direction === "left";
        const offsetX = isLeft ? 2 : -2;
        const hw = headWidth / 2;
        d.ellipse(centerX + offsetX, hairY + 4, hw + 1, 6, hair.shadow);
        d.ellipse(centerX + offsetX, hairY + 3, hw, 5, hair.base);
        switch (appearance.发型) {
          case "短发":
            d.ellipse(centerX + offsetX, hairY + 1, hw, 3, hair.base);
            d.rect(centerX + offsetX - hw, hairY + 4, headWidth, 5, hair.base);
            d.hLine(centerX + offsetX - hw + 2, hairY + 5, hw - 2, hair.highlight);
            d.pixel(centerX + (isLeft ? hw + 2 : -hw - 2), hairY + 6, hair.shadow);
            d.pixel(centerX + (isLeft ? hw + 1 : -hw - 1), hairY + 8, hair.base);
            break;
          case "中长":
            d.ellipse(centerX + offsetX, hairY + 1, hw + 1, 4, hair.base);
            d.rect(centerX + offsetX - hw, hairY + 4, headWidth, 6, hair.base);
            d.rect(centerX + (isLeft ? -hw - 2 : hw), hairY + 6, 4, 10, hair.base);
            d.rect(centerX + (isLeft ? -hw - 1 : hw + 1), hairY + 8, 2, 6, hair.shadow);
            d.rect(centerX + (isLeft ? -hw - 1 : hw), hairY + 14, 3, 3, hair.shadow);
            d.hLine(centerX + (isLeft ? -hw : hw - 3), hairY + 8, 3, hair.highlight);
            break;
          case "长发":
            d.ellipse(centerX + offsetX, hairY + 1, hw + 1, 4, hair.base);
            d.rect(centerX + offsetX - hw, hairY + 4, headWidth, 6, hair.base);
            d.rect(centerX + (isLeft ? -hw - 3 : hw), hairY + 6, 4, 16, hair.base);
            d.rect(centerX + (isLeft ? -hw - 1 : hw + 2), hairY + 8, 2, 12, hair.shadow);
            d.rect(centerX + (isLeft ? -hw - 2 : hw + 1), hairY + 20, 3, 4, hair.shadow);
            d.rect(centerX + (isLeft ? -hw - 1 : hw + 1), hairY + 22, 2, 2, hair.highlight);
            d.hLine(centerX + (isLeft ? -hw : hw - 3), hairY + 10, 3, hair.highlight);
            d.hLine(centerX + (isLeft ? -hw + 1 : hw - 2), hairY + 16, 3, hair.highlight);
            break;
          case "束发":
            d.ellipse(centerX + offsetX, hairY + 1, hw, 4, hair.base);
            d.rect(centerX + offsetX - hw, hairY + 4, headWidth, 5, hair.base);
            d.circle(centerX + offsetX, hairY - 3, 5, hair.shadow);
            d.circle(centerX + offsetX, hairY - 3, 4, hair.base);
            d.circle(centerX + offsetX - 1, hairY - 4, 2, hair.highlight);
            break;
          case "卷发":
            d.ellipse(centerX + offsetX, hairY + 2, hw + 2, 5, hair.base);
            d.ellipse(centerX + (isLeft ? -3 : 3), hairY + 6, 3, 4, hair.base);
            d.ellipse(centerX + (isLeft ? -2 : 2), hairY + 5, 2, 3, hair.highlight);
            d.ellipse(centerX + offsetX, hairY + 8, 3, 4, hair.shadow);
            break;
        }
      }

      drawEyes(d, centerX, headY, appearance, direction, ageScale) {
        const eyeY = headY + 8;
        const eyeColor = "#2d5016";
        const pupilColor = "#1a1a1a";
        if (direction === "down") {
          const eyeSize = this.getEyeSize(appearance.眼睛);
          const eyeSpacing = 6;
          this.drawSingleEye(d, centerX - eyeSpacing, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
          this.drawSingleEye(d, centerX + eyeSpacing, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
        } else {
          const eyeSize = this.getEyeSize(appearance.眼睛) * 0.8;
          const eyeX = direction === "left" ? centerX + 3 : centerX - 3;
          this.drawSingleEye(d, eyeX, eyeY, eyeSize, eyeColor, pupilColor, appearance.眼睛);
        }
      }

      drawSingleEye(d, x, y, size, eyeColor, pupilColor, eyeType) {
        const eyeWhite = "#ffffff";
        d.ellipse(x, y + 0.5, size, size * 1.2, eyeWhite);
        d.ellipse(x + 0.5, y + 1, size * 0.9, size * 1.1, "#f5f5f5");
        d.hLine(x - size + 1, y - size * 0.8, size * 2 - 2, "rgba(0,0,0,0.1)");
        d.ellipse(x, y, size * 0.75, size * 0.95, eyeColor);
        d.ellipse(x, y, size * 0.6, size * 0.8, this.lightenColor(eyeColor, 1.2));
        d.circle(x, y, size * 0.4, pupilColor);
        d.circle(x, y, size * 0.25, "#2a2a2a");
        d.circle(x + size * 0.25, y - size * 0.25, size * 0.3, "#ffffff");
        d.circle(x - size * 0.15, y + size * 0.2, size * 0.15, "rgba(255,255,255,0.7)");
        d.hLine(x - size + 1, y - size * 0.7, size * 2 - 2, "rgba(0,0,0,0.3)");
        d.hLine(x - size + 2, y + size * 0.8, size * 2 - 4, "rgba(0,0,0,0.1)");
        switch (eyeType) {
          case "小眼":
            d.rect(x - size - 1, y - size * 0.8, size * 2 + 2, size * 0.7, "#F5D0B0");
            d.hLine(x - size + 1, y - size * 0.8, size * 2 - 2, "rgba(0,0,0,0.2)");
            break;
          case "下垂眼":
            d.rect(x - size, y + size * 0.5, size * 2, size * 0.5, "#F5D0B0");
            d.hLine(x - size, y + size * 0.5, size * 2, "rgba(0,0,0,0.15)");
            break;
          case "上挑眼":
            d.rect(x - size, y - size * 0.8, size * 2, size * 0.3, "#F5D0B0");
            d.hLine(x - size, y - size * 0.8, size * 2, "rgba(0,0,0,0.2)");
            break;
          case "圆眼":
            d.circle(x + size * 0.3, y - size * 0.3, size * 0.35, "#ffffff");
            break;
          case "大眼":
            d.pixel(x - size * 0.3, y - size * 0.4, "#ffffff");
            break;
        }
      }

      drawEyebrows(d, centerX, headY, appearance, direction) {
        const browY = headY + 5;
        const hair = HAIR_COLORS[appearance.发色];
        if (direction === "down") {
          const browSpacing = 6;
          const browWidth = 4;
          const browHeight = 1;
          this.drawEyebrowShape(d, centerX - browSpacing, browY, browWidth, browHeight, appearance.表情, hair.base, true);
          this.drawEyebrowShape(d, centerX + browSpacing, browY, browWidth, browHeight, appearance.表情, hair.base, false);
        } else {
          const browX = direction === "left" ? centerX + 3 : centerX - 3;
          this.drawEyebrowShape(d, browX, browY, 3, 1, appearance.表情, hair.base, direction === "left");
        }
      }

      drawEyebrowShape(d, x, y, width, height, expression, color, isLeft) {
        switch (expression) {
          case "严肃认真":
            d.rect(x - width / 2, y, width, height, color);
            break;
          case "温和微笑":
            d.rect(x - width / 2, y, width, height, color);
            d.pixel(x + (isLeft ? -width / 2 : width / 2), y - 1, color);
            break;
          case "开朗大笑":
            d.rect(x - width / 2, y - 1, width, height, color);
            d.pixel(x + (isLeft ? -width / 2 : width / 2), y - 2, color);
            break;
          case "忧郁沉默":
            d.rect(x - width / 2, y + 1, width, height, color);
            d.pixel(x + (isLeft ? width / 2 : -width / 2), y, color);
            break;
          case "高傲冷漠":
            d.rect(x - width / 2, y - 1, width, height, color);
            d.pixel(x + (isLeft ? width / 2 : -width / 2), y - 2, color);
            break;
          case "呆萌天然":
            d.rect(x - width / 2 + 1, y, width - 2, height, color);
            break;
        }
      }

      drawNose(d, centerX, headY, appearance, direction) {
        const noseY = headY + 11;
        const skin = SKIN_COLORS[appearance.肤色];
        if (direction === "down") {
          d.pixel(centerX, noseY, skin.shadow);
          d.pixel(centerX - 1, noseY + 1, skin.base);
          d.pixel(centerX + 1, noseY + 1, skin.base);
        } else {
          const offsetX = direction === "left" ? 2 : -2;
          d.pixel(centerX + offsetX, noseY, skin.shadow);
          d.pixel(centerX + offsetX, noseY + 1, skin.base);
        }
      }

      drawMouth(d, centerX, headY, appearance, direction) {
        const mouthY = headY + 14;
        const lipColor = "#d4a574";
        if (direction === "down") {
          switch (appearance.表情) {
            case "温和微笑":
              d.pixel(centerX - 2, mouthY, lipColor);
              d.pixel(centerX - 1, mouthY + 1, lipColor);
              d.pixel(centerX, mouthY + 1, lipColor);
              d.pixel(centerX + 1, mouthY + 1, lipColor);
              d.pixel(centerX + 2, mouthY, lipColor);
              break;
            case "严肃认真":
              d.hLine(centerX - 2, mouthY, 5, lipColor);
              break;
            case "开朗大笑":
              d.rect(centerX - 2, mouthY, 5, 3, "#ffffff");
              d.hLine(centerX - 2, mouthY, 5, lipColor);
              d.hLine(centerX - 2, mouthY + 3, 5, lipColor);
              break;
            case "忧郁沉默":
              d.pixel(centerX - 2, mouthY, lipColor);
              d.pixel(centerX - 1, mouthY + 1, lipColor);
              d.pixel(centerX, mouthY + 1, lipColor);
              d.pixel(centerX + 1, mouthY + 1, lipColor);
              d.pixel(centerX + 2, mouthY, lipColor);
              break;
            case "高傲冷漠":
              d.hLine(centerX - 2, mouthY, 3, lipColor);
              d.pixel(centerX + 1, mouthY - 1, lipColor);
              break;
            case "呆萌天然":
              d.hLine(centerX - 1, mouthY, 3, lipColor);
              d.pixel(centerX, mouthY + 1, "#ffffff");
              break;
          }
        } else {
          const offsetX = direction === "left" ? 1 : -1;
          d.pixel(centerX + offsetX, mouthY, lipColor);
          if (appearance.表情 === "开朗大笑") {
            d.pixel(centerX + offsetX, mouthY + 1, "#ffffff");
          }
        }
      }

      drawEars(d, centerX, headY, headWidth, headHeight, skin, direction) {
        const earY = headY + 8;
        if (direction === "down") {
          d.circle(centerX - headWidth / 2 - 1, earY, 2, skin.base);
          d.circle(centerX + headWidth / 2 + 1, earY, 2, skin.base);
        } else if (direction === "left") {
          d.circle(centerX + headWidth / 2 + 1, earY, 2, skin.base);
        } else if (direction === "right") {
          d.circle(centerX - headWidth / 2 - 1, earY, 2, skin.base);
        }
      }

      drawFaceDetails(d, centerX, headY, appearance, direction) {
        const skin = SKIN_COLORS[appearance.肤色];
        if (direction === "down") {
          const blushColor = appearance.肤色 === "白皙" ? "rgba(255,180,180,0.25)" :
                            appearance.肤色 === "暖色" ? "rgba(255,160,140,0.2)" :
                            appearance.肤色 === "麦色" ? "rgba(220,140,120,0.15)" :
                            "rgba(200,120,100,0.15)";
          d.ellipse(centerX - 5, headY + 10, 2, 1.5, blushColor);
          d.ellipse(centerX + 5, headY + 10, 2, 1.5, blushColor);
          d.pixel(centerX - 1, headY + 3, skin.highlight);
          d.pixel(centerX + 1, headY + 3, skin.highlight);
          d.pixel(centerX, headY + headHeight - 1, skin.shadow);
        }
        if (appearance.年龄 === "老年") {
          const wrinkleColor = "#b8956a";
          d.hLine(centerX - 4, headY + 3, 9, wrinkleColor);
          d.hLine(centerX - 3, headY + 4, 7, wrinkleColor);
          if (direction === "down") {
            d.pixel(centerX - 7, headY + 8, wrinkleColor);
            d.pixel(centerX + 7, headY + 8, wrinkleColor);
            d.pixel(centerX - 6, headY + 9, wrinkleColor);
            d.pixel(centerX + 6, headY + 9, wrinkleColor);
            d.pixel(centerX - 4, headY + 11, wrinkleColor);
            d.pixel(centerX + 4, headY + 11, wrinkleColor);
            d.pixel(centerX - 3, headY + 12, wrinkleColor);
            d.pixel(centerX + 3, headY + 12, wrinkleColor);
          }
        }
        if (appearance.性别 === "男" && appearance.年龄 !== "小孩") {
          const beardColor = HAIR_COLORS[appearance.发色].shadow;
          if (appearance.年龄 === "老年" || appearance.年龄 === "中年") {
            if (direction === "down") {
              d.rect(centerX - 3, headY + 13, 7, 2, beardColor);
              d.pixel(centerX - 6, headY + 10, beardColor);
              d.pixel(centerX + 6, headY + 10, beardColor);
              d.pixel(centerX - 5, headY + 11, beardColor);
              d.pixel(centerX + 5, headY + 11, beardColor);
            }
          }
          if (appearance.年龄 === "青年" && direction === "down") {
            d.hLine(centerX - 2, headY + 13, 5, "rgba(0,0,0,0.1)");
          }
        }
        if (appearance.肤色 === "白皙" && Math.random() > 0.6) {
          const freckleColor = "#d4a574";
          if (direction === "down") {
            d.pixel(centerX - 4, headY + 10, freckleColor);
            d.pixel(centerX + 3, headY + 11, freckleColor);
            d.pixel(centerX - 2, headY + 12, freckleColor);
            d.pixel(centerX + 2, headY + 10, freckleColor);
            d.pixel(centerX - 5, headY + 11, freckleColor);
          }
        }
        if (Math.random() > 0.85 && direction === "down") {
          d.pixel(centerX + 4, headY + 9, "#8b4513");
        }
      }

      drawShoes(d, leftX, rightX, shoeY, direction) {
        const shoeColor = "#4a3728";
        const shoeDark = "#2d1b18";
        const shoeLight = "#6b5344";
        const shoeHighlight = "#7d5e53";
        if (direction === "down") {
          d.rect(leftX, shoeY, 5, 3, shoeColor);
          d.rect(leftX + 1, shoeY, 3, 1, shoeLight);
          d.rect(leftX + 3, shoeY, 2, 3, shoeDark);
          d.pixel(leftX + 1, shoeY + 1, shoeHighlight);
          d.hLine(leftX, shoeY + 3, 5, "#1a1a1a");
          d.rect(rightX - 5, shoeY, 5, 3, shoeColor);
          d.rect(rightX - 4, shoeY, 3, 1, shoeLight);
          d.rect(rightX - 3, shoeY, 2, 3, shoeDark);
          d.pixel(rightX - 3, shoeY + 1, shoeHighlight);
          d.hLine(rightX - 5, shoeY + 3, 5, "#1a1a1a");
        } else if (direction === "up") {
          d.rect(leftX, shoeY, 5, 3, shoeColor);
          d.rect(rightX - 5, shoeY, 5, 3, shoeColor);
          d.hLine(leftX, shoeY + 3, 5, "#1a1a1a");
          d.hLine(rightX - 5, shoeY + 3, 5, "#1a1a1a");
        } else {
          d.rect(leftX, shoeY, 8, 3, shoeColor);
          d.rect(leftX + 1, shoeY, 5, 1, shoeLight);
          d.rect(direction === "left" ? leftX + 5 : leftX, shoeY, 3, 3, shoeDark);
          d.pixel(leftX + 2, shoeY + 1, shoeHighlight);
          d.hLine(leftX, shoeY + 3, 8, "#1a1a1a");
          d.pixel(direction === "left" ? leftX : leftX + 7, shoeY + 1, shoeHighlight);
        }
      }

      getWalkOffset(frame) {
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

      getBodyScale(bodyType) {
        const scaleMap = { 瘦: 0.85, 标准: 1.0, 壮: 1.15, 胖: 1.25 };
        return scaleMap[bodyType];
      }

      getHeightScale(height) {
        const scaleMap = { 矮小: 0.92, 中等: 1.0, 高挑: 1.08 };
        return scaleMap[height];
      }

      getAgeScale(age) {
        const scaleMap = { 小孩: 1.15, 青年: 1.0, 中年: 1.0, 老年: 0.95 };
        return scaleMap[age];
      }

      getEyeSize(eyeType) {
        const sizeMap = { 大眼: 3, 中等: 2.5, 小眼: 2, 圆眼: 3, 细长: 2.5, 下垂: 2.5, 上挑: 2.5 };
        return sizeMap[eyeType];
      }

      darkenColor(color, factor) {
        const hex = color.replace("#", "");
        const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
        const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
        const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);
        return `rgb(${r},${g},${b})`;
      }

      lightenColor(color, factor) {
        const hex = color.replace("#", "");
        const r = Math.min(255, Math.floor(parseInt(hex.substring(0, 2), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hex.substring(2, 4), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hex.substring(4, 6), 16) * factor));
        return `rgb(${r},${g},${b})`;
      }
    }

    // ============ 全局状态 ============
    const generator = new CharacterSpriteGenerator();
    let currentAppearance = null;
    let currentSpriteSheet = null;

    // ============ 随机选择工具 ============
    function randomPick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function getValueOrRandom(id, options) {
      const el = document.getElementById(id);
      const val = el.value;
      return val === "随机" ? randomPick(options) : val;
    }

    // ============ 生成角色 ============
    function generateCharacter() {
      const appearance = {
        性别: getValueOrRandom("gender", ["男", "女"]),
        年龄: getValueOrRandom("age", ["小孩", "青年", "中年", "老年"]),
        身高: getValueOrRandom("height", ["矮小", "中等", "高挑"]),
        体型: getValueOrRandom("bodyType", ["瘦", "标准", "壮", "胖"]),
        肤色: getValueOrRandom("skin", ["白皙", "暖色", "麦色", "深色"]),
        发色: getValueOrRandom("hairColor", ["黑色", "深棕", "浅棕", "金色", "红色", "灰色"]),
        发型: getValueOrRandom("hairStyle", ["短发", "中长", "长发", "束发", "光头", "卷发"]),
        眼睛: getValueOrRandom("eyes", ["大眼", "中等", "小眼", "圆眼", "细长", "下垂", "上挑"]),
        脸型: getValueOrRandom("faceShape", ["圆脸", "方脸", "长脸", "瓜子脸"]),
        表情: getValueOrRandom("expression", ["温和微笑", "严肃认真", "开朗大笑", "忧郁沉默", "高傲冷漠", "呆萌天然"]),
        穿衣风格: getValueOrRandom("clothing", ["朴素", "普通", "讲究", "华丽", "时髦"]),
      };

      currentAppearance = appearance;
      currentSpriteSheet = generator.generateSpriteSheet(appearance);

      updatePreview();
      updateAttributes();
    }

    function randomAll() {
      document.getElementById("gender").value = "随机";
      document.getElementById("age").value = "随机";
      document.getElementById("height").value = "随机";
      document.getElementById("bodyType").value = "随机";
      document.getElementById("skin").value = "随机";
      document.getElementById("hairColor").value = "随机";
      document.getElementById("hairStyle").value = "随机";
      document.getElementById("eyes").value = "随机";
      document.getElementById("faceShape").value = "随机";
      document.getElementById("expression").value = "随机";
      document.getElementById("clothing").value = "随机";
      generateCharacter();
    }

    // ============ 更新预览 ============
    function updatePreview() {
      console.log("updatePreview called, spriteSheet:", currentSpriteSheet ? "exists" : "null");
      if (!currentSpriteSheet) {
        console.log("No sprite sheet to preview");
        return;
      }

      // 精灵表预览 - 直接显示原始尺寸
      const spritePreview = document.getElementById("spritePreview");
      spritePreview.innerHTML = "";

      // 创建放大2倍的画布
      const displayCanvas = document.createElement("canvas");
      displayCanvas.width = 256 * 2;
      displayCanvas.height = 48 * 2;
      displayCanvas.style.border = "2px solid #0f3460";
      displayCanvas.style.background = "#0d1b2a";
      const displayCtx = displayCanvas.getContext("2d");
      displayCtx.imageSmoothingEnabled = false;
      displayCtx.drawImage(currentSpriteSheet, 0, 0, 256, 48, 0, 0, 512, 96);
      spritePreview.appendChild(displayCanvas);

      // 放大预览 - 每个方向提取第一帧
      const zoomedPreview = document.getElementById("zoomedPreview");
      zoomedPreview.innerHTML = "";
      const directions = ["正面", "背面", "左面", "右面"];
      const dirCodes = ["down", "up", "left", "right"];

      for (let i = 0; i < 4; i++) {
        const frameDiv = document.createElement("div");
        frameDiv.className = "zoomed-frame";

        // 创建放大4倍的画布 (32x48 -> 128x192)
        const zCanvas = document.createElement("canvas");
        zCanvas.width = 128;
        zCanvas.height = 192;
        zCanvas.style.border = "2px solid #0f3460";
        zCanvas.style.background = "#0d1b2a";
        zCanvas.style.imageRendering = "pixelated";
        const zCtx = zCanvas.getContext("2d");
        zCtx.imageSmoothingEnabled = false;

        // 从精灵表提取对应方向的第0帧 (每方向2帧，每帧32宽)
        const srcX = i * 64; // down=0, up=64, left=128, right=192
        zCtx.drawImage(currentSpriteSheet, srcX, 0, 32, 48, 0, 0, 128, 192);

        frameDiv.appendChild(zCanvas);
        const label = document.createElement("label");
        label.textContent = directions[i];
        frameDiv.appendChild(label);
        zoomedPreview.appendChild(frameDiv);
      }

      console.log("Preview updated successfully");
    }

    // ============ 更新属性面板 ============
    function updateAttributes() {
      if (!currentAppearance) return;
      const list = document.getElementById("attributesList");
      const attrs = [
        { name: "性别", value: currentAppearance.性别 },
        { name: "年龄", value: currentAppearance.年龄 },
        { name: "身高", value: currentAppearance.身高 },
        { name: "体型", value: currentAppearance.体型 },
        { name: "肤色", value: currentAppearance.肤色 },
        { name: "发色", value: currentAppearance.发色 },
        { name: "发型", value: currentAppearance.发型 },
        { name: "眼睛", value: currentAppearance.眼睛 },
        { name: "脸型", value: currentAppearance.脸型 },
        { name: "表情", value: currentAppearance.表情 },
        { name: "穿衣风格", value: currentAppearance.穿衣风格 },
      ];

      list.innerHTML = attrs.map(attr => `
        <div class="attribute-item">
          <span class="attribute-name">${attr.name}</span>
          <span class="attribute-value">${attr.value}</span>
        </div>
      `).join("");
    }

    // ============ 下载精灵图 ============
    function downloadSprite() {
      if (!currentSpriteSheet) return;
      const link = document.createElement("a");
      link.download = `character_${Date.now()}.png`;
      link.href = currentSpriteSheet.toDataURL("image/png");
      link.click();
    }

    // ============ 批量生成 ============
    function generateBatch() {
      const grid = document.getElementById("batchGrid");
      grid.innerHTML = "";

      const bodyTypes = ["瘦", "标准", "壮", "胖"];
      const heightTypes = ["矮小", "中等", "高挑"];
      const skinTones = ["白皙", "暖色", "麦色", "深色"];
      const hairColors = ["黑色", "深棕", "浅棕", "金色", "红色", "灰色"];
      const hairStyles = ["短发", "中长", "长发", "束发", "光头", "卷发"];
      const eyeTypes = ["大眼", "中等", "小眼", "圆眼", "细长", "下垂", "上挑"];
      const faceShapes = ["圆脸", "方脸", "长脸", "瓜子脸"];
      const expressions = ["温和微笑", "严肃认真", "开朗大笑", "忧郁沉默", "高傲冷漠", "呆萌天然"];
      const clothingStyles = ["朴素", "普通", "讲究", "华丽", "时髦"];
      const ageGroups = ["小孩", "青年", "中年", "老年"];
      const genders = ["男", "女"];

      for (let i = 0; i < 8; i++) {
        const appearance = {
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

        const spriteSheet = generator.generateSpriteSheet(appearance);

        const item = document.createElement("div");
        item.className = "batch-item";

        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 192;
        canvas.style.imageRendering = "pixelated";
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteSheet, 0, 0, 32, 48, 0, 0, 128, 192);

        const name = `${appearance.性别}${appearance.年龄}${i + 1}`;
        const desc = `${appearance.身高}·${appearance.体型}·${appearance.发色}`;

        item.innerHTML = `
          <div class="name">${name}</div>
          <div class="desc">${desc}</div>
        `;
        item.insertBefore(canvas, item.firstChild);

        // 点击批量角色可以加载到主预览
        item.onclick = () => {
          currentAppearance = appearance;
          currentSpriteSheet = spriteSheet;
          updatePreview();
          updateAttributes();
          // 同步下拉框
          document.getElementById("gender").value = appearance.性别;
          document.getElementById("age").value = appearance.年龄;
          document.getElementById("height").value = appearance.身高;
          document.getElementById("bodyType").value = appearance.体型;
          document.getElementById("skin").value = appearance.肤色;
          document.getElementById("hairColor").value = appearance.发色;
          document.getElementById("hairStyle").value = appearance.发型;
          document.getElementById("eyes").value = appearance.眼睛;
          document.getElementById("faceShape").value = appearance.脸型;
          document.getElementById("expression").value = appearance.表情;
          document.getElementById("clothing").value = appearance.穿衣风格;
        };

        grid.appendChild(item);
      }
    }

    function clearBatch() {
      document.getElementById("batchGrid").innerHTML = "";
    }

    // ============ 初始化 ============
    window.generateCharacter = generateCharacter;
    window.randomAll = randomAll;
    window.downloadSprite = downloadSprite;
    window.generateBatch = generateBatch;
    window.clearBatch = clearBatch;

    console.log("Character Generator loaded, functions registered");

    // 页面加载完成后生成一个默认角色
    document.addEventListener("DOMContentLoaded", function() {
      console.log("DOM ready, generating initial character...");
      try {
        randomAll();
        console.log("Initial character generated successfully");
      } catch (e) {
        console.error("Failed to generate initial character:", e);
      }
    });
  