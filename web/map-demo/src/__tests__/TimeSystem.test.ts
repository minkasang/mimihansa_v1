import { describe, it, expect } from "vitest";
import {
  TIME_CONFIG,
  tickToWorldTime,
  ticksToDays,
  daysToTicks,
  isDaytime,
  isNighttime,
  getSeason,
  advanceTime,
  formatTime,
  isSameDay,
  daysBetween,
  createInitialTime,
} from "../engine/TimeSystem";

describe("TimeSystem - 核心常量", () => {
  it("TICKS_PER_DAY 应为 86400", () => {
    expect(TIME_CONFIG.TICKS_PER_DAY).toBe(86400);
  });

  it("TICKS_PER_HOUR 应为 3600", () => {
    expect(TIME_CONFIG.TICKS_PER_HOUR).toBe(3600);
  });

  it("DAY_START_HOUR=6, DAY_END_HOUR=18", () => {
    expect(TIME_CONFIG.DAY_START_HOUR).toBe(6);
    expect(TIME_CONFIG.DAY_END_HOUR).toBe(18);
  });
});

describe("TimeSystem - 86400 Tick = 第2天", () => {
  it("0 Tick → 第1天", () => {
    const t = tickToWorldTime(0);
    expect(t.当前日).toBe(1);
    expect(t.当前月).toBe(1);
    expect(t.当前年).toBe(1);
    expect(t.当前小时).toBe(0);
  });

  it("86400 Tick → 第2天", () => {
    const t = tickToWorldTime(86400);
    expect(t.当前日).toBe(2);
    expect(t.当前月).toBe(1);
    expect(t.当前年).toBe(1);
  });

  it("86400 * 30 Tick → 第1天（次月）", () => {
    const t = tickToWorldTime(86400 * 30);
    expect(t.当前月).toBe(2);
    expect(t.当前日).toBe(1);
  });

  it("ticksToDays(86400) = 1", () => {
    expect(ticksToDays(86400)).toBe(1);
  });

  it("daysToTicks(1) = 86400", () => {
    expect(daysToTicks(1)).toBe(86400);
  });
});

describe("TimeSystem - 白天/黑夜切换", () => {
  it("6点~17点是白天", () => {
    expect(isDaytime(6)).toBe(true);
    expect(isDaytime(12)).toBe(true);
    expect(isDaytime(17)).toBe(true);
  });

  it("18点~5点是黑夜", () => {
    expect(isDaytime(18)).toBe(false);
    expect(isDaytime(0)).toBe(false);
    expect(isDaytime(5)).toBe(false);
  });

  it("isNighttime 与 isDaytime 互斥", () => {
    for (let h = 0; h < 24; h++) {
      expect(isNighttime(h)).toBe(!isDaytime(h));
    }
  });

  it("tickToWorldTime 中 是否白天 与小时对应", () => {
    // 8:00 = 第1天8小时 = 8*3600=28800 Tick
    const morning = tickToWorldTime(28800);
    expect(morning.是否白天).toBe(true);
    expect(morning.当前小时).toBe(8);

    // 22:00 = 第1天22小时 = 22*3600=79200 Tick
    const night = tickToWorldTime(79200);
    expect(night.是否白天).toBe(false);
    expect(night.当前小时).toBe(22);
  });
});

describe("TimeSystem - 季节判定", () => {
  it("1-3月=春, 4-6=夏, 7-9=秋, 10-12=冬", () => {
    expect(getSeason(1)).toBe("春");
    expect(getSeason(3)).toBe("春");
    expect(getSeason(4)).toBe("夏");
    expect(getSeason(6)).toBe("夏");
    expect(getSeason(7)).toBe("秋");
    expect(getSeason(9)).toBe("秋");
    expect(getSeason(10)).toBe("冬");
    expect(getSeason(12)).toBe("冬");
  });
});

describe("TimeSystem - 时间推进", () => {
  it("advanceTime 推进 3600 Tick → 小时+1", () => {
    const initial = tickToWorldTime(0);
    const advanced = advanceTime(initial, 3600);
    expect(advanced.当前Tick).toBe(3600);
    expect(advanced.当前小时).toBe(1);
    expect(advanced.当前日).toBe(1);
  });

  it("advanceTime 推进 86400 Tick → 天数+1", () => {
    const initial = tickToWorldTime(0);
    const advanced = advanceTime(initial, 86400);
    expect(advanced.当前日).toBe(2);
  });
});

describe("TimeSystem - 工具函数", () => {
  it("isSameDay: 同一天返回 true", () => {
    const t1 = tickToWorldTime(3600);  // 1:00
    const t2 = tickToWorldTime(7200);  // 2:00
    expect(isSameDay(t1, t2)).toBe(true);

    const t3 = tickToWorldTime(86400); // 第2天
    expect(isSameDay(t1, t3)).toBe(false);
  });

  it("daysBetween: 计算间隔天数", () => {
    const t1 = tickToWorldTime(0);
    const t2 = tickToWorldTime(86400);
    expect(daysBetween(t1, t2)).toBe(1);
  });

  it("formatTime: 格式化显示", () => {
    const t = createInitialTime();
    expect(formatTime(t)).toContain("年");
    expect(formatTime(t)).toContain("月");
    expect(formatTime(t)).toContain("日");
  });

  it("createInitialTime: 第1年3月春季早上", () => {
    const t = createInitialTime();
    expect(t.当前年).toBe(1);
    expect(t.当前月).toBe(3);
    expect(t.当前季节).toBe("春");
    expect(t.是否白天).toBe(true);
  });
});
