/**
 * 📋 动作定义库 - 加载 Actions_Library.json
 * 每个动作 = 一条指令模块组合序列，像乐高积木一样自由组合
 *
 * 支持参数变量替换: $家坐标, $目标位置, $目标NPC, $工作地点 等
 */

import type { Instruction } from "./GOAPPlanner";
import actionsRaw from "../../../../data/libraries/Actions_Library.json";

export interface ActionDef {
  id: string;
  名称: string;
  描述: string;
  触发性格倾向?: Record<string, [string, number]>;
  指令序列: Array<{ module: string; params: Record<string, any> }>;
  效果?: Record<string, string>;
  可被打断: boolean;
  所需物品?: { 标签: string[]; 数量: number };
  所需条件?: Record<string, [string, number]>;
}

export class ActionLibrary {
  private actions: Map<string, ActionDef> = new Map();

  constructor() {
    const lib = actionsRaw as any;
    const defs = lib.动作定义 as any[];
    for (const def of defs) {
      this.actions.set(def.动作id, {
        id: def.动作id,
        名称: def.名称 || "",
        描述: def.描述 || "",
        触发性格倾向: def.触发性格倾向,
        指令序列: def.指令序列 || [],
        效果: def.效果,
        可被打断: def.可被打断 ?? true,
        所需物品: def.所需物品,
        所需条件: def.所需条件,
      });
    }
  }

  getAction(actionId: string): ActionDef | undefined {
    return this.actions.get(actionId);
  }

  /**
   * 获取动作的指令序列，替换模板变量
   */
  getInstructions(actionId: string, variables: Record<string, any> = {}): Instruction[] {
    const action = this.actions.get(actionId);
    if (!action) return [];

    return action.指令序列.map(step => ({
      module: step.module,
      params: this.resolveVariables(step.params, variables),
    }));
  }

  /**
   * 获取所有已注册的动作id
   */
  getAllActionIds(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 替换参数中的模板变量：$家坐标, $目标位置, $目标NPC 等
   */
  private resolveVariables(params: Record<string, any>, vars: Record<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("$")) {
        const varName = value.slice(1);
        resolved[key] = vars[varName] !== undefined ? vars[varName] : value;
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /**
   * 根据目标类型查找匹配的动作id列表
   */
  findActionsByTargetType(targetType: string, personality: Record<string, number>): ActionDef[] {
    // 目标类型 → 动作id 映射
    const typeToAction: Record<string, string[]> = {
      "休息": ["action_sleep", "action_rest"],
      "吃东西": ["action_eat"],
      "休闲": ["action_sunbathe", "action_wander"],
      "社交": ["action_greet", "action_搭讪", "action_分享信息"],
      "送礼": ["action_送礼"],
      "工作": ["action_工作"],
      "购物": ["action_购物"],
    };

    const candidateIds = typeToAction[targetType] || [];
    const results: ActionDef[] = [];
    for (const id of candidateIds) {
      const action = this.actions.get(id);
      if (!action) continue;
      // 检查触发性格倾向
      if (action.触发性格倾向) {
        let met = true;
        for (const [trait, [op, threshold]] of Object.entries(action.触发性格倾向)) {
          const val = personality[trait];
          if (val === undefined) { met = false; break; }
          switch (op) {
            case ">": if (!(val > threshold)) met = false; break;
            case ">=": if (!(val >= threshold)) met = false; break;
            case "<": if (!(val < threshold)) met = false; break;
            case "<=": if (!(val <= threshold)) met = false; break;
            case "==": if (!(val === threshold)) met = false; break;
            default: met = false;
          }
          if (!met) break;
        }
        if (!met) continue;
      }
      results.push(action);
    }
    return results;
  }
}
