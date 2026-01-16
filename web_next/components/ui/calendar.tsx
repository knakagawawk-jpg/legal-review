"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface CalendarProps {
  className?: string
}

export function Calendar({ className }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date()

  // 月の最初の日を取得
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  // 月の最初の日の曜日（0=日曜日）
  const firstDayWeekday = firstDayOfMonth.getDay()
  
  // 月の日数
  const daysInMonth = lastDayOfMonth.getDate()

  // カレンダーの日付配列を作成
  const days: (number | null)[] = []
  
  // 前月の空白を追加
  for (let i = 0; i < firstDayWeekday; i++) {
    days.push(null)
  }
  
  // 今月の日付を追加
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ]

  const isToday = (day: number | null) => {
    if (day === null) return false
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    )
  }

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  return (
    <div className={cn("w-full", className)}>
      {/* ヘッダー（年月とナビゲーション） */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="前の月"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h3 className="text-sm font-medium">
          {year}年 {monthNames[month]}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="次の月"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーの日付 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div
            key={index}
            className={cn(
              "aspect-square flex items-center justify-center text-sm rounded transition-colors",
              day === null && "text-transparent",
              day !== null && !isToday(day) && "text-foreground hover:bg-muted",
              isToday(day) && "bg-amber-500 text-white font-semibold rounded"
            )}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  )
}
