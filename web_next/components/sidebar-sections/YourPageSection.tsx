"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, FileText, BookOpen, StickyNote, ChevronDown, Clock } from "lucide-react"
import { useMemo, Suspense, useState, useEffect } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FIXED_SUBJECTS } from "@/lib/subjects"

const yourPageNav = [
  {
    name: "Dashboard",
    href: "/your-page/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "過去問管理",
    href: "/your-page/past-questions",
    icon: FileText,
  },
  {
    name: "各科目ページ",
    href: "/your-page/subjects/憲法",
    icon: BookOpen,
  },
]

// 日付をフォーマットする関数
function formatDateForDisplay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${month}/${day}`
}

// YYYY-MM-DD形式の日付文字列を取得
function getDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function YourPageSectionInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDashboardActive = pathname === "/your-page/dashboard" || pathname?.startsWith("/your-page/dashboard")
  const isPastQuestionsActive = pathname === "/your-page/past-questions" || pathname?.startsWith("/your-page/past-questions")
  const isSubjectsActive = pathname?.startsWith("/your-page/subjects/")
  const isYourPageActive = isDashboardActive || isPastQuestionsActive || isSubjectsActive
  
  // 過去5日分は常にデフォルトで閉じた状態
  const [isDateListOpen, setIsDateListOpen] = useState(false)
  
  // 直近アクセスした科目ページ（最大5件）
  const [recentSubjects, setRecentSubjects] = useState<Array<{ subject: string; timestamp: number }>>([])
  const [isRecentSubjectsOpen, setIsRecentSubjectsOpen] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const historyStr = localStorage.getItem('recent_subject_pages')
        if (historyStr) {
          const history: Array<{ subject: string; timestamp: number }> = JSON.parse(historyStr)
          // 有効な科目のみをフィルタリング（型アサーションを使用）
          const validHistory = history.filter(item => 
            FIXED_SUBJECTS.includes(item.subject as typeof FIXED_SUBJECTS[number])
          )
          setRecentSubjects(validHistory.slice(0, 5))
        }
      } catch (error) {
        console.error('Failed to load recent subject pages:', error)
      }
    }
  }, [pathname]) // pathnameが変更されたときに再読み込み

  // 過去5日分の日付を計算
  const dateOptions = useMemo(() => {
    const now = new Date()
    // JSTに変換
    const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
    
    const dates = []
    for (let i = 0; i < 5; i++) {
      const date = new Date(jstDate)
      date.setDate(date.getDate() - i)
      dates.push({
        date,
        dateString: getDateString(date),
        label: i === 0 ? "today" : i === 1 ? "yesterday" : formatDateForDisplay(date),
      })
    }
    return dates
  }, [])

  const handleDateClick = (dateString: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", dateString)
    router.push(`/your-page/dashboard?${params.toString()}`)
  }

  const currentSelectedDate = searchParams.get("date") || getDateString(new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })))

  return (
    <div className="space-y-1 px-2">
      {yourPageNav.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/your-page/dashboard" && pathname.startsWith(item.href))
        const isDashboard = item.href === "/your-page/dashboard"
        
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-100/80 text-blue-700 shadow-sm"
                  : "text-slate-600 hover:bg-blue-50/60 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-500")} />
              <span>{item.name}</span>
            </Link>
            
            {/* Your Page配下のページでは日付選択を表示（折りたたみ可能） */}
            {isDashboard && isYourPageActive && (
              <Collapsible open={isDateListOpen} onOpenChange={setIsDateListOpen}>
                <CollapsibleTrigger className="mt-1 ml-7 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full px-2 py-1 rounded">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isDateListOpen && "rotate-180")} />
                  <span>過去5日分</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-0.5 ml-7 space-y-0.5">
                  {dateOptions.map((option) => {
                    const isSelected = option.dateString === currentSelectedDate
                    return (
                      <button
                        key={option.dateString}
                        onClick={() => handleDateClick(option.dateString)}
                        className={cn(
                          "w-full text-left px-2 py-1 text-xs rounded transition-colors",
                          isSelected
                            ? "bg-blue-200/60 text-blue-800 font-medium"
                            : "text-slate-500 hover:bg-blue-50/60 hover:text-slate-700"
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* 各科目ページ配下では直近アクセスした科目ページを表示（折りたたみ可能） */}
            {isSubjectsActive && isYourPageActive && recentSubjects.length > 0 && (
              <Collapsible open={isRecentSubjectsOpen} onOpenChange={setIsRecentSubjectsOpen}>
                <CollapsibleTrigger className="mt-1 ml-7 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full px-2 py-1 rounded">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isRecentSubjectsOpen && "rotate-180")} />
                  <Clock className="h-3 w-3" />
                  <span>直近アクセス</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-0.5 ml-7 space-y-0.5">
                  {recentSubjects.map((item) => {
                    const isSelected = pathname === `/your-page/subjects/${item.subject}`
                    return (
                      <Link
                        key={item.subject}
                        href={`/your-page/subjects/${item.subject}`}
                        className={cn(
                          "block w-full text-left px-2 py-1 text-xs rounded transition-colors",
                          isSelected
                            ? "bg-blue-200/60 text-blue-800 font-medium"
                            : "text-slate-500 hover:bg-blue-50/60 hover:text-slate-700"
                        )}
                      >
                        {item.subject}
                      </Link>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )
      })}
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
