import { describe, it, expect } from "vitest";
import { ConditionEvaluator } from "../engine/ConditionEvaluator";

const evaluator = new ConditionEvaluator();

function ctx(data: Record<string, any>) {
  return data as any;
}

describe("ConditionEvaluator - 基础比较操作符", () => {
  it('> : 值大于阈值返回 true', () => {
    expect(evaluator.evaluate({ "精力": [">", 20] }, ctx({ "精力": 30 }))).toBe(true);
    expect(evaluator.evaluate({ "精力": [">", 20] }, ctx({ "精力": 10 }))).toBe(false);
  });

  it('< : 值小于阈值返回 true', () => {
    expect(evaluator.evaluate({ "疲劳": ["<", 50] }, ctx({ "疲劳": 30 }))).toBe(true);
    expect(evaluator.evaluate({ "疲劳": ["<", 50] }, ctx({ "疲劳": 60 }))).toBe(false);
  });

  it('== : 值等于预期返回 true', () => {
    expect(evaluator.evaluate({ "天气": ["==", "暴雨"] }, ctx({ "天气": "暴雨" }))).toBe(true);
    expect(evaluator.evaluate({ "天气": ["==", "晴天"] }, ctx({ "天气": "暴雨" }))).toBe(false);
  });

  it('>= : 大于等于返回 true', () => {
    expect(evaluator.evaluate({ "乐观": [">=", 6] }, ctx({ "乐观": 6 }))).toBe(true);
    expect(evaluator.evaluate({ "乐观": [">=", 6] }, ctx({ "乐观": 8 }))).toBe(true);
    expect(evaluator.evaluate({ "乐观": [">=", 6] }, ctx({ "乐观": 5 }))).toBe(false);
  });

  it('<= : 小于等于返回 true', () => {
    expect(evaluator.evaluate({ "饥饿": ["<=", 5] }, ctx({ "饥饿": 5 }))).toBe(true);
    expect(evaluator.evaluate({ "饥饿": ["<=", 5] }, ctx({ "饥饿": 3 }))).toBe(true);
    expect(evaluator.evaluate({ "饥饿": ["<=", 5] }, ctx({ "饥饿": 8 }))).toBe(false);
  });
});

describe("ConditionEvaluator - 逻辑组合", () => {
  it("且 : 所有子条件都满足才返回 true", () => {
    const condition = {
      "且": [
        { "精力": [">", 20] },
        { "疲劳": ["<", 50] },
      ],
    };
    expect(evaluator.evaluate(condition, ctx({ "精力": 30, "疲劳": 30 }))).toBe(true);
    expect(evaluator.evaluate(condition, ctx({ "精力": 10, "疲劳": 30 }))).toBe(false);
  });

  it("或 : 任一子条件满足即返回 true", () => {
    const condition = {
      "或": [
        { "天气": ["==", "暴雨"] },
        { "精力": [">", 80] },
      ],
    };
    expect(evaluator.evaluate(condition, ctx({ "天气": "暴雨", "精力": 10 }))).toBe(true);
    expect(evaluator.evaluate(condition, ctx({ "天气": "晴天", "精力": 90 }))).toBe(true);
    expect(evaluator.evaluate(condition, ctx({ "天气": "晴天", "精力": 10 }))).toBe(false);
  });

  it("非 : 取反", () => {
    expect(evaluator.evaluate({ "非": { "天气": ["==", "暴雨"] } }, ctx({ "天气": "晴天" }))).toBe(true);
    expect(evaluator.evaluate({ "非": { "天气": ["==", "暴雨"] } }, ctx({ "天气": "暴雨" }))).toBe(false);
  });

  it("嵌套 且/或 : 支持任意深度嵌套", () => {
    const condition = {
      "且": [
        { "精力": [">", 20] },
        {
          "或": [
            { "天气": ["==", "暴雨"] },
            { "概率": 1.0 },
          ],
        },
      ],
    };
    expect(evaluator.evaluate(condition, ctx({ "精力": 30, "天气": "晴天" }))).toBe(true);
  });
});

describe("ConditionEvaluator - 特殊操作符", () => {
  it("有标签 : 标签数组中存在指定标签", () => {
    expect(evaluator.evaluate({ "标签": ["有标签", "婴儿"] }, ctx({ "标签": ["婴儿", "女性"] }))).toBe(true);
    expect(evaluator.evaluate({ "标签": ["有标签", "老人"] }, ctx({ "标签": ["婴儿", "女性"] }))).toBe(false);
  });

  it("无标签 : 标签数组中不存在指定标签", () => {
    expect(evaluator.evaluate({ "标签": ["无标签", "老人"] }, ctx({ "标签": ["婴儿"] }))).toBe(true);
    expect(evaluator.evaluate({ "标签": ["无标签", "婴儿"] }, ctx({ "标签": ["婴儿"] }))).toBe(false);
  });

  it("为空 : null/undefined/空数组/空字符串", () => {
    expect(evaluator.evaluate({ "值": ["为空"] }, ctx({ "值": null }))).toBe(true);
    expect(evaluator.evaluate({ "值": ["为空"] }, ctx({ "值": [] }))).toBe(true);
    expect(evaluator.evaluate({ "值": ["为空"] }, ctx({ "值": "hello" }))).toBe(false);
  });

  it("不为空 : 有值", () => {
    expect(evaluator.evaluate({ "值": ["不为空"] }, ctx({ "值": "hello" }))).toBe(true);
    expect(evaluator.evaluate({ "值": ["不为空"] }, ctx({ "值": null }))).toBe(false);
  });

  it("空条件始终返回 true", () => {
    expect(evaluator.evaluate(null, ctx({}))).toBe(true);
    expect(evaluator.evaluate(undefined, ctx({}))).toBe(true);
    expect(evaluator.evaluate({}, ctx({}))).toBe(true);
  });
});
