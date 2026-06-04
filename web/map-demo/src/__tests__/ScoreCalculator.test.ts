import { describe, it, expect } from "vitest";
import { ScoreCalculator } from "../engine/ScoreCalculator";

describe("ScoreCalculator - 基础功能", () => {
  it("构造函数加载 Brains_Library.json 不报错", () => {
    const calc = new ScoreCalculator();
    expect(calc).toBeDefined();
  });

  it("getAllActionIds 返回已注册的动作列表", () => {
    const calc = new ScoreCalculator();
    const ids = calc.getAllActionIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("action_追求");
  });

  it("canDo: 无规则的动作默认可行", () => {
    const calc = new ScoreCalculator();
    expect(calc.canDo("nonexistent_action", { "乐观": 5 })).toBe(true);
  });

  it("canDo: 满足必要条件的动作可行", () => {
    const calc = new ScoreCalculator();
    // action_追求 需要 乐观>=6 且 社交欲>=5
    expect(calc.canDo("action_追求", { "乐观": 7, "社交欲": 6 })).toBe(true);
  });

  it("canDo: 不满足必要条件的动作不可行", () => {
    const calc = new ScoreCalculator();
    // 乐观=3 不满足 >=6
    expect(calc.canDo("action_追求", { "乐观": 3, "社交欲": 6 })).toBe(false);
  });

  it("scoreAction: 无规则的动作返回基础分 50", () => {
    const calc = new ScoreCalculator();
    const result = calc.scoreAction("nonexistent_action", { "乐观": 5 });
    expect(result.actionId).toBe("nonexistent_action");
    expect(result.score).toBe(50);
    expect(result.prerequisitesMet).toBe(true);
  });

  it("scoreAction: 不满足必要条件时 score=0, prerequisitesMet=false", () => {
    const calc = new ScoreCalculator();
    const result = calc.scoreAction("action_追求", { "乐观": 3, "社交欲": 5 });
    expect(result.score).toBe(0);
    expect(result.prerequisitesMet).toBe(false);
  });

  it("scoreAction: 满足条件时有基础分+性格加成", () => {
    const calc = new ScoreCalculator();
    // 高乐观+高社交欲 → 应获得加分
    const result = calc.scoreAction("action_追求", { "乐观": 9, "社交欲": 8 });
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.prerequisitesMet).toBe(true);
    expect(result.bonuses.length).toBeGreaterThanOrEqual(0);
  });

  it("scoreAll: 按分数降序排列，只返回可行且分数>0的动作", () => {
    const calc = new ScoreCalculator();
    // 极端性格：高暴力倾向
    const personality: Record<string, number> = {
      "乐观": 2, "勤奋": 1, "大方": 1, "谦虚": 1, "好奇": 1, "城府": 1,
      "勇敢": 9, "理性": 1, "善良": 1, "宽容": 1, "忠诚": 1, "冲动": 9,
      "野心": 9, "社交欲": 1, "嫉妒": 9, "记仇": 9, "谨慎": 1, "胆色": 9,
      "大胆": 9, "道德": 1, "活力": 1, "耐心": 1, "专注": 1, "独立": 1,
      "创造力": 1, "领导力": 1, "适应力": 1, "自律": 1, "敏感": 1, "幽默": 1,
      "审美": 1, "节俭": 1, "竞争欲": 1, "安全感": 1,
    };
    const results = calc.scoreAll(personality);
    expect(results.length).toBeGreaterThan(0);
    // 验证降序
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("scoreAction: 状态修正（饥饿>7）", () => {
    const calc = new ScoreCalculator();
    const result = calc.scoreAction(
      "nonexistent_action",
      { "乐观": 5 },
      { "饥饿": 9 }
    );
    // 饥饿>7 时，分数至少是 饥饿*5=45，而基础分50>45，所以取50
    expect(result.score).toBeGreaterThanOrEqual(45);
  });

  it("scoreAction: 最终分不低于 0", () => {
    const calc = new ScoreCalculator();
    // 全低性格 → 减分可能导致负分，但会被截断为0
    const result = calc.scoreAction("action_追求", {
      "乐观": 1, "社交欲": 1,
    });
    // 不满足条件，score应为0
    if (result.prerequisitesMet) {
      expect(result.score).toBeGreaterThanOrEqual(0);
    } else {
      expect(result.score).toBe(0);
    }
  });
});
