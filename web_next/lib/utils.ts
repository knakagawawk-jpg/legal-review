import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 年度（整数）を日本の元号形式に変換
 * @param yearInt 年度（整数、例: 2025, 2018）
 * @returns 元号形式の年度文字列（例: "令和7年", "平成30年"）
 */
export function formatYearToEra(yearInt: number): string {
  if (yearInt >= 2019) {
    // 令和: 2019年 = 令和1年, 2025年 = 令和7年
    const reiwaYear = yearInt - 2018
    return `令和${reiwaYear}年`
  } else if (yearInt >= 1989) {
    // 平成: 1989年 = 平成1年, 2018年 = 平成30年
    const heiseiYear = yearInt - 1988
    return `平成${heiseiYear}年`
  } else if (yearInt >= 1926) {
    // 昭和: 1926年 = 昭和1年, 1988年 = 昭和63年
    const showaYear = yearInt - 1925
    return `昭和${showaYear}年`
  } else {
    // それ以前は西暦で表示
    return `${yearInt}年`
  }
}
