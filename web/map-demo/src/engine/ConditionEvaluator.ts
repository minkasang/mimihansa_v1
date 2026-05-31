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
 *
 * v1.1 新增操作符（支持所有文档中的条件类型）：
 *   "有标签" / "无标签"     → 检查NPC标签数组
 *   "物品栏有"              → 检查物品栏包含某物品
 *   "物品栏有标签"          → 检查物品栏包含某标签的物品
 *   "路径距离<"             → 需要外部提供路径计算结果
 *   "季节是"                → 检查当前季节
 *   "是白天" / "是黑夜"     → 检查白天/黑夜
 *   "知识库有"              → 检查知识库包含某类型知识
 *   "附近有"                → 检查感知范围内有某类型实体
 *   "是亲属"                → 检查与目标NPC的亲属关系
 *   "随机<"                 → 随机概率判断
 *   "为空" / "不为空"       → null/undefined判断
 */

export interface Condition {
  [key: string]: any;
}

/** 条件评估所需的扩展上下文 */
export interface ExtendedContext extends Record<string, any> {
  // 路径距离查询（由外部注入）
  _pathDistance?: (from: [number, number], to: [number, number]) => number | null;
  // 当前世界时间（由外部注入）
  _worldTime?: {
    当前季节: string;
    是否白天: boolean;
    当前小时: number;
  };
  // 感知结果（由外部注入）
  _perception?: {
    visual: Array<{ id: string; 类型?: string }>;
    auditory: Array<{ id: string; 类型?: string }>;
  };
  // 目标NPC ID（用于关系判断）
  _targetNpcId?: string;
}

export class ConditionEvaluator {

  /**
   * 评估条件
   * @param condition 条件对象
   * @param context 运行时上下文（NPC状态、环境等）
   */
  evaluate(condition: Condition | null | undefined, context: ExtendedContext): boolean {
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

      // 简单条件: { "字段名": ["操作符", 值] } 或 { "字段名": ["单操作符"] }
      if (Array.isArray(value)) {
        const [operator, targetValue] = value as [string, any?];
        const actualValue = this.resolvePath(context, key);
        return this.compare(actualValue, operator, targetValue, context);
      }

      // 特殊key条件: { "是白天": true }, { "是黑夜": true }, { "附近有": "火堆" }
      if (typeof key === "string") {
        if (key === "是白天") {
          const worldTime = context._worldTime;
          return worldTime !== undefined && worldTime.是否白天 === true;
        }
        if (key === "是黑夜") {
          const worldTime = context._worldTime;
          return worldTime !== undefined && worldTime.是否白天 === false;
        }
        if (key === "附近有" && typeof value === "string") {
          const perception = context._perception;
          if (!perception) return false;
          const all = [...(perception.visual || []), ...(perception.auditory || [])];
          return all.some((p: any) => p.类型 === value || p.id === value);
        }
        if (key === "季节是" && typeof value === "string") {
          const worldTime = context._worldTime;
          return worldTime !== undefined && worldTime.当前季节 === value;
        }
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
   * 比较两个值（v1.1 扩展了12个新操作符）
   */
  private compare(actual: any, operator: string, expected: any, context: ExtendedContext): boolean {
    // 基础操作符
    switch (operator) {
      case "==": return actual == expected;
      case "!=": return actual != expected;
      case ">":  return Number(actual) > Number(expected);
      case ">=": return Number(actual) >= Number(expected);
      case "<":  return Number(actual) < Number(expected);
      case "<=": return Number(actual) <= Number(expected);
      case "包含": return typeof actual === "string" && actual.includes(String(expected));
      case "不包含": return typeof actual === "string" && !actual.includes(String(expected));
    }

    // === v1.1 新增操作符 ===

    // 标签操作符
    if (operator === "有标签") {
      return Array.isArray(actual) && actual.includes(expected);
    }
    if (operator === "无标签") {
      return Array.isArray(actual) && !actual.includes(expected);
    }

    // 空值判断（单操作符，不需要expected值）
    if (operator === "为空") {
      return actual === null || actual === undefined ||
             (Array.isArray(actual) && actual.length === 0) ||
             (typeof actual === "string" && actual === "");
    }
    if (operator === "不为空") {
      return actual !== null && actual !== undefined &&
             (!Array.isArray(actual) || actual.length > 0) &&
             (typeof actual !== "string" || actual !== "");
    }

    // 物品栏操作符
    if (operator === "物品栏有") {
      if (!Array.isArray(actual)) return false;
      return actual.some((item: any) =>
        item.物品id === expected || item.名称 === expected
      );
    }
    if (operator === "物品栏有标签") {
      if (!Array.isArray(actual)) return false;
      return actual.some((item: any) =>
        Array.isArray(item.标签) && item.标签.includes(expected)
      );
    }
    if (operator === "物品栏无标签") {
      if (!Array.isArray(actual)) return true;
      return !actual.some((item: any) =>
        Array.isArray(item.标签) && item.标签.includes(expected)
      );
    }

    // 时间操作符（数组格式：{ "World.时间": ["季节是", "秋"] }）
    if (operator === "季节是") {
      const worldTime = context._worldTime;
      return worldTime !== undefined && worldTime.当前季节 === expected;
    }
    if (operator === "是白天") {
      const worldTime = context._worldTime;
      return worldTime !== undefined && worldTime.是否白天 === true;
    }
    if (operator === "是黑夜") {
      const worldTime = context._worldTime;
      return worldTime !== undefined && worldTime.是否白天 === false;
    }

    // 知识库操作符
    if (operator === "知识库有") {
      if (!Array.isArray(actual)) return false;
      return actual.some((k: any) => k.类型 === expected || k.内容?.includes(expected));
    }

    // 感知操作符
    if (operator === "附近有") {
      const perception = context._perception;
      if (!perception) return false;
      const all = [...(perception.visual || []), ...(perception.auditory || [])];
      return all.some((p: any) => p.类型 === expected || p.id === expected);
    }

    // 关系操作符
    if (operator === "是亲属") {
      // actual 应该是社会关系对象，expected 是目标NPC ID
      if (typeof actual !== "object" || actual === null) return false;
      const relations = actual;
      const targetId = context._targetNpcId || expected;
      return relations.配偶ID === targetId ||
             (Array.isArray(relations.父母ID) && relations.父母ID.includes(targetId)) ||
             (Array.isArray(relations.子女ID) && relations.子女ID.includes(targetId));
    }

    // 随机操作符
    if (operator === "随机<") {
      return Math.random() < Number(expected);
    }

    // 路径距离（需要外部注入 _pathDistance）
    if (operator === "路径距离<") {
      const pathDistance = context._pathDistance;
      if (!pathDistance || !actual || !expected) return false;
      // actual 应该是 [fromX, fromY, toX, toY] 或需要解析
      // 简化处理：假设 actual 已经是距离值（由外部预计算）
      return typeof actual === "number" && actual < Number(expected);
    }

    return false;
  }
}
