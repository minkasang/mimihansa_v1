/**
 * 🌍 世界动力学引擎
 * 负责动作完成后的人格变化、知识传递、好感度更新、每日人格回弹
 */

import brainsRaw from "../../../../data/libraries/Brains_Library.json";

interface PersonalityChangeRules {
  [eventName: string]: Record<string, number>;
}

interface BrainsLibRaw {
  性格弹性系统?: {
    说明?: string;
    变化规则?: PersonalityChangeRules;
    回弹机制?: { 说明?: string; 回弹速率?: number };
  };
}

interface NpcRef {
  id: string;
  personality: Record<string, number>;
  rawData?: {
    记忆标签?: string[];
    知识库?: { 已知地点?: Record<string, any>; 已知人物?: Record<string, any> };
    金钱?: number;
    物品栏?: Array<{ 物品id: string; 名称: string; 数量: number; 类型: string }>;
  };
  brainDebug?: any;
}

export class WorldDynamics {
  private changeRules: PersonalityChangeRules = {};
  private reversionRate = 0.01;

  constructor() {
    const lib = brainsRaw as BrainsLibRaw;
    if (lib.性格弹性系统) {
      this.changeRules = lib.性格弹性系统.变化规则 || {};
      this.reversionRate = lib.性格弹性系统.回弹机制?.回弹速率 || 0.01;
    }
  }

  /** 动作完成时触发 */
  onActionCompleted(npc: NpcRef, actionId: string, target?: NpcRef): void {
    switch (actionId) {
      case "action_送礼":
        this.applyChange(npc, "成功送礼");
        if (target) this.modifyFavor(target, npc.id, 15);
        break;
      case "action_搭讪":
        if (Math.random() < 0.4) {
          this.applyChange(npc, "被拒绝");
          npc.rawData?.记忆标签?.push("被" + (target?.id || "某人") + "拒绝");
          if (target) this.modifyFavor(target, npc.id, -5);
        } else {
          this.applyChange(npc, "被接受");
          if (target) this.modifyFavor(target, npc.id, 5);
        }
        break;
      case "action_greet":
        if (target) {
          this.modifyFavor(target, npc.id, 2);
          this.shareKnowledge(npc, target);
        }
        break;
      case "action_分享信息":
        if (target) {
          this.modifyFavor(target, npc.id, 8);
          this.shareKnowledge(npc, target);
        }
        break;
      case "action_工作":
        this.applyChange(npc, "完成工作");
        break;
      case "action_wander":
        if (Math.random() < 0.05) {
          this.applyChange(npc, "长期闲逛");
        }
        break;
    }
  }

  /** 每天触发一次的性格回弹 */
  dailyReversion(npc: NpcRef): void {
    for (const trait of Object.keys(npc.personality)) {
      const val = npc.personality[trait] || 5;
      if (Math.abs(val - 5) > 0.005) {
        npc.personality[trait] = val + (5 - val) * this.reversionRate;
        npc.personality[trait] = Math.round(npc.personality[trait] * 1000) / 1000;
      }
    }
  }

  private applyChange(npc: NpcRef, eventName: string): void {
    const deltas = this.changeRules[eventName];
    if (!deltas) return;
    for (const [trait, delta] of Object.entries(deltas)) {
      const current = npc.personality[trait] || 5;
      npc.personality[trait] = Math.max(0.1, Math.min(10, current + delta));
      npc.personality[trait] = Math.round(npc.personality[trait] * 1000) / 1000;
    }
  }

  private modifyFavor(target: NpcRef, fromId: string, delta: number): void {
    if (!target.rawData) target.rawData = {};
    if (!target.rawData.知识库) target.rawData.知识库 = { 已知地点: {}, 已知人物: {} };
    if (!target.rawData.知识库.已知人物) target.rawData.知识库.已知人物 = {};
    const current = parseInt(target.rawData.知识库.已知人物[fromId] as string || "0") || 0;
    const next = Math.max(-100, Math.min(100, current + delta));
    target.rawData.知识库.已知人物[fromId] = String(next);
  }

  private shareKnowledge(from: NpcRef, to: NpcRef): void {
    const fromKnowledge = from.rawData?.知识库?.已知地点;
    if (!fromKnowledge) return;
    if (!to.rawData) to.rawData = {};
    if (!to.rawData.知识库) to.rawData.知识库 = { 已知地点: {}, 已知人物: {} };
    if (!to.rawData.知识库.已知地点) to.rawData.知识库.已知地点 = {};

    // 随机分享一条知识
    const entries = Object.entries(fromKnowledge);
    if (entries.length === 0) return;
    const [key, value] = entries[Math.floor(Math.random() * entries.length)];
    if (!to.rawData.知识库.已知地点[key]) {
      to.rawData.知识库.已知地点[key] = value;
    }
  }
}
