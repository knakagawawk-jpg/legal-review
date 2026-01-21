/**
 * JST（Asia/Tokyo）の「学習日」を 4:00 境界で扱うユーティリティ。
 *
 * - 00:00〜03:59(JST) は前日扱い（= 28時表記の「今日」）
 * - 04:00〜 は当日扱い
 */
type JstParts = {
  year: number
  month: number
  day: number
  hour: number
}

function getJstParts(date: Date = new Date()): JstParts {
  const dtf = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
  const parts = dtf.formatToParts(date)
  const byType: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") byType[p.type] = p.value
  }
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
  }
}

export function formatYmd(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0")
  const m = String(month).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDaysYmd(ymd: string, deltaDays: number): string {
  // JSTはDSTなし。日付のズレ回避のため JSTの正午固定で加算する。
  const base = new Date(`${ymd}T12:00:00+09:00`)
  base.setDate(base.getDate() + deltaDays)
  const p = getJstParts(base)
  return formatYmd(p.year, p.month, p.day)
}

export function getStudyDate(date: Date = new Date()): string {
  const p = getJstParts(date)
  const ymd = formatYmd(p.year, p.month, p.day)
  if (p.hour < 4) {
    return addDaysYmd(ymd, -1)
  }
  return ymd
}

export function getRecentStudyDates(count: number, baseDate: Date = new Date()): string[] {
  const base = getStudyDate(baseDate)
  return Array.from({ length: count }, (_, i) => addDaysYmd(base, -i))
}

