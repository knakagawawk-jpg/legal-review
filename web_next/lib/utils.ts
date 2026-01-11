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

/**
 * 年度（整数）を短縮元号形式に変換（H30、R6など）
 * @param yearInt 年度（整数、例: 2025, 2018）
 * @returns 短縮元号形式の年度文字列（例: "R7", "H30"）
 */
export function formatYearToShortEra(yearInt: number): string {
  if (yearInt >= 2019) {
    // 令和: 2019年 = R1, 2025年 = R7
    const reiwaYear = yearInt - 2018
    return `R${reiwaYear}`
  } else if (yearInt >= 1989) {
    // 平成: 1989年 = H1, 2018年 = H30
    const heiseiYear = yearInt - 1988
    return `H${heiseiYear}`
  } else if (yearInt >= 1926) {
    // 昭和: 1926年 = S1, 1988年 = S63
    const showaYear = yearInt - 1925
    return `S${showaYear}`
  } else {
    // それ以前は西暦で表示
    return `${yearInt}`
  }
}