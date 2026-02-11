"use client"

import { useState, useEffect, useMemo } from "react"
import { Clock, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

// ============================================================================
// Types
// ============================================================================

interface DailyStats {
  date: string
  dayOfWeek: string
  totalSeconds: number
}

interface WeekStats {
  week: string
  label: string
  totalSeconds: number
}

interface MonthlyStats {
  month: string
  label: string
  totalSeconds: number
}

interface TimerDailyStats {
  study_date: string
  total_seconds: number
}

interface TimerWeekStats {
  total_seconds: number
  daily_stats: TimerDailyStats[]
}

interface TimerMonthStats {
  total_seconds: number
  week_stats: Array<{
    week: string
    total_seconds: number
  }>
}

interface TimerYearStats {
  total_seconds: number
  month_stats: Array<{
    month: string
    total_seconds: number
  }>
}

// ============================================================================
// Utility Functions
// ============================================================================

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}分`
  return `${hours}h${minutes > 0 ? minutes.toString().padStart(2, "0") + "m" : ""}`
}

const formatHoursShort = (seconds: number): string => {
  const hours = seconds / 3600
  if (hours >= 10) return `${Math.round(hours)}h`
  return `${hours.toFixed(1)}h`
}

const secondsToHours = (seconds: number): number => {
  return Math.round((seconds / 3600) * 10) / 10
}

const getDayOfWeek = (dateString: string): string => {
  const date = new Date(dateString)
  const days = ["日", "月", "火", "水", "木", "金", "土"]
  return days[date.getDay()]
}

// 週の開始日（月曜日）を取得
const getWeekStartDate = (): Date => {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // 月曜日を週の開始とする
  return new Date(today.setDate(diff))
}

// 過去7日間のデータを生成（月曜始まり）
const generateLast7Days = (weekStats: TimerWeekStats | null): DailyStats[] => {
  if (!weekStats?.daily_stats) {
    return []
  }

  const weekStart = getWeekStartDate()
  const result: DailyStats[] = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dateStr = date.toISOString().split("T")[0]
    
    const dayStat = weekStats.daily_stats.find(
      (d) => d.study_date === dateStr
    )

    result.push({
      date: dateStr,
      dayOfWeek: getDayOfWeek(dateStr),
      totalSeconds: dayStat?.total_seconds || 0,
    })
  }

  return result
}

// 今月の週別データを生成
const generateMonthlyWeeks = (monthStats: TimerMonthStats | null): WeekStats[] => {
  if (!monthStats?.week_stats) {
    return []
  }

  return monthStats.week_stats.map((week, index) => ({
    week: week.week,
    label: `第${index + 1}週`,
    totalSeconds: week.total_seconds,
  }))
}

// 過去12ヶ月のデータを生成
const generateYearlyData = (yearStats: TimerYearStats | null): MonthlyStats[] => {
  if (!yearStats?.month_stats) {
    return []
  }

  return yearStats.month_stats.map((month) => {
    const date = new Date(month.month + "-01")
    const monthLabel = `${date.getMonth() + 1}月`
    return {
      month: month.month,
      label: monthLabel,
      totalSeconds: month.total_seconds,
    }
  })
}

// ============================================================================
// Chart Colors
// ============================================================================

const CHART_COLORS = {
  primary: "#d97706", // amber-600
  secondary: "#f59e0b", // amber-500
  muted: "#fcd34d", // amber-300
  accent: "#92400e", // amber-800
}

// ============================================================================
// Main Component
// ============================================================================

export function StudyTimeCard() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekStats, setWeekStats] = useState<TimerWeekStats | null>(null)
  const [monthStats, setMonthStats] = useState<TimerMonthStats | null>(null)
  const [yearStats, setYearStats] = useState<TimerYearStats | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [week, month, year] = await Promise.all([
          apiClient.get<TimerWeekStats>("/api/timer/stats/week"),
          apiClient.get<TimerMonthStats>("/api/timer/stats/month"),
          apiClient.get<TimerYearStats>("/api/timer/stats/year"),
        ])
        setWeekStats(week)
        setMonthStats(month)
        setYearStats(year)
      } catch (error) {
        console.error("Failed to load study time stats:", error)
        setWeekStats(null)
        setMonthStats(null)
        setYearStats(null)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // データを変換
  const last7DaysData = useMemo(() => generateLast7Days(weekStats), [weekStats])
  const monthlyWeekData = useMemo(() => generateMonthlyWeeks(monthStats), [monthStats])
  const yearlyData = useMemo(() => generateYearlyData(yearStats), [yearStats])

  // 7日間の集計
  const weeklyTotal = last7DaysData.reduce((sum, day) => sum + day.totalSeconds, 0)
  const weeklyAvg = Math.round(weeklyTotal / 7)

  // 今月の集計
  const monthlyTotal = monthlyWeekData.reduce((sum, week) => sum + week.totalSeconds, 0)
  const maxWeekSeconds = Math.max(...monthlyWeekData.map((w) => w.totalSeconds), 1)

  if (loading) {
    return (
      <Card className="border-amber-200/60 shadow-sm">
        <CardHeader className="p-3">
          <div className="text-center text-muted-foreground py-4 text-sm">
            読み込み中...
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200/60 shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-50/40 transition-colors p-3">
            <div className="flex items-start gap-3">
              {/* アイコン */}
              <div className="p-1.5 rounded-md bg-amber-100 shrink-0 mt-0.5">
                <Clock className="h-4 w-4 text-amber-700" />
              </div>

              {/* メインコンテンツ：スマホは縦並び、PCは横並び */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  {/* 7日間サマリー */}
                  <div className="sm:flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-amber-900 tabular-nums">
                        {formatHoursShort(weeklyTotal)}
                      </span>
                      <span className="text-xs text-amber-600">/ 7日間</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        (平均{formatTime(weeklyAvg)}/日)
                      </span>
                    </div>
                    {/* ミニバーチャート - 7日間 */}
                    {last7DaysData.length > 0 && (
                      <div className="mt-1 sm:w-3/4">
                        <div className="flex items-end gap-0.5 h-16">
                          {last7DaysData.map((day) => {
                            const maxSeconds = Math.max(...last7DaysData.map((d) => d.totalSeconds), 1)
                            const heightPercent = maxSeconds > 0 ? (day.totalSeconds / maxSeconds) * 100 : 0
                            return (
                              <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
                                <span className="text-[8px] text-amber-700 leading-none mb-0.5 tabular-nums">
                                  {secondsToHours(day.totalSeconds)}
                                </span>
                                <div
                                  className="w-full bg-amber-500 rounded-t min-h-[2px]"
                                  style={{ height: `${Math.max(heightPercent, 8)}%` }}
                                  title={`${day.dayOfWeek}: ${formatTime(day.totalSeconds)}`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex gap-0.5 mt-0.5">
                          {last7DaysData.map((day) => (
                            <span key={day.date} className="flex-1 text-[8px] text-amber-600 leading-none text-center">
                              {day.date.slice(5).replace("-", "/")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 区切り線：PCは縦線、スマホは横線 */}
                  <div className="hidden sm:block h-10 w-px bg-amber-200/60" />
                  <div className="sm:hidden h-px w-full bg-amber-200/60" />

                  {/* 今月サマリー */}
                  <div className="sm:shrink-0">
                    <div className="flex items-baseline gap-1 sm:justify-end">
                      <span className="text-lg font-bold text-amber-900 tabular-nums">
                        {formatHoursShort(monthlyTotal)}
                      </span>
                      <span className="text-xs text-amber-600">/ 今月</span>
                    </div>
                    {/* 週別ミニバーチャート */}
                    {monthlyWeekData.length > 0 && (
                      <div className="mt-1">
                        <div className="flex items-end gap-1.5 sm:gap-1 h-16 sm:justify-end">
                          {monthlyWeekData.map((week) => {
                            const heightPercent = maxWeekSeconds > 0 ? (week.totalSeconds / maxWeekSeconds) * 100 : 0
                            return (
                              <div key={week.week} className="flex flex-col items-center justify-end h-full flex-1 sm:flex-none sm:w-4">
                                <span className="text-[8px] text-amber-700 leading-none mb-0.5 tabular-nums sm:hidden">
                                  {secondsToHours(week.totalSeconds)}
                                </span>
                                <div
                                  className="w-full bg-amber-400 rounded-t min-h-[2px]"
                                  style={{ height: `${Math.max(heightPercent, 8)}%` }}
                                  title={`${week.label}: ${formatTime(week.totalSeconds)}`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex gap-1.5 sm:gap-1 mt-0.5 sm:justify-end">
                          {monthlyWeekData.map((week, index) => (
                            <span key={week.week} className="flex-1 sm:flex-none sm:w-4 text-[8px] text-amber-600 leading-none text-center">
                              {week.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 展開アイコン */}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-amber-500 transition-transform shrink-0 mt-1",
                  isOpen && "rotate-180"
                )}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-3">
              {/* 左: 7日間詳細 */}
              <div>
                <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">
                  過去7日間
                </p>
                {last7DaysData.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">データがありません</div>
                ) : (
                  <div className="space-y-0.5">
                    {last7DaysData.map((day) => {
                      const maxSeconds = Math.max(...last7DaysData.map((d) => d.totalSeconds), 1)
                      return (
                        <div
                          key={day.date}
                          className="flex items-center justify-between text-xs py-0.5"
                        >
                          <span className="text-amber-700 w-8">
                            {day.date.slice(5).replace("-", "/")}
                          </span>
                          <span className="text-amber-500 text-[10px]">{day.dayOfWeek}</span>
                          <div className="flex-1 mx-2">
                            <div className="h-1 bg-amber-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (day.totalSeconds / maxSeconds) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="font-medium text-amber-900 tabular-nums w-12 text-right">
                            {formatTime(day.totalSeconds)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 右: 今月週別詳細 */}
              <div>
                <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">
                  今月（週別）
                </p>
                {monthlyWeekData.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">データがありません</div>
                ) : (
                  <>
                    <div className="space-y-0.5">
                      {monthlyWeekData.map((week) => (
                        <div
                          key={week.week}
                          className="flex items-center justify-between text-xs py-0.5"
                        >
                          <span className="text-amber-700 w-10">{week.label}</span>
                          <div className="flex-1 mx-2">
                            <div className="h-1 bg-amber-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{
                                  width: `${Math.min(100, (week.totalSeconds / maxWeekSeconds) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="font-medium text-amber-900 tabular-nums w-12 text-right">
                            {formatTime(week.totalSeconds)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* 今月の統計 */}
                    {monthlyWeekData.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-amber-100 flex justify-between text-[10px]">
                        <span className="text-amber-600">週平均</span>
                        <span className="font-medium text-amber-800">
                          {formatTime(Math.round(monthlyTotal / monthlyWeekData.length))}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 月別推移グラフ（CSSベース） */}
            {yearlyData.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-100">
                <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-2">
                  月別推移
                </p>
                <div className="h-32">
                  <div className="flex items-end gap-1 h-full">
                    {yearlyData.map((month) => {
                      const maxSeconds = Math.max(...yearlyData.map((m) => m.totalSeconds), 1)
                      const heightPercent = maxSeconds > 0 ? (month.totalSeconds / maxSeconds) * 100 : 0
                      const hours = secondsToHours(month.totalSeconds)
                      return (
                        <div key={month.month} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[8px] text-amber-800 leading-none mb-0.5 tabular-nums">
                            {hours}
                          </span>
                          <div
                            className="w-full bg-amber-500 rounded-t min-h-[2px]"
                            style={{ height: `${Math.max(heightPercent, 5)}%` }}
                            title={`${month.label}: ${formatTime(month.totalSeconds)}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {yearlyData.map((month) => (
                      <span key={month.month} className="flex-1 text-[8px] text-amber-600 leading-none text-center">
                        {month.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export default StudyTimeCard
