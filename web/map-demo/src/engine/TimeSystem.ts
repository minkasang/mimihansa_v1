/**
 * 时间系统 - 统一时间转换层 + 季节系统
 * 与 docs/005_愿景与设计/ 各系统文档对齐
 *
 * 时间配置：
 *   1 Tick = 1 秒（游戏时间）
 *   1 天 = 86400 Tick = 24 小时
 *   1 月 = 30 天
 *   1 季节 = 3 月
 *   1 年 = 4 季节 = 12 月
 *
 * 白天判定：6:00 - 18:00
 * 季节判定：
 *   春：1-3月
 *   夏：4-6月
 *   秋：7-9月
 *   冬：10-12月
 */

import type { Season } from "../types/npcTypes";
import type { WorldTime } from "../types/worldTypes";

// ========== 时间常量 ==========

export const TIME_CONFIG = {
  TICKS_PER_SECOND: 1,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_MONTH: 30,
  MONTHS_PER_SEASON: 3,
  SEASONS_PER_YEAR: 4,

  // 派生常量
  get TICKS_PER_MINUTE() { return this.TICKS_PER_SECOND * this.SECONDS_PER_MINUTE; },
  get TICKS_PER_HOUR() { return this.TICKS_PER_MINUTE * this.MINUTES_PER_HOUR; },
  get TICKS_PER_DAY() { return this.TICKS_PER_HOUR * this.HOURS_PER_DAY; },
  get TICKS_PER_MONTH() { return this.TICKS_PER_DAY * this.DAYS_PER_MONTH; },
  get TICKS_PER_SEASON() { return this.TICKS_PER_MONTH * this.MONTHS_PER_SEASON; },
  get TICKS_PER_YEAR() { return this.TICKS_PER_SEASON * this.SEASONS_PER_YEAR; },

  // 白天判定
  DAY_START_HOUR: 6,
  DAY_END_HOUR: 18,
} as const;

// ========== 时间转换函数 ==========

export function ticksToSeconds(ticks: number): number {
  return ticks * TIME_CONFIG.TICKS_PER_SECOND;
}

export function ticksToMinutes(ticks: number): number {
  return ticks / TIME_CONFIG.TICKS_PER_MINUTE;
}

export function ticksToHours(ticks: number): number {
  return ticks / TIME_CONFIG.TICKS_PER_HOUR;
}

export function ticksToDays(ticks: number): number {
  return ticks / TIME_CONFIG.TICKS_PER_DAY;
}

export function ticksToMonths(ticks: number): number {
  return ticks / TIME_CONFIG.TICKS_PER_MONTH;
}

export function ticksToYears(ticks: number): number {
  return ticks / TIME_CONFIG.TICKS_PER_YEAR;
}

export function daysToTicks(days: number): number {
  return days * TIME_CONFIG.TICKS_PER_DAY;
}

export function hoursToTicks(hours: number): number {
  return hours * TIME_CONFIG.TICKS_PER_HOUR;
}

export function monthsToTicks(months: number): number {
  return months * TIME_CONFIG.TICKS_PER_MONTH;
}

// ========== 季节/时间判定 ==========

export function getSeason(month: number): Season {
  if (month >= 1 && month <= 3) return "春";
  if (month >= 4 && month <= 6) return "夏";
  if (month >= 7 && month <= 9) return "秋";
  return "冬";
}

export function isDaytime(hour: number): boolean {
  return hour >= TIME_CONFIG.DAY_START_HOUR && hour < TIME_CONFIG.DAY_END_HOUR;
}

export function isNighttime(hour: number): boolean {
  return !isDaytime(hour);
}

// ========== WorldTime 推进 ==========

export function advanceTime(time: WorldTime, ticks: number): WorldTime {
  let totalTicks = time.当前Tick + ticks;

  const newTime = tickToWorldTime(totalTicks);
  return newTime;
}

/**
 * 将全局Tick数转换为WorldTime结构
 */
export function tickToWorldTime(totalTicks: number): WorldTime {
  const ticksPerYear = TIME_CONFIG.TICKS_PER_YEAR;
  const ticksPerMonth = TIME_CONFIG.TICKS_PER_MONTH;
  const ticksPerDay = TIME_CONFIG.TICKS_PER_DAY;
  const ticksPerHour = TIME_CONFIG.TICKS_PER_HOUR;
  const ticksPerMinute = TIME_CONFIG.TICKS_PER_MINUTE;

  const year = Math.floor(totalTicks / ticksPerYear) + 1;
  let remaining = totalTicks % ticksPerYear;

  const month = Math.floor(remaining / ticksPerMonth) + 1;
  remaining = remaining % ticksPerMonth;

  const day = Math.floor(remaining / ticksPerDay) + 1;
  remaining = remaining % ticksPerDay;

  const hour = Math.floor(remaining / ticksPerHour);
  remaining = remaining % ticksPerHour;

  const minute = Math.floor(remaining / ticksPerMinute);
  remaining = remaining % ticksPerMinute;

  const second = remaining;

  return {
    当前Tick: totalTicks,
    当前秒: second,
    当前分钟: minute,
    当前小时: hour,
    当前日: day,
    当前月: month,
    当前年: year,
    当前季节: getSeason(month),
    是否白天: isDaytime(hour),
  };
}

// ========== 时间格式化（用于显示） ==========

export function formatTime(time: WorldTime): string {
  return `${time.当前年}年${time.当前月}月${time.当前日}日 ${String(time.当前小时).padStart(2, "0")}:${String(time.当前分钟).padStart(2, "0")}`;
}

export function formatSeason(time: WorldTime): string {
  return `${time.当前季节}季 · ${time.是否白天 ? "白天" : "黑夜"}`;
}

// ========== 时间比较工具 ==========

export function isSameDay(time1: WorldTime, time2: WorldTime): boolean {
  return time1.当前年 === time2.当前年 &&
         time1.当前月 === time2.当前月 &&
         time1.当前日 === time2.当前日;
}

export function isSameMonth(time1: WorldTime, time2: WorldTime): boolean {
  return time1.当前年 === time2.当前年 && time1.当前月 === time2.当前月;
}

export function daysBetween(time1: WorldTime, time2: WorldTime): number {
  const ticks1 = time1.当前Tick;
  const ticks2 = time2.当前Tick;
  return Math.abs(ticks2 - ticks1) / TIME_CONFIG.TICKS_PER_DAY;
}

// ========== 初始时间 ==========

export function createInitialTime(): WorldTime {
  // 初始时间：第1年3月1日 8:00:00（春季早上8点）
  // Tick = 2个月(1月+2月) + 7天(前7天) + 8小时
  const initialTicks =
    2 * TIME_CONFIG.TICKS_PER_MONTH +   // 1月+2月
    7 * TIME_CONFIG.TICKS_PER_DAY +     // 前7天（第1天到第8天）
    8 * TIME_CONFIG.TICKS_PER_HOUR;     // 8小时
  return tickToWorldTime(initialTicks);
}
