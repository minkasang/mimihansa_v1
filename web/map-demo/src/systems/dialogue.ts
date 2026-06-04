/**
 * 对话系统 - 数据驱动版
 *
 * 核心管线:
 *   意图结构体 → 场景模板 → 文本选择(5轴风格) → 气泡渲染 → B决策 → 回应文本 → 效果结算
 *
 * 三个 JSON 库:
 *   data/libraries/对话意图库.json  ← NPC为什么会说话
 *   data/libraries/对话场景库.json  ← 对话树骨架
 *   data/libraries/对话文本库.json  ← 所有句型模板
 */

import intentLibRaw from "../../../../data/libraries/对话意图库.json";
import sceneLibRaw from "../../../../data/libraries/对话场景库.json";
import textLibRaw from "../../../../data/libraries/对话文本库.json";

// ==================== 对话类型 ====================
export enum DialogueType {
  THOUGHT = "thought",
  SPEAK = "speak",
  ACTION = "action",
  EMOTION = "emotion",
  TASK = "task",
}

// ==================== 对话内容 ====================
export interface Dialogue {
  id: string;
  type: DialogueType;
  text: string;
  speakerId: string;
  targetId?: string;
  duration: number;
  createdAt: number;
  offsetX?: number;
  offsetY?: number;
}

// ==================== 意图包 ====================
export interface IntentPacket {
  意图id: string;
  名称: string;
  语气: string;
  主动方NPC: {
    id: string;
    姓名: string;
    性格: Record<string, number>;
    标签: string[];
  };
  被动方NPC: {
    id: string;
    姓名: string;
    性格: Record<string, number>;
    好感度: number;
    标签: string[];
  };
  变量: Record<string, string>;
  环境?: {
    公开场合: boolean;
    是否白天: boolean;
    附近有火堆: boolean;
  };
}

// ==================== 内部类型 ====================
interface IntentDef {
  意图id: string;
  名称: string;
  场景模板: string;
  触发条件: any;
  冷却Ticks: number;
  最大轮数: number;
  需要目标NPC: boolean;
  目标选择: string;
}

interface SceneDef {
  场景id: string;
  名称: string;
  节点: SceneNode[];
}

interface SceneNode {
  节点id: string;
  发言方: "主动方" | "被动方";
  文本标签: string;
  节点效果?: any[];
  回应列表: ResponseOption[];
}

interface ResponseOption {
  回应id: string;
  回应名称: string;
  文本标签: string;
  跳转节点?: string;
  决策权重: {
    性格乘数?: Record<string, [[string, number], number][]>;
    好感乘数?: Record<string, number>;
    环境乘数?: Record<string, number>;
    基础权重: number;
  };
  附带动作?: any;
  结束对话?: boolean;
}

// ==================== 对话系统 ====================
export class DialogueSystem {
  private dialogues: Map<string, Dialogue[]> = new Map();
  private maxDialoguesPerNpc = 3;

  // 数据驱动库
  private intentLib: IntentDef[] = [];
  private sceneLib: Map<string, SceneDef> = new Map();
  private textLib: Record<string, any> = {};

  // 意图冷却追踪: intentId -> 上次触发tick
  private intentCooldowns: Map<string, number> = new Map();

  constructor() {
    this.loadLibraries();
  }

  private loadLibraries(): void {
    try {
      const intents = intentLibRaw as any;
      if (intents.意图列表) {
        this.intentLib = intents.意图列表;
      }

      const scenes = sceneLibRaw as any;
      if (scenes.场景列表) {
        for (const s of scenes.场景列表) {
          this.sceneLib.set(s.场景id, s as SceneDef);
        }
      }

      const texts = textLibRaw as any;
      if (texts.文本池) {
        this.textLib = texts.文本池;
      }

      console.log(`对话系统: 已加载 ${this.intentLib.length} 个意图, ${this.sceneLib.size} 个场景`);
    } catch (e) {
      console.warn("对话系统: JSON库加载失败，使用空库", e);
    }
  }

  // ==================== 5轴说话风格判定 ====================
  calcSpeechStyle(personality: Record<string, number>): string {
    const p = personality;

    const 礼貌 = (p["道德水准_规则遵守"] || 5) * 0.6 + (p["社交属性_自我坦露"] || 5) * 0.4;
    const 情感 = (p["情绪基调_积极倾向"] || 5) * 0.5 + (p["人际关系_忠诚度"] || 5) * 0.5;

    let styleKey = "";

    if (礼貌 >= 7) styleKey += "polite";
    else if (礼貌 < 4) styleKey += "blunt";
    else styleKey += "neutral";

    styleKey += "_";

    if (情感 >= 7) styleKey += "warm";
    else if (情感 < 4) styleKey += "cold";
    else styleKey += "mid";

    return styleKey;
  }

  private getExtraStyleTag(personality: Record<string, number>): string | null {
    const tags: { tag: string; threshold: number; field: string }[] = [
      { tag: "bookish", threshold: 7, field: "后天气质_书生气" },
      { tag: "humorous", threshold: 7, field: "行事风格_幽默感" },
      { tag: "bold", threshold: 7, field: "胆魄气量_勇气阈值" },
    ];
    const hits = tags.filter(t => (personality[t.field] || 0) >= t.threshold);
    return hits.length > 0 ? hits[Math.floor(Math.random() * hits.length)].tag : null;
  }

  // ==================== 文本选择器 ====================
  selectText(
    textTag: string,
    personality: Record<string, number>,
    variables: Record<string, string> = {}
  ): string {
    const pool = this.textLib[textTag] as Record<string, string[]> | undefined;
    if (!pool) {
      return `[缺文本: ${textTag}]`;
    }

    let candidatePool: string[] | null = null;

    const extraTag = this.getExtraStyleTag(personality);
    if (extraTag && pool[extraTag]) {
      candidatePool = pool[extraTag];
    }

    if (!candidatePool) {
      const styleKey = this.calcSpeechStyle(personality);
      candidatePool = pool[styleKey] || null;
    }

    if (!candidatePool) {
      candidatePool = pool["默认"] || Object.values(pool).find(v => Array.isArray(v)) as string[] || [];
    }

    if (candidatePool.length === 0) {
      return `[空文本池: ${textTag}]`;
    }

    let text = candidatePool[Math.floor(Math.random() * candidatePool.length)];

    for (const [key, val] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), val);
    }

    return text;
  }

  // ==================== 决策引擎 ====================
  decideResponse(
    sceneId: string,
    nodeId: string,
    bPersonality: Record<string, number>,
    affection: number,
    environment: Record<string, boolean> = {}
  ): ResponseOption | null {
    const scene = this.sceneLib.get(sceneId);
    if (!scene) return null;

    const node = scene.节点.find(n => n.节点id === nodeId);
    if (!node || node.回应列表.length === 0) return null;

    const weighted: { option: ResponseOption; weight: number }[] = [];

    for (const option of node.回应列表) {
      let weight = option.决策权重.基础权重;

      if (option.决策权重.性格乘数) {
        for (const [field, conditions] of Object.entries(option.决策权重.性格乘数)) {
          const val = bPersonality[field] || 5;
          for (const [op_threshold, multiplier] of conditions) {
            const op = op_threshold[0] as string;
            const threshold = op_threshold[1] as number;
            let matched = false;
            switch (op) {
              case ">=": matched = val >= threshold; break;
              case ">": matched = val > threshold; break;
              case "<=": matched = val <= threshold; break;
              case "<": matched = val < threshold; break;
              case "==": matched = val === threshold; break;
            }
            if (matched) weight *= multiplier as number;
          }
        }
      }

      if (option.决策权重.好感乘数) {
        for (const [range, multiplier] of Object.entries(option.决策权重.好感乘数)) {
          if (range === ">=70" && affection >= 70) weight *= multiplier;
          else if (range === ">=60" && affection >= 60) weight *= multiplier;
          else if (range === ">=50" && affection >= 50) weight *= multiplier;
          else if (range === ">=40" && affection >= 40) weight *= multiplier;
          else if (range === ">=30" && affection >= 30) weight *= multiplier;
          else if (range === ">=20" && affection >= 20) weight *= multiplier;
          else if (range === ">=15" && affection >= 15) weight *= multiplier;
          else if (range === ">=10" && affection >= 10) weight *= multiplier;
          else if (range === "<0" && affection < 0) weight *= multiplier;
          else if (range === "<-10" && affection < -10) weight *= multiplier;
          else if (range === "<-20" && affection < -20) weight *= multiplier;
          else if (range === "<10" && affection < 10) weight *= multiplier;
          else if (range === "<15" && affection < 15) weight *= multiplier;
          else if (range === "<25" && affection < 25) weight *= multiplier;
          else if (range === "<30" && affection < 30) weight *= multiplier;
          else if (range === "<40" && affection < 40) weight *= multiplier;
          else if (range === "<50" && affection < 50) weight *= multiplier;
        }
      }

      if (option.决策权重.环境乘数) {
        for (const [key, multiplier] of Object.entries(option.决策权重.环境乘数)) {
          if (environment[key]) weight *= multiplier;
        }
      }

      weighted.push({ option, weight: Math.max(0.1, weight) });
    }

    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * total;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.option;
    }
    return weighted[weighted.length - 1].option;
  }

  // ==================== 意图匹配 ====================
  findMatchingIntent(npcState: any, context: Record<string, any>): IntentDef | null {
    for (const intent of this.intentLib) {
      // 检查冷却
      const lastTick = this.intentCooldowns.get(intent.意图id) || 0;
      if (context._worldTick && context._worldTick - lastTick < intent.冷却Ticks) continue;

      // 简单条件检查（生产环境用 ConditionEvaluator）
      if (this.checkSimpleCondition(intent.触发条件, npcState, context)) {
        this.intentCooldowns.set(intent.意图id, context._worldTick || 0);
        return intent;
      }
    }
    return null;
  }

  private checkSimpleCondition(condition: any, npcState: any, context: Record<string, any>): boolean {
    if (!condition) return true;

    if (condition["且"]) {
      return condition["且"].every((c: any) => this.checkSimpleCondition(c, npcState, context));
    }
    if (condition["或"]) {
      return condition["或"].some((c: any) => this.checkSimpleCondition(c, npcState, context));
    }

    const key = Object.keys(condition)[0];
    if (!key) return true;

    const [op, threshold] = condition[key] as [string, number];
    const val = this.resolveNpcValue(key, npcState, context);

    switch (op) {
      case ">=": return val >= threshold;
      case ">": return val > threshold;
      case "<=": return val <= threshold;
      case "<": return val < threshold;
      case "==": return val === threshold;
      default: return false;
    }
  }

  private resolveNpcValue(key: string, npcState: any, context: Record<string, any>): number {
    if (key.startsWith("NPC.性格.")) {
      const field = key.replace("NPC.性格.", "");
      return npcState.性格?.[field] || 5;
    }
    if (key.startsWith("NPC.生理状态.")) {
      const field = key.replace("NPC.生理状态.", "");
      return npcState.生理状态?.[field] || 5;
    }
    if (key.startsWith("NPC.物品栏.")) {
      const field = key.replace("NPC.物品栏.", "");
      if (field === "食物数量") {
        const items = npcState.物品栏 || [];
        return items.filter((i: any) => i.类型 === "食物").length;
      }
    }
    if (key.startsWith("NPC.记忆标签.")) {
      const field = key.replace("NPC.记忆标签.", "");
      return (npcState.记忆标签 || []).includes(field) ? 1 : 0;
    }
    if (key.startsWith("NPC.金钱")) {
      return npcState.金钱 || 0;
    }
    if (key.startsWith("感知.")) {
      const field = key.replace("感知.", "");
      return context[field] ? 1 : 0;
    }
    if (key.startsWith("NPC.社会关系.")) {
      const field = key.replace("NPC.社会关系.", "");
      if (field === "有暗恋对象") return context["有暗恋对象"] ? 1 : 0;
      if (field === "对暗恋对象好感") return context["对暗恋对象好感"] || 0;
    }
    return 0;
  }

  // ==================== 场景对话管线 ====================
  startDialogueScene(intent: IntentDef, packet: IntentPacket): Dialogue[] {
    const result: Dialogue[] = [];
    const scene = this.sceneLib.get(intent.场景模板);
    if (!scene || scene.节点.length === 0) return result;

    const activeParty = packet.主动方NPC;
    const passiveParty = packet.被动方NPC;
    const env = packet.环境 || { 公开场合: true, 是否白天: true, 附近有火堆: false };

    let currentNode = scene.节点[0];
    let round = 0;
    const maxRounds = intent.最大轮数 || 3;

    while (currentNode && round < maxRounds) {
      if (currentNode.发言方 === "主动方") {
        const text = this.selectText(currentNode.文本标签, activeParty.性格, packet.变量);
        result.push({
          id: `dlg_${Date.now()}_${round}_a`,
          type: DialogueType.SPEAK,
          text,
          speakerId: activeParty.id,
          targetId: passiveParty.id,
          duration: text.length > 20 ? 5000 : 3000,
          createdAt: Date.now(),
        });
      }

      const chosen = this.decideResponse(
        scene.场景id,
        currentNode.节点id,
        passiveParty.性格,
        passiveParty.好感度,
        env
      );

      if (!chosen) break;

      const responseText = this.selectText(chosen.文本标签, passiveParty.性格, packet.变量);
      const speaker = currentNode.发言方 === "主动方" ? passiveParty : activeParty;
      result.push({
        id: `dlg_${Date.now()}_${round}_b`,
        type: DialogueType.SPEAK,
        text: responseText,
        speakerId: speaker.id,
        targetId: currentNode.发言方 === "主动方" ? activeParty.id : passiveParty.id,
        duration: responseText.length > 20 ? 5000 : 3000,
        createdAt: Date.now(),
      });

      if (chosen.结束对话 || !chosen.跳转节点) break;

      const nextNode = scene.节点.find(n => n.节点id === chosen.跳转节点);
      if (!nextNode) break;

      currentNode = nextNode;
      round++;

      // 如果下一节点是主动方发言，把变量传下去
      if (nextNode.发言方 === "被动方" && chosen.附带动作) {
        if (chosen.附带动作.变量) {
          Object.assign(packet.变量, chosen.附带动作.变量);
        }
      }
    }

    return result;
  }

  // ==================== 加旧接口（兼容现有代码） ====================
  addCustomDialogue(
    speakerId: string,
    text: string,
    type: DialogueType = DialogueType.SPEAK,
    duration: number = 4000,
    targetId?: string
  ): Dialogue {
    const dialogue: Dialogue = {
      id: `dlg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      text,
      speakerId,
      targetId,
      duration,
      createdAt: Date.now(),
    };
    this.addDialogue(speakerId, dialogue);
    return dialogue;
  }

  generateDialogue(
    actionId: string,
    speakerId: string,
    personality: Record<string, number>,
    _target?: { id: string; name: string }
  ): Dialogue | null {
    const text = this.selectText("greet.主动", personality, { 对方: _target?.name || "" });
    if (!text) return null;

    return this.addCustomDialogue(speakerId, text, DialogueType.SPEAK, 3000, _target?.id);
  }

  private addDialogue(npcId: string, dialogue: Dialogue): void {
    const npcDialogues = this.dialogues.get(npcId) || [];
    npcDialogues.push(dialogue);
    if (npcDialogues.length > this.maxDialoguesPerNpc) {
      npcDialogues.shift();
    }
    this.dialogues.set(npcId, npcDialogues);
  }

  getActiveDialogues(npcId: string): Dialogue[] {
    const now = Date.now();
    const npcDialogues = this.dialogues.get(npcId) || [];
    const active = npcDialogues.filter(d => now - d.createdAt < d.duration);
    if (active.length !== npcDialogues.length) {
      this.dialogues.set(npcId, active);
    }
    return active;
  }

  getAllActiveDialogues(): Map<string, Dialogue[]> {
    const result = new Map<string, Dialogue[]>();
    for (const [npcId] of this.dialogues) {
      const active = this.getActiveDialogues(npcId);
      if (active.length > 0) result.set(npcId, active);
    }
    return result;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [npcId, dialogues] of this.dialogues.entries()) {
      const active = dialogues.filter(d => now - d.createdAt < d.duration);
      if (active.length === 0) {
        this.dialogues.delete(npcId);
      } else {
        this.dialogues.set(npcId, active);
      }
    }
  }

  private getDurationByType(type: DialogueType): number {
    switch (type) {
      case DialogueType.THOUGHT: return 3000;
      case DialogueType.SPEAK: return 4000;
      case DialogueType.ACTION: return 2500;
      case DialogueType.EMOTION: return 2000;
      case DialogueType.TASK: return 3500;
      default: return 3000;
    }
  }

  // ==================== 气泡渲染 ====================
  drawBubble(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    type: DialogueType,
    scale: number
  ): void {
    const padding = 8 * scale;
    const fontSize = Math.max(10, 12 * scale);
    const lineHeight = fontSize * 1.4;
    const maxWidth = 150 * scale;

    ctx.font = `${fontSize}px sans-serif`;

    const lines = this.wrapText(ctx, text, maxWidth);
    const textWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width)));
    const bubbleWidth = textWidth + padding * 2;
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y - bubbleHeight - 15 * scale;

    const colors = this.getBubbleColors(type);

    ctx.fillStyle = colors.background;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5 * scale;

    this.drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 6 * scale, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 8 * scale);
    ctx.lineTo(x + 6 * scale, bubbleY + bubbleHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.text;
    ctx.textAlign = "left";
    lines.forEach((line, i) => {
      ctx.fillText(line, bubbleX + padding, bubbleY + padding + (i + 0.8) * lineHeight);
    });
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const chars = text.split("");
    const lines: string[] = [];
    let currentLine = "";
    for (const char of chars) {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine !== "") {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine !== "") lines.push(currentLine);
    return lines;
  }

  private getBubbleColors(type: DialogueType): { background: string; border: string; text: string } {
    switch (type) {
      case DialogueType.THOUGHT:
        return { background: "rgba(200,200,200,0.9)", border: "#999", text: "#333" };
      case DialogueType.SPEAK:
        return { background: "rgba(255,255,255,0.95)", border: "#333", text: "#000" };
      case DialogueType.ACTION:
        return { background: "rgba(255,243,224,0.9)", border: "#ff9800", text: "#e65100" };
      case DialogueType.EMOTION:
        return { background: "rgba(255,235,238,0.9)", border: "#e91e63", text: "#c2185b" };
      case DialogueType.TASK:
        return { background: "rgba(232,245,233,0.9)", border: "#4caf50", text: "#2e7d32" };
      default:
        return { background: "rgba(255,255,255,0.9)", border: "#666", text: "#333" };
    }
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
