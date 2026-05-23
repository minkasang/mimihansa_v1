/**
 * GOAP 目标规划器 - 把目标拆解为指令序列
 *
 * 数据驱动版：从 ActionLibrary 读取指令序列，不再硬编码。
 *
 * 原理：反向推导 —— 从目标出发，递归分解为可执行的原子指令
 */

import { ActionLibrary } from "./ActionLibrary";

export interface Instruction {
  module: string;
  params: Record<string, any>;
}

export interface Goal {
  id: string;
  目标类型: string;
  动作id: string;
  位置策略: string;
  持续条件?: any;
  目标选择?: string;
  目标NPC?: string;
  目标物品?: string;
  目标建筑?: string;
  目标位置?: [number, number];
}

export class GOAPPlanner {
  private actionLib: ActionLibrary;

  constructor(actionLib: ActionLibrary) {
    this.actionLib = actionLib;
  }

  plan(goal: Goal, npcState: NpcState): Instruction[][] {
    switch (goal.目标类型) {
      case "休息":
        return this.planRest(goal, npcState);
      case "吃东西":
        return this.planEat(goal, npcState);
      case "休闲":
        return this.planLeisure(goal, npcState);
      case "社交":
        return this.planSocial(goal, npcState);
      case "送礼":
        return this.planGiveGift(goal, npcState);
      case "工作":
        return this.planWork(goal, npcState);
      case "购物":
        return this.planShopping(goal, npcState);
      default:
        return this.planDefault(goal, npcState);
    }
  }

  private buildVars(goal: Goal, npcState: NpcState): Record<string, any> {
    return {
      家坐标: npcState.家坐标 || [npcState.x, npcState.y],
      当前位置: [npcState.x, npcState.y],
      目标位置: goal.目标位置 || [npcState.x, npcState.y],
      目标NPC: goal.目标NPC || "",
      工作地点: npcState.知识库?.已知地点?.麦田 || npcState.家坐标 || [npcState.x, npcState.y],
    };
  }

  // ──── 休息 ────
  private planRest(goal: Goal, npcState: NpcState): Instruction[][] {
    const vars = this.buildVars(goal, npcState);
    const base = this.actionLib.getInstructions(goal.动作id, vars);
    if (base.length > 0) return [base];

    // 备用
    return [[
      { module: "set_state", params: { key: "当前动作", value: goal.动作id, operation: "set" } },
      { module: "wait", params: { duration: 3000 } },
    ]];
  }

  // ──── 吃东西 ────
  private planEat(goal: Goal, npcState: NpcState): Instruction[][] {
    const plans: Instruction[][] = [];

    if (npcState.物品栏 && npcState.物品栏.some(item => item.类型 === "食物")) {
      const vars = this.buildVars(goal, npcState);
      const seq = this.actionLib.getInstructions(goal.动作id, vars);
      if (seq.length > 0) plans.push(seq);
    }

    plans.push([
      { module: "say", params: { text: "好饿啊...", type: "thought", duration: 2000 } },
      { module: "move_in_area", params: { center: npcState.家坐标 || [npcState.x, npcState.y], radius: 5 } },
    ]);
    return plans;
  }

  // ──── 休闲 ────
  private planLeisure(goal: Goal, npcState: NpcState): Instruction[][] {
    const vars = this.buildVars(goal, npcState);
    const seq = this.actionLib.getInstructions(goal.动作id, vars);
    if (seq.length > 0) return [seq];

    return [[
      { module: "move_in_area", params: { center: [npcState.x, npcState.y], radius: 5 } },
    ]];
  }

  // ──── 社交 ────
  private planSocial(goal: Goal, npcState: NpcState): Instruction[][] {
    const plans: Instruction[][] = [];
    if (!goal.目标NPC || !goal.目标位置) return plans;

    const vars = this.buildVars(goal, npcState);
    const seq = this.actionLib.getInstructions(goal.动作id, vars);
    if (seq.length > 0) plans.push(seq);

    return plans;
  }

  // ──── 送礼 ────
  private planGiveGift(goal: Goal, npcState: NpcState): Instruction[][] {
    const mainPlan: Instruction[] = [];
    const intelligence = npcState.性格?.智力 || npcState.性格?.智商 || 5;
    goal.目标物品 = "苹果";

    const hasItem = npcState.物品栏 &&
      npcState.物品栏.some(item => item.名称 === goal.目标物品);

    if (!hasItem) {
      const knowsShop = npcState.知识库?.已知地点?.水果店;
      if (knowsShop) {
        const coord = knowsShop.坐标 || knowsShop;
        if (Array.isArray(coord) && coord.length >= 2) {
          mainPlan.push(
            { module: "move_to", params: { target: [coord[0], coord[1]] } },
            { module: "say", params: { text: "我想买一个" + goal.目标物品, type: "speak", duration: 3000 } },
          );
        }
      } else {
        mainPlan.push(
          { module: "say", params: { text: "哪里有水果店呢...", type: "thought", duration: 2500 } },
          { module: "move_in_area", params: { center: [npcState.x, npcState.y], radius: 10 } },
        );
      }
    }

    if (goal.目标NPC && goal.目标位置) {
      const vars = this.buildVars(goal, npcState);
      const seq = this.actionLib.getInstructions(goal.动作id, vars);
      mainPlan.push(...seq);
    }

    return mainPlan.length > 0 ? [mainPlan] : [];
  }

  // ──── 工作 ────
  private planWork(goal: Goal, npcState: NpcState): Instruction[][] {
    const vars = this.buildVars(goal, npcState);
    const seq = this.actionLib.getInstructions(goal.动作id, vars);
    if (seq.length > 0) return [seq];

    return [[
      { module: "move_in_area", params: { center: [npcState.x, npcState.y], radius: 8 } },
    ]];
  }

  // ──── 购物 ────
  private planShopping(goal: Goal, npcState: NpcState): Instruction[][] {
    const vars = this.buildVars(goal, npcState);
    const seq = this.actionLib.getInstructions(goal.动作id, vars);
    if (seq.length > 0) return [seq];

    return [];
  }

  // ──── 默认 ────
  private planDefault(_goal: Goal, npcState: NpcState): Instruction[][] {
    return [[
      { module: "move_in_area", params: { center: [npcState.x, npcState.y], radius: 5 } },
    ]];
  }
}

export interface NpcState {
  x: number;
  y: number;
  性格: Record<string, number>;
  生理状态: Record<string, number>;
  物品栏: Array<{ 名称: string; 类型: string; 数量: number }> | null;
  家坐标?: [number, number];
  知识库?: {
    已知地点?: Record<string, any>;
    已知人物?: Record<string, string>;
  };
  记忆标签: string[];
  金钱: number;
  当前动作?: string;
  环境?: {
    天气: string;
    是否在室内: boolean;
  };
}
