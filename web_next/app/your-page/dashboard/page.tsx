"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, FileText, RotateCcw, Clock, ChevronDown, Sparkles, Calendar as CalendarIcon } from "lucide-react"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { withAuth } from "@/components/auth/with-auth"
import { Calendar } from "@/components/ui/calendar"

function YourPageDashboard() {
  const { isOpen } = useSidebar()
  const [todayGoal, setTodayGoal] = useState("")
  const [focusMemo, setFocusMemo] = useState("")
  const [studyItems, setStudyItems] = useState("")
  const [topicsToRevisit7Days, setTopicsToRevisit7Days] = useState("")
  const [topicsToRevisitWholeTerm, setTopicsToRevisitWholeTerm] = useState("")
  const [revisitTab, setRevisitTab] = useState("7days")
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerDetailsOpen, setTimerDetailsOpen] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (timerEnabled) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerEnabled])

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

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 18) return "Good Afternoon"
    return "Good Evening"
  }

  // Get current date in JST (month/day with weekday)
  const getCurrentDate = () => {
    const now = new Date()
    // Use Intl.DateTimeFormat to get date in JST (Asia/Tokyo timezone)
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

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-background transition-all duration-300", isOpen && "ml-52")}>
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        {/* Header */}
        <header className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left side - Title and greeting */}
            <div className="flex items-center gap-3">
              <SidebarToggle />
              <div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
                  Dash Board
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {getGreeting()} for {getCurrentDate()}
                </p>
              </div>
            </div>

            {/* Right side - Timer control */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-center gap-3 bg-card px-3 py-2 rounded-lg border shadow-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="timer-switch" className="text-sm cursor-pointer">
                  Timer
                </Label>
                <Switch id="timer-switch" checked={timerEnabled} onCheckedChange={setTimerEnabled} />
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
        <main className="space-y-[1.125rem]">
          {/* Today's Goal Card */}
          <Card className="shadow-sm mb-10">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-600" />
                Today&apos;s メモ
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <Textarea
                value={todayGoal}
                onChange={(e) => setTodayGoal(e.target.value)}
                placeholder="後日振返れるように、今日の学習のポイントを入力..."
                className="min-h-[120px] resize-none border-muted"
              />
            </CardContent>
          </Card>

          {/* Today's Memo Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                Today&apos;s Topics
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div>
                <Label htmlFor="focus-memo" className="text-xs text-muted-foreground mb-1.5 block">
                  Today&apos;s Goals & Topics
                </Label>
                <Textarea
                  id="focus-memo"
                  value={focusMemo}
                  onChange={(e) => setFocusMemo(e.target.value)}
                  placeholder="今日のゴールや勉強する/したことを管理..."
                  className="min-h-[100px] resize-none border-muted"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="topics-to-revisit" className="text-xs text-muted-foreground">
                    Topics to Revisit
                  </Label>
                  <Tabs value={revisitTab} onValueChange={setRevisitTab} className="w-auto">
                    <TabsList className="h-7 p-0.5">
                      <TabsTrigger value="7days" className="text-xs px-2 py-1">
                        this 7days
                      </TabsTrigger>
                      <TabsTrigger value="whole" className="text-xs px-2 py-1">
                        whole term
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {revisitTab === "7days" ? (
                  <Textarea
                    id="topics-to-revisit-7days"
                    value={topicsToRevisit7Days}
                    onChange={(e) => setTopicsToRevisit7Days(e.target.value)}
                    placeholder="ここ数日のやり残し"
                    className="min-h-[100px] resize-none border-muted"
                  />
                ) : (
                  <Textarea
                    id="topics-to-revisit-whole"
                    value={topicsToRevisitWholeTerm}
                    onChange={(e) => setTopicsToRevisitWholeTerm(e.target.value)}
                    placeholder="全期間のやり残し"
                    className="min-h-[100px] resize-none border-muted"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Yesterday's Review Card */}
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

          {/* Calendar Card */}
          <Card className="shadow-sm mb-6 mt-8">
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-amber-600" />
                カレンダー
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <Calendar />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default withAuth(YourPageDashboard, { requireAuth: true })
