"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, BookOpen, StickyNote, ChevronDown, History } from "lucide-react"
import { useMemo, Suspense, useState, useEffect } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FIXED_SUBJECTS } from "@/lib/subjects"
import { getStudyDate, getRecentStudyDates } from "@/lib/study-date"

const yourPageNav = [
  {
    name: "Dashboard",
    href: "/your-page/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Your Notes",
    href: "/your-page/subjects/憲法",
    icon: BookOpen,
  },
  {
    name: "Your History",
    href: "/your-page/history",
    icon: History,
  },
]

// 日付をフォーマットする関数
function formatDateForDisplay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}/${day}`
}

// YYYY-MM-DD形式の日付文字列は study-date.ts を使用（4:00境界で統一）

function YourPageSectionInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDashboardActive = pathname === "/your-page/dashboard" || pathname?.startsWith("/your-page/dashboard")
  const isHistoryActive = pathname === "/your-page/history" || pathname?.startsWith("/your-page/history")
  const isSubjectsActive = pathname?.startsWith("/your-page/subjects/")
  const isYourPageActive = isDashboardActive || isHistoryActive || isSubjectsActive
  
  // 過去5日分は常にデフォルトで閉じた状態
  const [isDateListOpen, setIsDateListOpen] = useState(false)
  
  // 直近アクセスしたノートページ（最大5件）
  const [recentNotePages, setRecentNotePages] = useState<Array<{ subject: string; pageId: number; title: string; timestamp: number }>>([])
  const [isRecentNotePagesOpen, setIsRecentNotePagesOpen] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const historyStr = localStorage.getItem("recent_note_pages")
        if (historyStr) {
          const history: Array<{ subject: string; pageId: number; title: string; timestamp: number }> = JSON.parse(historyStr)
          const validHistory = history.filter(item =>
            FIXED_SUBJECTS.includes(item.subject as typeof FIXED_SUBJECTS[number]) &&
            typeof item.pageId === "number" &&
            Number.isFinite(item.pageId)
          )
          setRecentNotePages(validHistory.slice(0, 5))
        }
      } catch (error) {
        console.error("Failed to load recent note pages:", error)
      }
    }
  }, [pathname, searchParams]) // クエリ変更でも再読み込み

  // 過去5日分（study_date, 4:00境界）の日付を計算
  const dateOptions = useMemo(() => {
    const ymds = getRecentStudyDates(5)
    return ymds.map((ymd, i) => {
      // 表示ラベルだけは暦日表記（MM/DD）にする
      const date = new Date(`${ymd}T12:00:00+09:00`)
      return {
        date,
        dateString: ymd,
        label: i === 0 ? "today" : i === 1 ? "yesterday" : formatDateForDisplay(date),
      }
    })
  }, [])

  const handleDateClick = (dateString: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", dateString)
    router.push(`/your-page/dashboard?${params.toString()}`)
  }

  const currentSelectedDate = searchParams.get("date") || getStudyDate()

  return (
    <div className="space-y-1 pt-2 border-t border-blue-200/40">
      {/* サブメニュー - 改善されたスタイル */}
      <div className="space-y-px">
        {yourPageNav.map((item) => {
          const isActive = (() => {
            if (item.href === "/your-page/dashboard") return isDashboardActive
            if (item.href === "/your-page/history") return isHistoryActive
            // `yourPageNav`上はデフォルトのリンク先が「/your-page/subjects/憲法」だが、
            // アクティブ判定は「各科目ページ配下」全体で行う
            if (item.href.startsWith("/your-page/subjects/")) return isSubjectsActive
            return pathname === item.href || pathname.startsWith(item.href)
          })()
          const isDashboard = item.href === "/your-page/dashboard"
          const isSubjectsNavItem = item.href.startsWith("/your-page/subjects/")
          const Icon = item.icon
          
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "group flex w-full items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-blue-50/90 to-cyan-50/60"
                    : "hover:bg-blue-50/40"
                )}
              >
                {/* おしゃれなアイコンラッパー */}
                <div
                  className={cn(
                    "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-br from-blue-100 to-cyan-100 shadow-sm"
                      : "bg-slate-100/80 group-hover:bg-blue-100/60"
                  )}
                >
                  {/* 背景のアクセント */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-md opacity-0 transition-opacity duration-200",
                      "bg-gradient-to-br from-blue-200/50 to-cyan-200/30",
                      isActive && "opacity-100"
                    )}
                  />
                  <Icon
                    className={cn(
                      "relative h-3 w-3 transition-all duration-200",
                      isActive
                        ? "text-blue-600"
                        : "text-slate-400 group-hover:text-blue-500 group-hover:scale-110"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[11px] truncate transition-colors",
                    isActive
                      ? "text-blue-700 font-medium"
                      : "text-slate-500 group-hover:text-slate-600"
                  )}
                >
                  {item.name}
                </span>
                {/* アクティブドット */}
                <div
                  className={cn(
                    "ml-auto h-1.5 w-1.5 rounded-full transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-blue-400 to-cyan-400 opacity-100"
                      : "bg-blue-300 opacity-0 group-hover:opacity-50"
                  )}
                />
              </Link>
            
              {/* Dashboard用の折りたたみエリア */}
              {isDashboard && isYourPageActive && (
                <Collapsible open={isDateListOpen} onOpenChange={setIsDateListOpen} className="ml-4">
                  <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-blue-500 transition-colors">
                    <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isDateListOpen && "rotate-180")} />
                    <span>過去5日分</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-1 pb-1">
                    <div className="space-y-px pt-0.5">
                      {dateOptions.map((option) => {
                        const isSelected = option.dateString === currentSelectedDate
                        return (
                          <button
                            key={option.dateString}
                            onClick={() => handleDateClick(option.dateString)}
                            className={cn(
                              "w-full text-left px-2 py-0.5 text-[10px] rounded transition-all duration-150",
                              isSelected
                                ? "bg-blue-100 text-blue-600 font-medium"
                                : "text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            
              {/* Your Notes用の折りたたみエリア */}
              {isSubjectsNavItem && (
                <Collapsible open={isRecentNotePagesOpen} onOpenChange={setIsRecentNotePagesOpen} className="ml-4">
                  <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] text-slate-400 hover:text-blue-500 transition-colors">
                    <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isRecentNotePagesOpen && "rotate-180")} />
                    <StickyNote className="h-2.5 w-2.5" />
                    <span>直近閲覧</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-1 pb-1">
                    <div className="space-y-px pt-0.5">
                      {recentNotePages.length === 0 ? (
                        <div className="px-2 py-1 text-[10px] text-slate-400">履歴がありません</div>
                      ) : (
                        recentNotePages.map((item) => {
                          const encodedSubject = encodeURIComponent(item.subject)
                          const href = `/your-page/subjects/${encodedSubject}?tab=notes&pageId=${encodeURIComponent(String(item.pageId))}`
                          const isSelected =
                            pathname?.startsWith(`/your-page/subjects/`) &&
                            searchParams.get("tab") === "notes" &&
                            searchParams.get("pageId") === String(item.pageId)

                          return (
                            <Link
                              key={`${item.subject}-${item.pageId}`}
                              href={href}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-all duration-150 group/note",
                                isSelected
                                  ? "bg-blue-50 text-blue-600"
                                  : "text-slate-400 hover:bg-blue-50/50 hover:text-slate-500"
                              )}
                              title={`${item.subject} / ${item.title || "無題"}`}
                            >
                              <div
                                className={cn(
                                  "h-1 w-1 rounded-full shrink-0 transition-colors",
                                  isSelected
                                    ? "bg-blue-400"
                                    : "bg-slate-300 group-hover/note:bg-blue-300"
                                )}
                              />
                              <span className="truncate">{item.title || "無題"}</span>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function YourPageSection() {
  return (
    <Suspense fallback={
      <div className="space-y-1 px-2">
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    }>
      <YourPageSectionInner />
    </Suspense>
  )
}
