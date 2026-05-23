/**
 * 对话/气泡系统 - 通用机制
 * 基于感知和性格触发的对话
 */

// ==================== 对话类型 ====================
export enum DialogueType {
  THOUGHT = "thought",     // 内心想法
  SPEAK = "speak",         // 说话
  ACTION = "action",       // 动作描述
  EMOTION = "emotion",     // 情绪表达
  TASK = "task",           // 任务相关
}

// ==================== 对话内容 ====================
export interface Dialogue {
  id: string;
  type: DialogueType;
  text: string;
  speakerId: string;
  targetId?: string;
  // 显示时长（毫秒）
  duration: number;
  // 创建时间
  createdAt: number;
  // 位置偏移
  offsetX?: number;
  offsetY?: number;
}

// ==================== 对话模板 ====================
interface DialogueTemplate {
  type: DialogueType;
  texts: string[];
  conditions?: (personality: Record<string, number>, target?: any) => boolean;
}

// ==================== 对话数据库 ====================
const DIALOGUE_DB: Record<string, DialogueTemplate[]> = {
  // 搭讪相关
  "action_搭讪": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "你好啊，今天天气不错！",
        "嗨，能认识一下吗？",
        "你看起来有点面熟，我们是不是见过？",
        "你好，我是{speaker}，很高兴认识你！",
      ],
    },
    {
      type: DialogueType.THOUGHT,
      texts: [
        "这个人看起来挺有意思的...",
        "要不要上去搭个话呢？",
        "我该怎么开口比较好？",
      ],
    },
  ],

  // 追求相关
  "action_追求": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "你今天真好看！",
        "能请你喝杯茶吗？",
        "我...我喜欢你！",
        "能给我个机会吗？",
      ],
    },
    {
      type: DialogueType.THOUGHT,
      texts: [
        "心跳得好快...",
        "她/他真的好美/帅...",
        "我一定要追到！",
        "要是被拒绝了怎么办...",
      ],
    },
    {
      type: DialogueType.EMOTION,
      texts: [
        "(脸红)",
        "(紧张地搓手)",
        "(深呼吸)",
        "(眼神躲闪)",
      ],
    },
  ],

  // 工作相关
  "action_工作": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "欢迎光临！",
        "需要点什么？",
        "今天有新货哦！",
        "慢走，欢迎下次再来！",
      ],
    },
    {
      type: DialogueType.THOUGHT,
      texts: [
        "今天生意怎么样？",
        "该进货了...",
        "好累啊，想休息...",
      ],
    },
    {
      type: DialogueType.ACTION,
      texts: [
        "(整理货架)",
        "(擦拭柜台)",
        "(数钱)",
        "(招呼客人)",
      ],
    },
  ],

  // 闲逛
  "action_闲逛": [
    {
      type: DialogueType.THOUGHT,
      texts: [
        "今天去哪儿好呢？",
        "好无聊啊...",
        "看看有什么好玩的...",
        "天气真好，散散步吧。",
      ],
    },
    {
      type: DialogueType.ACTION,
      texts: [
        "(四处张望)",
        "(踢着石子)",
        "(伸懒腰)",
        "(哼着小曲)",
      ],
    },
  ],

  // 对话回应
  "response_接受": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "好啊！",
        "没问题！",
        "听起来不错！",
        "我很乐意！",
      ],
    },
  ],

  "response_拒绝": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "不好意思，我有点忙...",
        "抱歉，不太方便...",
        "下次吧...",
        "呃...我考虑一下...",
      ],
    },
  ],

  // 感知到高颜值
  "perceive_美貌": [
    {
      type: DialogueType.THOUGHT,
      texts: [
        "哇，那个人长得真好看...",
        "好漂亮/帅啊...",
        "要是能认识就好了...",
        "心跳加速了...",
      ],
    },
  ],

  // 日常问候
  "greeting": [
    {
      type: DialogueType.SPEAK,
      texts: [
        "早啊！",
        "吃了吗？",
        "去哪儿啊？",
        "今天怎么样？",
      ],
    },
  ],
};

// ==================== 对话系统 ====================
export class DialogueSystem {
  private dialogues: Map<string, Dialogue[]> = new Map(); // npcId -> dialogues
  private maxDialoguesPerNpc = 3;

  /**
   * 添加自定义对话（绕过模板数据库，直接显示文本）
   */
  addCustomDialogue(
    speakerId: string,
    text: string,
    type: DialogueType = DialogueType.SPEAK,
    duration: number = 4000,
    targetId?: string
  ): Dialogue {
    const dialogue: Dialogue = {
      id: `dlg_${Date.now()}_${Math.random()}`,
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

  /**
   * 生成对话
   */
  generateDialogue(
    actionId: string,
    speakerId: string,
    personality: Record<string, number>,
    target?: { id: string; name: string }
  ): Dialogue | null {
    const templates = DIALOGUE_DB[actionId];
    if (!templates || templates.length === 0) return null;

    // 随机选择一个模板
    const template = templates[Math.floor(Math.random() * templates.length)];

    // 随机选择一条文本
    let text = template.texts[Math.floor(Math.random() * template.texts.length)];

    // 替换变量
    text = text.replace("{speaker}", speakerId);
    if (target) {
      text = text.replace("{target}", target.name);
    }

    const dialogue: Dialogue = {
      id: `dlg_${Date.now()}_${Math.random()}`,
      type: template.type,
      text,
      speakerId,
      targetId: target?.id,
      duration: this.getDurationByType(template.type),
      createdAt: Date.now(),
    };

    // 存储对话
    this.addDialogue(speakerId, dialogue);

    return dialogue;
  }

  /**
   * 生成感知对话
   */
  generatePerceptionDialogue(
    perceptionType: string,
    observerId: string,
    target: { id: string; name: string; visual?: { 颜值?: number } }
  ): Dialogue | null {
    const key = `perceive_${perceptionType}`;
    const templates = DIALOGUE_DB[key];
    if (!templates) return null;

    const template = templates[Math.floor(Math.random() * templates.length)];
    let text = template.texts[Math.floor(Math.random() * template.texts.length)];
    text = text.replace("{target}", target.name);

    const dialogue: Dialogue = {
      id: `dlg_${Date.now()}_${Math.random()}`,
      type: template.type,
      text,
      speakerId: observerId,
      targetId: target.id,
      duration: this.getDurationByType(template.type),
      createdAt: Date.now(),
    };

    this.addDialogue(observerId, dialogue);
    return dialogue;
  }

  /**
   * 添加对话到NPC
   */
  private addDialogue(npcId: string, dialogue: Dialogue): void {
    const npcDialogues = this.dialogues.get(npcId) || [];
    npcDialogues.push(dialogue);

    // 限制数量
    if (npcDialogues.length > this.maxDialoguesPerNpc) {
      npcDialogues.shift();
    }

    this.dialogues.set(npcId, npcDialogues);
  }

  /**
   * 获取NPC的活跃对话
   */
  getActiveDialogues(npcId: string): Dialogue[] {
    const now = Date.now();
    const npcDialogues = this.dialogues.get(npcId) || [];

    // 过滤掉过期的
    const active = npcDialogues.filter(d => now - d.createdAt < d.duration);

    // 更新存储
    if (active.length !== npcDialogues.length) {
      this.dialogues.set(npcId, active);
    }

    return active;
  }

  /**
   * 获取所有活跃对话
   */
  getAllActiveDialogues(): Map<string, Dialogue[]> {
    const result = new Map<string, Dialogue[]>();
    for (const [npcId, _] of this.dialogues) {
      const active = this.getActiveDialogues(npcId);
      if (active.length > 0) {
        result.set(npcId, active);
      }
    }
    return result;
  }

  /**
   * 清除过期对话
   */
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

  /**
   * 根据类型获取显示时长
   */
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

  /**
   * 绘制气泡
   */
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

    // 分行
    const lines = this.wrapText(ctx, text, maxWidth);
    const textWidth = Math.min(maxWidth, Math.max(...lines.map(l => ctx.measureText(l).width)));
    const bubbleWidth = textWidth + padding * 2;
    const bubbleHeight = lines.length * lineHeight + padding * 2;

    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y - bubbleHeight - 15 * scale;

    // 气泡颜色
    const colors = this.getBubbleColors(type);

    // 绘制气泡背景
    ctx.fillStyle = colors.background;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5 * scale;

    // 圆角矩形
    this.drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8 * scale);
    ctx.fill();
    ctx.stroke();

    // 绘制小三角
    ctx.beginPath();
    ctx.moveTo(x - 6 * scale, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 8 * scale);
    ctx.lineTo(x + 6 * scale, bubbleY + bubbleHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制文字
    ctx.fillStyle = colors.text;
    ctx.textAlign = "left";
    lines.forEach((line, i) => {
      ctx.fillText(line, bubbleX + padding, bubbleY + padding + (i + 0.8) * lineHeight);
    });
  }

  /**
   * 自动换行
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split("");
    const lines: string[] = [];
    let currentLine = "";

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine !== "") {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine !== "") {
      lines.push(currentLine);
    }

    return lines.length === 0 ? [text] : lines;
  }

  /**
   * 获取气泡颜色
   */
  private getBubbleColors(type: DialogueType): { background: string; border: string; text: string } {
    switch (type) {
      case DialogueType.THOUGHT:
        return { background: "rgba(200, 200, 200, 0.9)", border: "#999", text: "#333" };
      case DialogueType.SPEAK:
        return { background: "rgba(255, 255, 255, 0.95)", border: "#333", text: "#000" };
      case DialogueType.ACTION:
        return { background: "rgba(255, 243, 224, 0.9)", border: "#ff9800", text: "#e65100" };
      case DialogueType.EMOTION:
        return { background: "rgba(255, 235, 238, 0.9)", border: "#e91e63", text: "#c2185b" };
      case DialogueType.TASK:
        return { background: "rgba(232, 245, 233, 0.9)", border: "#4caf50", text: "#2e7d32" };
      default:
        return { background: "rgba(255, 255, 255, 0.9)", border: "#666", text: "#333" };
    }
  }

  /**
   * 绘制圆角矩形
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
