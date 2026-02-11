"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Target, FileText, RotateCcw, Clock, ChevronDown, Sparkles } from "lucide-react"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { LoginButton } from "@/components/auth/login-button"

export default function YourPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { mainContentStyle } = useSidebar()
  const [todayGoal, setTodayGoal] = useState("")
  const [focusMemo, setFocusMemo] = useState("")
  const [studyItems, setStudyItems] = useState("")
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerDetailsOpen, setTimerDetailsOpen] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (timerEnabled && isAuthenticated) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerEnabled, isAuthenticated])

  // 認証済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/your-page/dashboard")
    }
  }, [isLoading, isAuthenticated, router])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatTimeDisplay = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hrs}時間${mins}分`
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  const getCurrentDate = () => {
    const now = new Date()
    const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
    })
    const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      weekday: "short",
    })
    const date = dateFormatter.format(now)
    const weekday = weekdayFormatter.format(now)
    return `${date}（${weekday}）`
  }

  // ローディング中、または認証済みでリダイレクト中
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-800">
              {isLoading ? "認証情報を確認中..." : "ダッシュボードに移動中..."}
            </p>
            <p className="text-sm text-slate-500">しばらくお待ちください</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-background transition-all duration-300 relative"
      style={mainContentStyle}
    >
      {/* コンテンツ */}
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Header */}
        <header className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <SidebarToggle />
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                  Your Page
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {getGreeting()} for {getCurrentDate()}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-3 bg-card px-3 py-2 rounded-lg border shadow-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="timer-switch" className="text-sm cursor-pointer">
                  Timer
                </Label>
                <Switch id="timer-switch" checked={timerEnabled} onCheckedChange={setTimerEnabled} disabled={!isAuthenticated} />
                <span className="text-sm font-medium min-w-[70px] text-right">
                  {formatTimeDisplay(elapsedTime)}
                </span>
              </div>

              <Collapsible open={timerDetailsOpen} onOpenChange={setTimerDetailsOpen}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {timerEnabled ? "勉強中" : "休憩中"}
                  </span>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <span>詳細表示</span>
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform duration-200", timerDetailsOpen && "rotate-180")}
                    />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-2">
                  <div className="bg-card border rounded-lg px-4 py-3 shadow-sm">
                    <p className="text-2xl font-mono font-medium text-center">{formatTime(elapsedTime)}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="space-y-3">
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-600" />
                今日の目標
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <Textarea
                value={todayGoal}
                onChange={(e) => setTodayGoal(e.target.value)}
                placeholder="今日の勉強予定を入力..."
                className="min-h-[120px] resize-none border-muted"
                disabled={!isAuthenticated}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                Today&apos;s メモ
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div>
                <Label htmlFor="focus-memo" className="text-xs text-muted-foreground mb-1.5 block">
                  Today&apos;s Point
                </Label>
                <Textarea
                  id="focus-memo"
                  value={focusMemo}
                  onChange={(e) => setFocusMemo(e.target.value)}
                  placeholder="今日考えたことを残しておこう..."
                  className="min-h-[100px] resize-none border-muted"
                  disabled={!isAuthenticated}
                />
              </div>
              <div>
                <Label htmlFor="study-items" className="text-xs text-muted-foreground mb-1.5 block">
                  Today&apos;s Study
                </Label>
                <Textarea
                  id="study-items"
                  value={studyItems}
                  onChange={(e) => setStudyItems(e.target.value)}
                  placeholder="今日勉強した項目をメモ..."
                  className="min-h-[100px] resize-none border-muted"
                  disabled={!isAuthenticated}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                昨日の復習問題
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center justify-center py-8 bg-muted/30 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">復習問題は今後実装予定です。前回のあなたの学習記録から、AIが復習問題を生成してくれます。</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 未認証時のオーバーレイ */}
      {!isAuthenticated && (
        <>
          {/* グレーアウト効果 */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40" />
          {/* ログインメッセージ */}
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 border border-slate-200 pointer-events-auto">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <Lock className="h-8 w-8 text-slate-400" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-800">ログインが必要です</h2>
                <p className="text-slate-600 leading-relaxed">
                  Your Pageの機能を利用するには、Googleアカウントでログインしてください。
                </p>
                <div className="pt-4">
                  <LoginButton />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
