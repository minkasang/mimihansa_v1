/**
 * 通用条件解析器 - 数据驱动的条件判断引擎
 *
 * 支持统一的条件格式，无需为每种条件写 if-else
 *
 * 格式规范：
 *   简单条件:  { "字段名": ["操作符", 值] }
 *     例: { "精力": ["<", 20] }           → 精力 < 20 ?
 *         { "天气": ["==", "暴雨"] }      → 天气 == "暴雨" ?
 *         { "乐观": [">=", 6] }           → 乐观 >= 6 ?
 *
 *   逻辑组合:  { "且": [条件1, 条件2] }    → 条件1 && 条件2
 *             { "或": [条件1, 条件2] }    → 条件1 || 条件2
 *             { "非": 条件 }              → !条件
 *
 *   概率:     { "概率": 0.3 }             → Math.random() < 0.3
 *
 *   嵌套:     任意深度嵌套，如:
 *             { "且": [
 *                 { "精力": ["<", 20] },
 *                 { "或": [
 *                     { "天气": ["==", "暴雨"] },
 *                     { "概率": 0.1 }
 *                 ]}
 *             ]}
 */

export interface Condition {
  [key: string]: any;
}

export class ConditionEvaluator {

  /**
   * 评估条件
   * @param condition 条件对象
   * @param context 运行时上下文（NPC状态、环境等）
   */
  evaluate(condition: Condition | null | undefined, context: Record<string, any>): boolean {
    if (!condition || Object.keys(condition).length === 0) {
      return true; // 空条件 = 总是满足
    }

    for (const [key, value] of Object.entries(condition)) {
      // 逻辑操作符
      if (key === "且" && Array.isArray(value)) {
        return value.every(c => this.evaluate(c, context));
      }
      if (key === "或" && Array.isArray(value)) {
        return value.some(c => this.evaluate(c, context));
      }
      if (key === "非") {
        return !this.evaluate(value, context);
      }

      // 概率
      if (key === "概率" && typeof value === "number") {
        return Math.random() < value;
      }

      // 简单条件: { "字段名": ["操作符", 值] }
      if (Array.isArray(value) && value.length === 2) {
        const [operator, targetValue] = value as [string, any];
        const actualValue = this.resolvePath(context, key);
        return this.compare(actualValue, operator, targetValue);
      }

      // 嵌套对象条件（递归）
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const subContext = this.resolvePath(context, key);
        if (typeof subContext === "object" && subContext !== null) {
          return this.evaluate(value, subContext);
        }
        return this.evaluate(value, context);
      }
    }

    return false;
  }

  /**
   * 从上下文对象中按路径取值
   * 支持 "personality.乐观" 这样的点号路径
   */
  private resolvePath(context: Record<string, any>, path: string): any {
    const parts = path.split(".");
    let current: any = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * 比较两个值
   */
  private compare(actual: any, operator: string, expected: any): boolean {
    if (actual === undefined || actual === null) return false;

    switch (operator) {
      case "==": return actual == expected;
      case "!=": return actual != expected;
      case ">":  return Number(actual) > Number(expected);
      case ">=": return Number(actual) >= Number(expected);
      case "<":  return Number(actual) < Number(expected);
      case "<=": return Number(actual) <= Number(expected);
      case "包含": return typeof actual === "string" && actual.includes(String(expected));
      case "不包含": return typeof actual === "string" && !actual.includes(String(expected));
      default: return false;
    }
  }
}
