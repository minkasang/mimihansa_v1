/**
 * 🧮 性格效用打分计算器
 * 加载 Brains_Library.json，根据 NPC 的 34 维性格为每个动作计算效用分
 *
 * 公式：基础分 + 性格加成 - 性格减分 + 状态修正 + 目标加成
 *
 * 如果必要条件不满足 → 得分 = 0（此人不会做这个动作）
 */

import brainsRaw from "../../../../data/libraries/Brains_Library.json";

interface ScoreRule {
  必要条件?: Record<string, string>;
  加分项?: Record<string, string>;
  减分项?: Record<string, string>;
  触发条件?: Record<string, string>;
  抑制条件?: Record<string, string>;
  所有人都会?: boolean;
}

interface BrainsLibrary {
  动作性格要求?: Record<string, ScoreRule>;
}

interface ParsedScoreItem {
  trait: string;
  operator: string;
  threshold: number;
}

interface ParsedBonus extends ParsedScoreItem {
  score: number;
}

export interface ActionScoreResult {
  actionId: string;
  score: number;
  prerequisitesMet: boolean;
  bonuses: string[];
  penalties: string[];
}

export class ScoreCalculator {
  private rules: Record<string, ScoreRule> = {};

  constructor() {
    const lib = brainsRaw as BrainsLibrary;
    if (lib.动作性格要求) {
      this.rules = lib.动作性格要求;
    }
  }

  /**
   * 检查某动作对该 NPC 是否可行（必要条件是否满足）
   */
  canDo(actionId: string, personality: Record<string, number>): boolean {
    const rule = this.rules[actionId];
    if (!rule) return true;
    if (rule.所有人都会) return true;

    const conditions = rule.必要条件 || rule.触发条件;
    if (!conditions || Object.keys(conditions).length === 0) return true;

    return this.checkConditions(conditions, personality);
  }

  /**
   * 对单个动作打分
   */
  scoreAction(actionId: string, personality: Record<string, number>, stateContext?: Record<string, number>): ActionScoreResult {
    const result: ActionScoreResult = {
      actionId,
      score: 0,
      prerequisitesMet: true,
      bonuses: [],
      penalties: [],
    };

    const rule = this.rules[actionId];
    if (!rule) {
      result.score = 50;
      return result;
    }

    // 1) 检查必要条件 / 触发条件
    const conditions = rule.必要条件 || rule.触发条件;
    if (conditions && !this.checkConditions(conditions, personality)) {
      result.prerequisitesMet = false;
      result.score = 0;
      return result;
    }

    // 2) 检查抑制条件（如有则直接归零）
    if (rule.抑制条件 && this.checkConditions(rule.抑制条件, personality)) {
      result.prerequisitesMet = false;
      result.score = 0;
      return result;
    }

    // 3) 基础分
    let score = 50;

    // 4) 性格加分项
    if (rule.加分项) {
      for (const [trait, desc] of Object.entries(rule.加分项)) {
        const parsed = this.parseBonusDesc(desc);
        if (!parsed) continue;
        const val = personality[trait];
        if (val === undefined) continue;
        if (this.compare(val, parsed.operator, parsed.threshold)) {
          score += parsed.score;
          result.bonuses.push(`${trait}(${val}${parsed.operator}${parsed.threshold},+${parsed.score})`);
        }
      }
    }

    // 5) 性格减分项
    if (rule.减分项) {
      for (const [trait, desc] of Object.entries(rule.减分项)) {
        const parsed = this.parseBonusDesc(desc);
        if (!parsed) continue;
        const val = personality[trait];
        if (val === undefined) continue;
        if (this.compare(val, parsed.operator, parsed.threshold)) {
          score -= parsed.score;
          result.penalties.push(`${trait}(${val}${parsed.operator}${parsed.threshold},-${parsed.score})`);
        }
      }
    }

    // 6) 状态修正（如有）
    if (stateContext) {
      if (stateContext.饥饿 !== undefined && stateContext.饥饿 > 7) score = Math.max(score, stateContext.饥饿 * 5);
      if (stateContext.疲劳 !== undefined && stateContext.疲劳 > 7) score = Math.max(score, stateContext.疲劳 * 5);
    }

    result.score = Math.max(0, score);
    return result;
  }

  /**
   * 批量打分：同一动作id对同一性格只算一次
   */
  scoreAll(personality: Record<string, number>, stateContext?: Record<string, number>): ActionScoreResult[] {
    const results: ActionScoreResult[] = [];
    for (const actionId of Object.keys(this.rules)) {
      const r = this.scoreAction(actionId, personality, stateContext);
      if (r.prerequisitesMet && r.score > 0) {
        results.push(r);
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  private checkConditions(conditions: Record<string, string>, personality: Record<string, number>): boolean {
    for (const [trait, desc] of Object.entries(conditions)) {
      if (desc.includes("不存在")) continue;
      const parsed = this.parseCondition(trait, desc);
      if (!parsed) continue;

      let val = personality[trait];
      if (val === undefined && (personality as any).欲望) {
        val = (personality as any).欲望[trait];
      }
      if (val === undefined) return false;

      if (!this.compare(val, parsed.operator, parsed.threshold)) {
        return false;
      }
    }
    return true;
  }

  private parseCondition(trait: string, desc: string): ParsedScoreItem | null {
    const m = desc.match(/^(>=|<=|>|<|==|!=)\s*(\d+(?:\.\d+)?)$/);
    if (!m) {
      if (desc === "不存在此维度") return null;
      // 兜底：把整个 desc 当数值直接比较
      const num = Number(desc);
      if (!isNaN(num)) return { trait, operator: ">=", threshold: num };
      return null;
    }
    return { trait, operator: m[1], threshold: Number(m[2]) };
  }

  private parseBonusDesc(desc: string): ParsedBonus | null {
    const m = desc.match(/^(>=|<=|>|<|==|!=)\s*(\d+(?:\.\d+)?)\s*[加减]\s*(\d+)\s*分$/);
    if (!m) {
      if (desc === "不存在此维度" || desc.includes("不存在")) return null;
      return null;
    }
    return {
      trait: "",
      operator: m[1],
      threshold: Number(m[2]),
      score: Number(m[3]),
    };
  }

  private compare(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case ">=": return actual >= expected;
      case ">":  return actual > expected;
      case "<=": return actual <= expected;
      case "<":  return actual < expected;
      case "==": return actual === expected;
      case "!=": return actual !== expected;
      default:   return false;
    }
  }

  /**
   * 获取所有已注册的动作id
   */
  getAllActionIds(): string[] {
    return Object.keys(this.rules);
  }
}
