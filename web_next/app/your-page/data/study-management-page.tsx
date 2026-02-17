"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, BookOpen, ChevronDown, ChevronUp, Filter, Menu, Lightbulb, ListTodo, Heart, Calendar as CalendarIcon, Pencil, Check, X, Maximize2, Plus, CalendarDays } from "lucide-react"
import { SortableRow } from "@/components/sortable-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId, getSubjectShortName } from "@/lib/subjects"
import { apiClient } from "@/lib/api-client"
import { hasFunctionalConsent } from "@/lib/cookie-consent"
import { StudyTimeCard } from "@/components/study-time-card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ItemField } from "@/components/item-field"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Calendar, DatePickerCalendar } from "@/components/ui/calendar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SUBJECT_COLORS, POINT_STATUS_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/dashboard-constants"
import { MemoField } from "@/components/memo-field"
import { AddRowBar } from "@/components/add-row-bar"
import { TableWithAddRow } from "@/components/table-with-add-row"
import type { DashboardItem } from "@/types/dashboard"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/** Achievement of the Month の短答ブロック表示（false=非表示でスペース確保。true で復活） */
const SHOW_ACHIEVEMENT_SHORT_ANSWER = false

type ReviewHistoryItem = {
  id: number
  review_id: number
  subject: number | string | null  // 科目ID（1-18）
  subject_name: string | null  // 科目名（表示用）
  exam_type: string | null
  year: number | null
  score: number | null
  attempt_count: number
  created_at: string
}

type ExamRecord = {
  id: number
  itemName: string
  solvedDate: string
  score: number | null
  attemptCount: number
  reviewLink: string
  subject: string
  year: number | null
  examType: string | null
}

interface TimerDailyStats {
  study_date: string  // YYYY-MM-DD
  total_seconds: number
  sessions_count: number
}

interface MonthlyGoal {
  yyyymm: number
  target_study_minutes: number | null
  target_short_answer_count: number | null
  target_review_count: number | null
  /** 対象月にユーザーが行った講評数（今月の実績） */
  review_count?: number
}

interface TimerMonthStats {
  month: string  // "2025-02"
  total_seconds: number
  week_stats: Array<{ week_start: string; week_end: string; total_seconds: number; daily_stats: Array<{ study_date: string; total_seconds: number }> }>
}

interface TimerSession {
  id: string
  started_at: string  // ISO datetime string
  ended_at: string | null  // ISO datetime string or null
  status: "running" | "stopped"
  stop_reason?: string
}

interface Thread {
  id: number
  user_id: number
  type: string  // 'free_chat', 'review_chat', 'short_answer_chat'
  title: string | null
  created_at: string
  last_message_at: string | null
  favorite: number  // 0=OFF, 1=ON
  pinned: boolean
  review_id?: number | null  // 講評チャットの場合のreview_id
}

function ExamTable({ data, title }: { data: ExamRecord[]; title: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-amber-900/80">{title}</h3>
      <div className="border border-amber-200/60 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-50/60">
              <TableHead className="w-[200px] text-xs">項目名</TableHead>
              <TableHead className="w-[100px] text-xs">解いた日</TableHead>
              <TableHead className="w-[80px] text-xs">点数</TableHead>
              <TableHead className="w-[60px] text-xs">何回目</TableHead>
              <TableHead className="w-[90px] text-xs">講評</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              data.map((record) => (
                <TableRow key={record.id} className="hover:bg-amber-50/40">
                  <TableCell className="font-medium text-sm">{record.itemName}</TableCell>
                  <TableCell className="text-sm text-stone-600">{record.solvedDate}</TableCell>
                  <TableCell>
                    {record.score !== null ? (
                      <span className="text-sm font-semibold text-slate-700">
                        {record.score.toFixed(1)}点
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-stone-600">{record.attemptCount}回目</TableCell>
                  <TableCell>
                    <a
                      href={record.reviewLink}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      講評を見る
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


// プラン制限情報の型
interface PlanLimitUsage {
  plan_name: string | null
  plan_code: string | null
  reviews_used: number
  reviews_limit: number | null
  review_chat_messages_used: number
  review_chat_messages_limit: number | null
  free_chat_messages_used: number
  free_chat_messages_limit: number | null
  recent_review_daily_limit: number | null
  non_review_cost_yen_used: number
  non_review_cost_yen_limit: number | null
}

// 勉強管理ページコンポーネント（history/page からも利用するため別ファイルへ切り出し）
export function StudyManagementPage({ variant = "full" }: { variant?: "full" | "memo-topics-only" }) {
  const [memoItems, setMemoItems] = useState<DashboardItem[]>([])
  const [topicItems, setTopicItems] = useState<DashboardItem[]>([])
  const [targetItems, setTargetItems] = useState<DashboardItem[]>([])
  const [targetDisplayLimit, setTargetDisplayLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [planLimits, setPlanLimits] = useState<PlanLimitUsage | null>(null)
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null)
  const [monthStatsForGoal, setMonthStatsForGoal] = useState<TimerMonthStats | null>(null)
  const [goalEditOpen, setGoalEditOpen] = useState(false)
  const [goalEditSaving, setGoalEditSaving] = useState(false)
  const [goalEditForm, setGoalEditForm] = useState({
    target_study_hours: "",
    target_short_answer_count: "",
    target_review_count: "",
  })
  
  // 折りたたみ状態
  const [memoOpen, setMemoOpen] = useState(true)
  const [topicOpen, setTopicOpen] = useState(true)
  const [goalAchievementCardVisible, setGoalAchievementCardVisible] = useState(true)
  
  // MEMO用フィルター
  const [memoSubjectFilter, setMemoSubjectFilter] = useState<string | null>(null)
  const [memoStatusFilter, setMemoStatusFilter] = useState<number | null>(null)
  const [memoStartDate, setMemoStartDate] = useState<Date | undefined>(undefined)
  const [memoEndDate, setMemoEndDate] = useState<Date | undefined>(undefined)
  const [memoFavoriteFilter, setMemoFavoriteFilter] = useState<"fav-only" | "fav-except" | "all">("all")
  
  // Topics用フィルター
  const [topicSubjectFilter, setTopicSubjectFilter] = useState<string | null>(null)
  const [topicStatusFilter, setTopicStatusFilter] = useState<number | null>(null)
  const [topicStartDate, setTopicStartDate] = useState<Date | undefined>(undefined)
  const [topicEndDate, setTopicEndDate] = useState<Date | undefined>(undefined)
  const [topicFavoriteFilter, setTopicFavoriteFilter] = useState<"fav-only" | "fav-except" | "all">("all")
  
  // スクロール位置保持用
  const memoScrollRef = useRef<HTMLDivElement>(null)
  const topicScrollRef = useRef<HTMLDivElement>(null)
  
  // favorite更新用のタイマー
  const favoriteUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  
  // メモ更新用のタイマー
  const memoUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingMemoUpdates = useRef<Record<number, string>>({})
  
  // 項目・科目・種類更新用のタイマー
  const itemUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingItemUpdates = useRef<Record<number, Partial<DashboardItem>>>({})
  
  // 作成日編集用のPopover状態
  const [memoCreatedDatePickerOpen, setMemoCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  const [topicCreatedDatePickerOpen, setTopicCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  
  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // 対象月 yyyymm（目標達成率カード用、今月）
  const goalYyyymm = useMemo(() => {
    const d = new Date()
    return d.getFullYear() * 100 + (d.getMonth() + 1)
  }, [])

  // データ取得
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      if (variant === "memo-topics-only") {
        const [memoData, topicData] = await Promise.all([
          apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=1"),
          apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=2"),
        ])
        console.log("MEMO data:", memoData)
        console.log("Topics data:", topicData)
        setMemoItems(memoData.items || [])
        setTopicItems(topicData.items || [])
      } else {
        const [memoData, topicData, targetData, limitsData, goalData, monthStatsData] = await Promise.all([
          apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=1"),
          apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=2"),
          apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=3"),
          apiClient.get<PlanLimitUsage>("/api/users/me/plan-limits"),
          apiClient.get<MonthlyGoal>(`/api/users/me/monthly-goal?yyyymm=${goalYyyymm}`).catch(() => null),
          apiClient.get<TimerMonthStats>(`/api/timer/stats/month?yyyymm=${goalYyyymm}`).catch(() => null),
        ])
        console.log("MEMO data:", memoData)
        console.log("Topics data:", topicData)
        setMemoItems(memoData.items || [])
        setTopicItems(topicData.items || [])
        setTargetItems(targetData.items || [])
        setPlanLimits(limitsData)
        setMonthlyGoal(goalData ?? null)
        setMonthStatsForGoal(monthStatsData ?? null)
      }
      
      // スクロール位置を復元
      if (hasFunctionalConsent()) {
        const memoScrollPos = localStorage.getItem("study-memo-scroll")
        const topicScrollPos = localStorage.getItem("study-topic-scroll")
        setTimeout(() => {
          if (memoScrollRef.current && memoScrollPos) {
            memoScrollRef.current.scrollTop = parseInt(memoScrollPos)
          }
          if (topicScrollRef.current && topicScrollPos) {
            topicScrollRef.current.scrollTop = parseInt(topicScrollPos)
          }
        }, 100)
      }
    } catch (error) {
      console.error("Failed to load dashboard items:", error)
      setMemoItems([])
      setTopicItems([])
      setTargetItems([])
    } finally {
      setLoading(false)
    }
  }, [goalYyyymm, variant])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openGoalEdit = useCallback(() => {
    setGoalEditForm({
      target_study_hours: monthlyGoal?.target_study_minutes != null ? String(monthlyGoal.target_study_minutes / 60) : "",
      target_short_answer_count: monthlyGoal?.target_short_answer_count != null ? String(monthlyGoal.target_short_answer_count) : "",
      target_review_count: monthlyGoal?.target_review_count != null ? String(monthlyGoal.target_review_count) : "",
    })
    setGoalEditOpen(true)
  }, [monthlyGoal])

  const saveGoalEdit = useCallback(async () => {
    setGoalEditSaving(true)
    try {
      const parse = (s: string): number | null => {
        const v = s.trim()
        if (v === "") return null
        const n = parseInt(v, 10)
        return Number.isNaN(n) || n < 0 ? null : n
      }
      const parseHours = (s: string): number | null => {
        const v = s.trim()
        if (v === "") return null
        const n = parseFloat(v)
        if (Number.isNaN(n) || n < 0) return null
        return Math.round(n * 60) // 時間 → 分
      }
      const data = await apiClient.put<MonthlyGoal>("/api/users/me/monthly-goal", {
        yyyymm: goalYyyymm,
        target_study_minutes: parseHours(goalEditForm.target_study_hours),
        target_short_answer_count: parse(goalEditForm.target_short_answer_count),
        target_review_count: parse(goalEditForm.target_review_count),
      })
      setMonthlyGoal(data)
      setGoalEditOpen(false)
    } catch (e) {
      console.error("Failed to save monthly goal:", e)
    } finally {
      setGoalEditSaving(false)
    }
  }, [goalYyyymm, goalEditForm])
  
  // 新しいMEMOアイテムを作成
  const createMemoItem = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      await apiClient.post<DashboardItem>("/api/dashboard/items", {
        dashboard_date: today,
        entry_type: 1,
        item: "",
        status: 1,
        position: null,
        created_at: today,
      })
      await loadData()
    } catch (error) {
      console.error("Failed to create memo item:", error)
    }
  }, [loadData])
  
  // 新しいTopicsアイテムを作成
  const createTopicItem = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      await apiClient.post<DashboardItem>("/api/dashboard/items", {
        dashboard_date: today,
        entry_type: 2,
        item: "",
        status: 1,
        position: null,
        created_at: today,
      })
      await loadData()
    } catch (error) {
      console.error("Failed to create topic item:", error)
    }
  }, [loadData])

  // 今月の目標（Target）行を追加
  const createTargetItem = useCallback(async () => {
    try {
      const y = Math.floor(goalYyyymm / 100)
      const m = goalYyyymm % 100
      const firstDay = `${y}-${String(m).padStart(2, "0")}-01`
      await apiClient.post<DashboardItem>("/api/dashboard/items", {
        dashboard_date: firstDay,
        entry_type: 3,
        item: "",
        status: 1,
        position: null,
        created_at: firstDay,
      })
      await loadData()
    } catch (error) {
      console.error("Failed to create target item:", error)
    }
  }, [loadData, goalYyyymm])
  
  // アイテム削除
  const deleteItem = useCallback(async (itemId: number) => {
    try {
      await apiClient.delete(`/api/dashboard/items/${itemId}`)
      await loadData()
    } catch (error) {
      console.error("Failed to delete item:", error)
    }
  }, [loadData])

  // entry_type変換（MEMO ↔ Topic）
  const convertEntryType = useCallback(async (itemId: number, newEntryType: 1 | 2 | 3) => {
    try {
      await apiClient.put(`/api/dashboard/items/${itemId}`, { entry_type: newEntryType })
      await loadData()
    } catch (error) {
      console.error("Failed to convert entry type:", error)
    }
  }, [loadData])
  
  // MEMOのドラッグ終了処理
  const handleDragEndMemo = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = memoItems.findIndex((item) => item.id.toString() === active.id)
      const newIndex = memoItems.findIndex((item) => item.id.toString() === over.id)

      const newItems = arrayMove(memoItems, oldIndex, newIndex)
      setMemoItems(newItems)

      // Update positions
      const movedItem = newItems[newIndex]
      const prevItem = newIndex > 0 ? newItems[newIndex - 1] : null
      const nextItem = newIndex < newItems.length - 1 ? newItems[newIndex + 1] : null

      let newPosition: number
      if (prevItem && nextItem) {
        newPosition = Math.floor((prevItem.position + nextItem.position) / 2)
      } else if (prevItem) {
        newPosition = prevItem.position + 10
      } else if (nextItem) {
        newPosition = nextItem.position - 10
      } else {
        newPosition = 10
      }

      try {
        await apiClient.put(`/api/dashboard/items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder memo item:", error)
        await loadData()
      }
    }
  }, [memoItems, loadData])
  
  // Topicsのドラッグ終了処理
  const handleDragEndTopic = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = topicItems.findIndex((item) => item.id.toString() === active.id)
      const newIndex = topicItems.findIndex((item) => item.id.toString() === over.id)

      const newItems = arrayMove(topicItems, oldIndex, newIndex)
      setTopicItems(newItems)

      // Update positions
      const movedItem = newItems[newIndex]
      const prevItem = newIndex > 0 ? newItems[newIndex - 1] : null
      const nextItem = newIndex < newItems.length - 1 ? newItems[newIndex + 1] : null

      let newPosition: number
      if (prevItem && nextItem) {
        newPosition = Math.floor((prevItem.position + nextItem.position) / 2)
      } else if (prevItem) {
        newPosition = prevItem.position + 10
      } else if (nextItem) {
        newPosition = nextItem.position - 10
      } else {
        newPosition = 10
      }

      try {
        await apiClient.put(`/api/dashboard/items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder topic item:", error)
        await loadData()
      }
    }
  }, [topicItems, loadData])
  
  // スクロール位置を保存
  const handleMemoScroll = useCallback(() => {
    if (memoScrollRef.current && hasFunctionalConsent()) {
      localStorage.setItem("study-memo-scroll", memoScrollRef.current.scrollTop.toString())
    }
  }, [])
  
  const handleTopicScroll = useCallback(() => {
    if (topicScrollRef.current && hasFunctionalConsent()) {
      localStorage.setItem("study-topic-scroll", topicScrollRef.current.scrollTop.toString())
    }
  }, [])
  
  // favorite更新（5秒バッファ付き）
  const updateFavorite = useCallback(async (itemId: number, favorite: number) => {
    // 既存のタイマーをクリア
    if (favoriteUpdateTimers.current[itemId]) {
      clearTimeout(favoriteUpdateTimers.current[itemId])
    }
    
    // 楽観的更新
    setMemoItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite } : item))
    setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite } : item))
    
    // 5秒後にDBに保存
    favoriteUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        await apiClient.put(`/api/dashboard/items/${itemId}`, { favorite })
        delete favoriteUpdateTimers.current[itemId]
      } catch (error) {
        console.error("Failed to update favorite:", error)
        // エラー時は元に戻す
        setMemoItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite: 1 - favorite } : item))
        setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite: 1 - favorite } : item))
      }
    }, 5000)
  }, [])
  
  // メモ更新（debounce付き）
  const updateMemo = useCallback(async (itemId: number, memo: string, entryType: number) => {
    // 楽観的更新
    if (entryType === 1) {
      setMemoItems(prev => prev.map(item => item.id === itemId ? { ...item, memo } : item))
    } else if (entryType === 2) {
      setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, memo } : item))
    } else if (entryType === 3) {
      setTargetItems(prev => prev.map(item => item.id === itemId ? { ...item, memo } : item))
    }
    
    // 既存のタイマーをクリア
    if (memoUpdateTimers.current[itemId]) {
      clearTimeout(memoUpdateTimers.current[itemId])
    }
    
    // 更新内容を保存
    pendingMemoUpdates.current[itemId] = memo
    
    // 5秒後にDBに保存
    memoUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        const memoToSave = pendingMemoUpdates.current[itemId]
        await apiClient.put(`/api/dashboard/items/${itemId}`, { memo: memoToSave })
        delete memoUpdateTimers.current[itemId]
        delete pendingMemoUpdates.current[itemId]
      } catch (error) {
        console.error("Failed to update memo:", error)
        delete memoUpdateTimers.current[itemId]
        delete pendingMemoUpdates.current[itemId]
      }
    }, 5000)
  }, [])
  
  // 項目・科目・種類更新（debounce付き）
  const updateItemField = useCallback(async (itemId: number, field: keyof DashboardItem, value: any, entryType: number) => {
    // 楽観的更新
    if (entryType === 1) {
      setMemoItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
    } else if (entryType === 2) {
      setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
    } else if (entryType === 3) {
      setTargetItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
    }
    
    // 既存のタイマーをクリア
    if (itemUpdateTimers.current[itemId]) {
      clearTimeout(itemUpdateTimers.current[itemId])
    }
    
    // 更新内容を保存
    pendingItemUpdates.current[itemId] = {
      ...pendingItemUpdates.current[itemId],
      [field]: value
    }
    
    // 0.8秒後にDBに保存
    itemUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        const updateData = pendingItemUpdates.current[itemId]
        await apiClient.put(`/api/dashboard/items/${itemId}`, updateData)
        delete itemUpdateTimers.current[itemId]
        delete pendingItemUpdates.current[itemId]
      } catch (error) {
        console.error("Failed to update item field:", error)
        // エラー時はデータを再読み込み
        await loadData()
        delete itemUpdateTimers.current[itemId]
        delete pendingItemUpdates.current[itemId]
      }
    }, 800)
  }, [loadData])
  
  // フィルター適用後のMEMO
  const filteredMemoItems = useMemo(() => {
    let filtered = [...memoItems]
    
    // 科目フィルター
    if (memoSubjectFilter !== null) {
      const subjectId = getSubjectId(memoSubjectFilter)
      filtered = filtered.filter(item => {
        if (subjectId !== null) {
          return item.subject === subjectId
        }
        return getSubjectName(item.subject || 0) === memoSubjectFilter
      })
    }
    
    // 種類フィルター
    if (memoStatusFilter !== null) {
      filtered = filtered.filter(item => item.status === memoStatusFilter)
    }
    
    // 期間フィルター
    if (memoStartDate) {
      // JST 4:00区切り（=28時の「今日」）と整合するため、JSTの暦日で比較する
      const startStr = new Date(memoStartDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true // NULLも含める
        return item.created_at >= startStr
      })
    }
    if (memoEndDate) {
      const endStr = new Date(memoEndDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true // NULLも含める
        return item.created_at <= endStr
      })
    }
    
    // favoriteフィルター
    if (memoFavoriteFilter === "fav-only") {
      filtered = filtered.filter(item => item.favorite === 1)
    } else if (memoFavoriteFilter === "fav-except") {
      filtered = filtered.filter(item => item.favorite === 0)
    }
    
    // ソート: favoriteのうち作成日が新しい順→favoriteじゃないもので作成日が新しい順
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return b.favorite - a.favorite
      }
      const aDate = a.created_at || ""
      const bDate = b.created_at || ""
      return bDate.localeCompare(aDate)
    })
    
    return filtered
  }, [memoItems, memoSubjectFilter, memoStatusFilter, memoStartDate, memoEndDate, memoFavoriteFilter])
  
  // フィルター適用後のTopics
  const filteredTopicItems = useMemo(() => {
    let filtered = [...topicItems]
    
    // 科目フィルター
    if (topicSubjectFilter !== null) {
      const subjectId = getSubjectId(topicSubjectFilter)
      filtered = filtered.filter(item => {
        if (subjectId !== null) {
          return item.subject === subjectId
        }
        return getSubjectName(item.subject || 0) === topicSubjectFilter
      })
    }
    
    // 種類フィルター
    if (topicStatusFilter !== null) {
      filtered = filtered.filter(item => item.status === topicStatusFilter)
    }
    
    // 期間フィルター
    if (topicStartDate) {
      const startStr = new Date(topicStartDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true // NULLも含める
        return item.created_at >= startStr
      })
    }
    if (topicEndDate) {
      const endStr = new Date(topicEndDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true // NULLも含める
        return item.created_at <= endStr
      })
    }
    
    // favoriteフィルター
    if (topicFavoriteFilter === "fav-only") {
      filtered = filtered.filter(item => item.favorite === 1)
    } else if (topicFavoriteFilter === "fav-except") {
      filtered = filtered.filter(item => item.favorite === 0)
    }
    
    // ソート: favoriteのうち作成日が新しい順→favoriteじゃないもので作成日が新しい順
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) {
        return b.favorite - a.favorite
      }
      const aDate = a.created_at || ""
      const bDate = b.created_at || ""
      return bDate.localeCompare(aDate)
    })
    
    return filtered
  }, [topicItems, topicSubjectFilter, topicStatusFilter, topicStartDate, topicEndDate, topicFavoriteFilter])
  
  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }
  
  // 科目リスト
  const subjects = FIXED_SUBJECTS.map(name => ({
    id: getSubjectId(name),
    name,
  })).filter(s => s.id !== null) as Array<{ id: number; name: string }>

  // 今月の目標（entry_type=3）：該当月でフィルタ
  const targetItemsForMonth = useMemo(() => {
    const y = Math.floor(goalYyyymm / 100)
    const m = goalYyyymm % 100
    const first = `${y}-${String(m).padStart(2, "0")}-01`
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const nextFirst = `${nextY}-${String(nextM).padStart(2, "0")}-01`
    return targetItems.filter(
      (item) => item.dashboard_date >= first && item.dashboard_date < nextFirst
    )
  }, [targetItems, goalYyyymm])

  // 表示する目標行：最大 targetDisplayLimit 件。0〜3件のときは4行になるよう空行を足す
  const displayedTargetRows = useMemo(() => {
    const slice = targetItemsForMonth.slice(0, targetDisplayLimit)
    if (slice.length <= 3) {
      const emptyCount = 4 - slice.length
      return { rows: slice, emptyCount }
    }
    return { rows: slice, emptyCount: 0 }
  }, [targetItemsForMonth, targetDisplayLimit])
  const hasMoreTargets = targetItemsForMonth.length > targetDisplayLimit

  // 目標達成率カード用：該当月の勉強時間／目標（時間表示）
  const goalStudyMinutes = Math.floor((monthStatsForGoal?.total_seconds ?? 0) / 60)
  const targetStudy = monthlyGoal?.target_study_minutes ?? 0
  const targetShort = monthlyGoal?.target_short_answer_count ?? 0
  const targetReview = monthlyGoal?.target_review_count ?? 0
  const studyRate = targetStudy > 0 ? Math.min(100, Math.round((goalStudyMinutes / targetStudy) * 100)) : 0
  const studyNumHours = goalStudyMinutes / 60
  const studyDenomHours = targetStudy / 60
  // 短答・講評は分母だけ目標値、分子は現状のまま（短答は未実装のため 0）
  const shortAnswerNum = 0
  const shortAnswerRate = targetShort > 0 ? Math.min(100, Math.round((shortAnswerNum / targetShort) * 100)) : 0
  const reviewNum = monthlyGoal?.review_count ?? planLimits?.reviews_used ?? 0
  const reviewRate = targetReview > 0 ? Math.min(100, Math.round((reviewNum / targetReview) * 100)) : 0
  const reviewDenom = targetReview > 0 ? targetReview : 0

  return (
    <div className="space-y-4">
      {variant === "full" && (
      <>
      {/* 講評回数は目標達成率カードの下に表示 */}
      <div className="flex justify-end mb-2 sr-only">
        <div className="text-sm text-muted-foreground">
          講評回数：
          {planLimits?.reviews_limit != null ? (
            <span className="font-semibold text-amber-700">{planLimits.reviews_used}</span>
          ) : (
            <span className="font-semibold">{planLimits?.reviews_used ?? "-"}</span>
          )}
          {planLimits?.reviews_limit != null && (
            <> / <span className="font-semibold">{planLimits.reviews_limit}</span></>
          )}
          回
        </div>
      </div>
      
      {/* Achievement of the Month（メインカード） */}
      {goalAchievementCardVisible && (
        <div className="rounded-2xl border border-orange-200/80 bg-white/90 shadow-xl shadow-orange-900/5 backdrop-blur-sm transition-all duration-300 overflow-hidden">
          <div className="py-4 px-6 flex items-center justify-between border-b border-orange-100">
            <h2 className="text-lg font-semibold tracking-tight text-orange-900/90">
              Achievement of the Month
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openGoalEdit}
                className="text-orange-600 hover:text-orange-700 p-2 rounded-lg hover:bg-orange-50/80 transition-colors flex items-center gap-1.5 text-sm font-medium"
                title="目標を編集"
              >
                <Pencil className="h-4 w-4" />
                目標を編集
              </button>
              <button
                type="button"
                onClick={() => setGoalAchievementCardVisible(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="p-8 sm:p-10">
            <div className="flex gap-10 sm:gap-12">
              {/* 左：円グラフ＋時間 */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="relative w-40 h-40 sm:w-44 sm:h-44">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#fff7ed" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#gradientCircleGoal)"
                      strokeWidth="8"
                      strokeDasharray={`${42 * Math.PI * (studyRate / 100)}, ${42 * Math.PI * 2}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <defs>
                      <linearGradient id="gradientCircleGoal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl sm:text-4xl font-bold tabular-nums text-orange-600">{studyRate}%</span>
                    <span className="text-xs font-medium text-slate-500 mt-1 tracking-wide uppercase">達成</span>
                  </div>
                </div>
                <p className="mt-6 text-center">
                  <span className="text-2xl font-semibold tabular-nums text-slate-800">
                    {studyNumHours.toFixed(1)} / <span className="text-orange-600 cursor-pointer hover:text-orange-700 transition-colors" onClick={openGoalEdit} title={studyDenomHours > 0 ? "クリックで目標を編集" : "クリックで目標を設定"}>{studyDenomHours.toFixed(1)}</span>
                  </span>
                  <span className="text-sm font-medium text-slate-500 ml-1.5">時間</span>
                </p>
              </div>

              {/* 右：目標達成＋短答＋講評。幅は目標達成:短答:講評＝10:7:3。狭い画面では目標達成で折り返し、短答・講評は次行で7:3 */}
              <div className="flex-1 flex flex-col gap-4 min-w-0">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="min-w-0 sm:flex-[10]">
                    <p className="text-xs font-medium text-slate-500 mb-1">今月の目標勉強時間</p>
                    <p className="text-sm font-semibold text-slate-800 tabular-nums">
                      <span className="text-orange-600">{studyNumHours.toFixed(1)}</span> / <span className="cursor-pointer hover:text-orange-600 transition-colors" onClick={openGoalEdit}>{studyDenomHours.toFixed(1)}</span>h
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${studyRate}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-row justify-start gap-3 sm:gap-4 min-w-0 sm:flex-[10]">
                    {SHOW_ACHIEVEMENT_SHORT_ANSWER && (
                      <div className="min-w-0 flex-[7]">
                        <p className="text-xs font-medium text-slate-500 mb-1">短答</p>
                        <p className="text-sm font-semibold text-slate-800 tabular-nums">
                          {shortAnswerRate}% <span className="font-normal text-slate-600">·</span>{" "}
                          <span className="text-violet-600">{shortAnswerNum}</span> / <span className="cursor-pointer hover:text-violet-600 transition-colors" onClick={openGoalEdit}>{targetShort}</span>
                        </p>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${shortAnswerRate}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0 flex-[3] ml-auto sm:ml-auto">
                      <p className="text-xs font-medium text-slate-500 mb-1 text-right">目標答案提出数</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums text-right">
                        <span className="text-rose-600">{reviewNum}</span> / <span className="cursor-pointer hover:text-rose-600 transition-colors" onClick={openGoalEdit}>{reviewDenom}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 mt-1">
                  <p className="text-xs font-semibold text-slate-600 mb-3 tracking-wide">今月の目標</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: "3.5rem" }} />
                        <col style={{ width: "calc((100% - 7rem) * 0.25)" }} />
                        <col style={{ width: "3.5rem" }} />
                        <col style={{ width: "calc((100% - 7rem) * 0.75)" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <th className="py-1 px-0.5 w-14 text-left font-medium text-slate-600">科目</th>
                          <th className="py-1 px-1 text-left font-medium text-slate-600">項目</th>
                          <th className="py-1 px-0 w-14 text-left font-medium text-slate-600">状態</th>
                          <th className="py-1 px-1 text-left font-medium text-slate-600">メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTargetRows.rows.map((item) => {
                          const statusOption = TASK_STATUS_OPTIONS.find((s) => s.value === item.status)
                          const selectedSubject = subjects.find((s) => s.id === item.subject)
                          return (
                            <tr key={item.id} className="border-b border-slate-50">
                              <TableCell className="py-1.5 px-0.5 w-14 align-top">
                                <Select
                                  value={item.subject?.toString() || undefined}
                                  onValueChange={(value) => updateItemField(item.id, "subject", value ? parseInt(value) : null, 3)}
                                >
                                  <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
                                    {selectedSubject ? (
                                      <span className={cn("text-xs px-1.5 py-0.5 rounded", SUBJECT_COLORS[selectedSubject.name] || "")}>
                                        {getSubjectShortName(selectedSubject.name)}
                                      </span>
                                    ) : (
                                      <SelectValue placeholder="--" />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {subjects.filter((s) => s.id != null && s.id.toString() !== "").map((s) => (
                                      <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                                        <span className={cn(SUBJECT_COLORS[s.name] ? `px-1.5 py-0.5 rounded ${SUBJECT_COLORS[s.name]}` : "")}>
                                          {getSubjectShortName(s.name)}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-1.5 px-1 min-w-0 align-top">
                                <ItemField
                                  value={item.item}
                                  onChange={(e) => updateItemField(item.id, "item", e.target.value, 3)}
                                />
                              </TableCell>
                              <TableCell className="py-1.5 px-0 w-14 align-top">
                                <Select
                                  value={item.status.toString()}
                                  onValueChange={(value) => updateItemField(item.id, "status", parseInt(value), 3)}
                                >
                                  <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
                                    {statusOption ? (
                                      <span className={cn("text-xs px-1.5 py-0.5 rounded", statusOption.color)}>
                                        {statusOption.label}
                                      </span>
                                    ) : (
                                      <SelectValue />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TASK_STATUS_OPTIONS.filter((opt) => opt.value != null && opt.value.toString() !== "").map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                        <span className={cn("px-1.5 py-0.5 rounded", opt.color)}>{opt.label}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-1.5 px-1 min-w-0 align-top">
                                <MemoField
                                  value={item.memo || ""}
                                  onChange={(e) => updateMemo(item.id, e.target.value, 3)}
                                  maxDisplayLines={10}
                                />
                              </TableCell>
                            </tr>
                          )
                        })}
                        {Array.from({ length: displayedTargetRows.emptyCount }).map((_, i) => (
                          <tr key={`empty-${i}`} className="border-b border-slate-50">
                            <TableCell colSpan={4} className="px-4 py-2 h-8" />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex justify-end items-center gap-2">
                    {hasMoreTargets && (
                      <button
                        type="button"
                        onClick={() => setTargetDisplayLimit((n) => n + 10)}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        さらに10件表示
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={createTargetItem}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      行追加
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>今月の目標を編集</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="goal-study" className="text-sm font-medium">目標勉強時間（時間）</Label>
              <Input
                id="goal-study"
                type="number"
                min={0}
                step={0.5}
                placeholder="例: 50"
                value={goalEditForm.target_study_hours}
                onChange={(e) => setGoalEditForm((f) => ({ ...f, target_study_hours: e.target.value }))}
                className="border-amber-200 focus:ring-amber-500"
              />
            </div>
            {SHOW_ACHIEVEMENT_SHORT_ANSWER && (
              <div className="grid gap-2">
                <Label htmlFor="goal-short" className="text-sm font-medium">目標短答実施数</Label>
                <Input
                  id="goal-short"
                  type="number"
                  min={0}
                  placeholder="例: 25"
                  value={goalEditForm.target_short_answer_count}
                  onChange={(e) => setGoalEditForm((f) => ({ ...f, target_short_answer_count: e.target.value }))}
                  className="border-violet-200 focus:ring-violet-500"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="goal-review" className="text-sm font-medium">目標答案提出数</Label>
              <Input
                id="goal-review"
                type="number"
                min={0}
                placeholder="例: 10"
                value={goalEditForm.target_review_count}
                onChange={(e) => setGoalEditForm((f) => ({ ...f, target_review_count: e.target.value }))}
                className="border-rose-200 focus:ring-rose-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGoalEditOpen(false)} disabled={goalEditSaving}>
              キャンセル
            </Button>
            <Button type="button" onClick={saveGoalEdit} disabled={goalEditSaving} className="bg-amber-600 hover:bg-amber-700">
              {goalEditSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!goalAchievementCardVisible && (
        <button
          type="button"
          onClick={() => setGoalAchievementCardVisible(true)}
          className="w-full py-2.5 pl-4 pr-4 text-sm font-medium text-orange-600 hover:text-orange-700 bg-slate-50 hover:bg-orange-50/50 border border-slate-200 rounded-xl transition-colors text-left"
        >
          Achievement of the Month を表示
        </button>
      )}
      </>
      )}

      {/* Your MEMO */}
      <Card className="shadow-sm border-amber-200/60">
        <CardHeader className="py-1.5 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
              <Lightbulb className="h-3.5 w-3.5 text-amber-200/60" />
              Your MEMO
            </CardTitle>
            <div className="flex items-center gap-1">
              <Link href="/your-page/data/memo">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  拡大
                </Button>
              </Link>
              <Collapsible open={memoOpen} onOpenChange={setMemoOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 text-xs p-0"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", memoOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </CardHeader>
        <Collapsible open={memoOpen} onOpenChange={setMemoOpen}>
          <CollapsibleContent>
            <CardContent className="px-3 pb-2">
          {/* MEMO用フィルター */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {/* 科目 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80 bg-gray-100 text-gray-700">
                  {memoSubjectFilter ? (
                    <span className={cn(SUBJECT_COLORS[memoSubjectFilter] && "px-1.5 py-0.5 rounded", SUBJECT_COLORS[memoSubjectFilter] || "")}>
                      {getSubjectShortName(memoSubjectFilter)}
                    </span>
                  ) : (
                    <span>全科目</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-32">
                <DropdownMenuItem
                  onClick={() => setMemoSubjectFilter(null)}
                  className={cn(
                    "text-xs cursor-pointer rounded-sm bg-gray-100 text-gray-700",
                    memoSubjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                  )}
                >
                  全科目
                </DropdownMenuItem>
                {FIXED_SUBJECTS.map((subject) => {
                  const color = SUBJECT_COLORS[subject] || ""
                  return (
                    <DropdownMenuItem
                      key={subject}
                      onClick={() => setMemoSubjectFilter(subject)}
                      className={cn(
                        "text-xs cursor-pointer rounded-sm",
                        memoSubjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                      )}
                    >
                      <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(subject)}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* 種類 */}
            <Select 
              value={memoStatusFilter?.toString() || "all"} 
              onValueChange={(value) => {
                if (value === "all") {
                  setMemoStatusFilter(null)
                } else {
                  setMemoStatusFilter(parseInt(value))
                }
              }}
            >
              <SelectTrigger size="xs" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">全種類</SelectItem>
                {POINT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* 期間 */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {memoStartDate ? formatDate(memoStartDate.toISOString()) : "開始日"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar
                  selectedDate={memoStartDate || null}
                  onSelect={(date) => setMemoStartDate(date || undefined)}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">～</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {memoEndDate ? formatDate(memoEndDate.toISOString()) : "終了日"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar
                  selectedDate={memoEndDate || null}
                  onSelect={(date) => setMemoEndDate(date || undefined)}
                />
              </PopoverContent>
            </Popover>
            
            {/* fav */}
            <Select 
              value={memoFavoriteFilter} 
              onValueChange={(value) => {
                setMemoFavoriteFilter(value as "fav-only" | "fav-except" | "all")
              }}
            >
              <SelectTrigger size="xs" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fav-only" className="text-xs">favのみ</SelectItem>
                <SelectItem value="fav-except" className="text-xs">fav以外</SelectItem>
                <SelectItem value="all" className="text-xs">フィルターなし</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* MEMOテーブル */}
          <TableWithAddRow
            maxHeight="480px"
            addRowBar={<AddRowBar onClick={createMemoItem} />}
            onScroll={handleMemoScroll}
            scrollRef={memoScrollRef}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndMemo}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground sticky top-0 bg-white">
                    <th className="py-1 px-1 w-6"></th>
                    <th className="py-1 px-0.5 text-left font-medium" style={{ width: "5rem", minWidth: "5rem" }}>科目</th>
                    <th className="py-1 px-1 text-left font-medium" style={{ minWidth: "112px", maxWidth: "210px" }}>項目</th>
                    <th className="py-1 px-0 text-left font-medium" style={{ width: "5rem", minWidth: "5rem" }}>種類</th>
                    <th className="py-1 px-1 text-center font-medium" style={{ width: "5rem", minWidth: "5rem" }}>作成</th>
                    <th className="py-1 px-1 text-left font-medium" style={{ minWidth: "399px" }}>メモ</th>
                    <th className="py-1 px-1 text-center font-medium" style={{ width: "3rem" }}>♡</th>
                  </tr>
                </thead>
                <SortableContext items={filteredMemoItems.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {loading ? (
                      <tr>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">
                          読み込み中...
                        </TableCell>
                      </tr>
                    ) : filteredMemoItems.length === 0 ? (
                      <tr>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">
                          データがありません
                        </TableCell>
                      </tr>
                    ) : (
                      filteredMemoItems.map((item) => {
                    const statusOption = POINT_STATUS_OPTIONS.find((s) => s.value === item.status)
                    const selectedSubject = subjects.find(s => s.id === item.subject)
                    const memoCreatedDate = item.created_at ? formatDate(item.created_at) : ""
                    return (
                      <SortableRow
                        key={item.id}
                        item={item}
                        onDelete={deleteItem}
                        onEditCreatedDate={(id) => setMemoCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))}
                        showCreatedDateButton={true}
                        entryType={1}
                        onConvertToTopic={(id) => convertEntryType(id, 2)}
                        onConvertToTarget={(id) => convertEntryType(id, 3)}
                        itemText={item.item}
                      >
                        <TableCell className="py-1.5 px-0.5 align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Select
                            value={item.subject?.toString() || undefined}
                            onValueChange={(value) => updateItemField(item.id, "subject", value ? parseInt(value) : null, 1)}
                          >
                            <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
                              {selectedSubject ? (
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", SUBJECT_COLORS[selectedSubject.name] || "")}>
                                  {getSubjectShortName(selectedSubject.name)}
                                </span>
                              ) : (
                                <SelectValue placeholder="--" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => {
                                const color = SUBJECT_COLORS[s.name] || ""
                                return (
                                  <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                                    <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(s.name)}</span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top" style={{ minWidth: "112px", maxWidth: "210px" }}>
                          <ItemField
                            value={item.item}
                            onChange={(e) => updateItemField(item.id, "item", e.target.value, 1)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-0 align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Select
                            value={item.status.toString()}
                            onValueChange={(value) => updateItemField(item.id, "status", parseInt(value), 1)}
                          >
                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
                              {statusOption ? (
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", statusOption.color)}>
                                  {statusOption.label}
                                </span>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {POINT_STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 text-xs text-muted-foreground text-center relative align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Popover
                            open={memoCreatedDatePickerOpen[item.id] || false}
                            onOpenChange={(open) => setMemoCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}
                          >
                            <PopoverTrigger asChild>
                              <button className="w-full h-full hover:bg-muted/50 rounded px-1">
                                {memoCreatedDate}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3" align="start">
                              <DatePickerCalendar
                                selectedDate={item.created_at ? new Date(item.created_at) : null}
                                onSelect={(date) => {
                                  if (date) {
                                    const dateStr = date.toISOString().split("T")[0]
                                    updateItemField(item.id, "created_at", dateStr, 1)
                                  }
                                  setMemoCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top" style={{ minWidth: "399px" }}>
                          <MemoField
                            value={item.memo || ""}
                            onChange={(e) => updateMemo(item.id, e.target.value, 1)}
                            maxDisplayLines={10}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top text-center" style={{ width: "3rem" }}>
                          <button
                            onClick={() => updateFavorite(item.id, item.favorite === 1 ? 0 : 1)}
                            className={cn(
                              "text-lg transition-colors",
                              item.favorite === 1 ? "text-red-500" : "text-gray-300"
                            )}
                          >
                            <Heart className={cn("h-4 w-4", item.favorite === 1 && "fill-current")} />
                          </button>
                        </TableCell>
                      </SortableRow>
                    )
                  })
                )}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </TableWithAddRow>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
      
      {/* Your Topics */}
      <Card className="shadow-sm border-amber-200/60">
        <CardHeader className="py-1.5 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
              <ListTodo className="h-3.5 w-3.5 text-amber-200/60" />
              Your Topics
            </CardTitle>
            <div className="flex items-center gap-1">
              <Link href="/your-page/data/topics">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2"
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  拡大
                </Button>
              </Link>
              <Collapsible open={topicOpen} onOpenChange={setTopicOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 text-xs p-0"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", topicOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </CardHeader>
        <Collapsible open={topicOpen} onOpenChange={setTopicOpen}>
          <CollapsibleContent>
            <CardContent className="px-3 pb-2">
          {/* Topics用フィルター */}
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {/* 科目 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80 bg-gray-100 text-gray-700">
                  {topicSubjectFilter ? (
                    <span className={cn(SUBJECT_COLORS[topicSubjectFilter] && "px-1.5 py-0.5 rounded", SUBJECT_COLORS[topicSubjectFilter] || "")}>
                      {getSubjectShortName(topicSubjectFilter)}
                    </span>
                  ) : (
                    <span>全科目</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-32">
                <DropdownMenuItem
                  onClick={() => setTopicSubjectFilter(null)}
                  className={cn(
                    "text-xs cursor-pointer rounded-sm bg-gray-100 text-gray-700",
                    topicSubjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                  )}
                >
                  全科目
                </DropdownMenuItem>
                {FIXED_SUBJECTS.map((subject) => {
                  const color = SUBJECT_COLORS[subject] || ""
                  return (
                    <DropdownMenuItem
                      key={subject}
                      onClick={() => setTopicSubjectFilter(subject)}
                      className={cn(
                        "text-xs cursor-pointer rounded-sm",
                        topicSubjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                      )}
                    >
                      <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(subject)}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* 種類 */}
            <Select 
              value={topicStatusFilter?.toString() || "all"} 
              onValueChange={(value) => {
                if (value === "all") {
                  setTopicStatusFilter(null)
                } else {
                  setTopicStatusFilter(parseInt(value))
                }
              }}
            >
              <SelectTrigger size="xs" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">全状態</SelectItem>
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* 期間 */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {topicStartDate ? formatDate(topicStartDate.toISOString()) : "開始日"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar
                  selectedDate={topicStartDate || null}
                  onSelect={(date) => setTopicStartDate(date || undefined)}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">～</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {topicEndDate ? formatDate(topicEndDate.toISOString()) : "終了日"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar
                  selectedDate={topicEndDate || null}
                  onSelect={(date) => setTopicEndDate(date || undefined)}
                />
              </PopoverContent>
            </Popover>
            
            {/* fav */}
            <Select 
              value={topicFavoriteFilter} 
              onValueChange={(value) => {
                setTopicFavoriteFilter(value as "fav-only" | "fav-except" | "all")
              }}
            >
              <SelectTrigger size="xs" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fav-only" className="text-xs">favのみ</SelectItem>
                <SelectItem value="fav-except" className="text-xs">fav以外</SelectItem>
                <SelectItem value="all" className="text-xs">フィルターなし</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Topicsテーブル */}
          <TableWithAddRow
            maxHeight="480px"
            addRowBar={<AddRowBar onClick={createTopicItem} />}
            onScroll={handleTopicScroll}
            scrollRef={topicScrollRef}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndTopic}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground sticky top-0 bg-white">
                    <th className="py-1 px-1 w-6"></th>
                    <th className="py-1 px-0.5 text-left font-medium" style={{ width: "5rem", minWidth: "5rem" }}>科目</th>
                    <th className="py-1 px-1 text-left font-medium" style={{ minWidth: "112px", maxWidth: "210px" }}>項目</th>
                    <th className="py-1 px-1 text-center font-medium" style={{ width: "5rem", minWidth: "5rem" }}>作成</th>
                    <th className="py-1 px-0 text-left font-medium" style={{ width: "5rem", minWidth: "5rem" }}>期限</th>
                    <th className="py-1 px-0 text-left font-medium" style={{ width: "5rem", minWidth: "5rem" }}>状態</th>
                    <th className="py-1 px-1 text-left font-medium" style={{ minWidth: "399px" }}>メモ</th>
                    <th className="py-1 px-1 text-center font-medium" style={{ width: "3rem" }}>♡</th>
                  </tr>
                </thead>
                <SortableContext items={filteredTopicItems.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {loading ? (
                      <tr>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-sm">
                          読み込み中...
                        </TableCell>
                      </tr>
                    ) : filteredTopicItems.length === 0 ? (
                      <tr>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-sm">
                          データがありません
                        </TableCell>
                      </tr>
                    ) : (
                      filteredTopicItems.map((item) => {
                    const statusOption = TASK_STATUS_OPTIONS.find((s) => s.value === item.status)
                    const selectedSubject = subjects.find(s => s.id === item.subject)
                    const createdDate = item.created_at ? formatDate(item.created_at) : ""
                    return (
                      <SortableRow 
                        key={item.id} 
                        item={item} 
                        onDelete={deleteItem}
                        onEditCreatedDate={(id) => {
                          setTopicCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
                        }}
                        showCreatedDateButton={true}
                        entryType={2}
                        onConvertToMemo={(id) => convertEntryType(id, 1)}
                        onConvertToTarget={(id) => convertEntryType(id, 3)}
                        itemText={item.item}
                      >
                        <TableCell className="py-1.5 px-0.5 align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Select
                            value={item.subject?.toString() || undefined}
                            onValueChange={(value) => updateItemField(item.id, "subject", value ? parseInt(value) : null, 2)}
                          >
                            <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
                              {selectedSubject ? (
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", SUBJECT_COLORS[selectedSubject.name] || "")}>
                                  {getSubjectShortName(selectedSubject.name)}
                                </span>
                              ) : (
                                <SelectValue placeholder="--" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => {
                                const color = SUBJECT_COLORS[s.name] || ""
                                return (
                                  <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                                    <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(s.name)}</span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top" style={{ minWidth: "112px", maxWidth: "210px" }}>
                          <ItemField
                            value={item.item}
                            onChange={(e) => updateItemField(item.id, "item", e.target.value, 2)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 text-xs text-muted-foreground text-center relative align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Popover
                            open={topicCreatedDatePickerOpen[item.id] || false}
                            onOpenChange={(open) => setTopicCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}
                          >
                            <PopoverTrigger asChild>
                              <button className="w-full h-full hover:bg-muted/50 rounded px-1">
                                {createdDate}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3" align="start">
                              <DatePickerCalendar
                                selectedDate={item.created_at ? new Date(item.created_at) : null}
                                onSelect={(date) => {
                                  if (date) {
                                    const dateStr = date.toISOString().split("T")[0]
                                    updateItemField(item.id, "created_at", dateStr, 2)
                                  }
                                  setTopicCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="py-1.5 px-0 align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          {item.due_date ? (
                            <span className="text-xs text-muted-foreground">{formatDate(item.due_date)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-0 align-top" style={{ width: "5rem", minWidth: "5rem" }}>
                          <Select
                            value={item.status.toString()}
                            onValueChange={(value) => updateItemField(item.id, "status", parseInt(value), 2)}
                          >
                            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
                              {statusOption ? (
                                <span className={cn("text-xs px-1.5 py-0.5 rounded", statusOption.color)}>
                                  {statusOption.label}
                                </span>
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
                                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top" style={{ minWidth: "399px" }}>
                          <MemoField
                            value={item.memo || ""}
                            onChange={(e) => updateMemo(item.id, e.target.value, 2)}
                            maxDisplayLines={10}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 align-top text-center" style={{ width: "3rem" }}>
                          <button
                            onClick={() => updateFavorite(item.id, item.favorite === 1 ? 0 : 1)}
                            className={cn(
                              "text-lg transition-colors",
                              item.favorite === 1 ? "text-red-500" : "text-gray-300"
                            )}
                          >
                            <Heart className={cn("h-4 w-4", item.favorite === 1 && "fill-current")} />
                          </button>
                        </TableCell>
                      </SortableRow>
                    )
                  })
                )}
                  </tbody>
                </SortableContext>
              </table>
            </DndContext>
          </TableWithAddRow>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
      
      {/* 勉強時間カード */}
      <StudyTimeCard />
      
      {/* 過去のチャット履歴 */}
      <ChatHistorySection />
    </div>
  )
}

// 勉強時間セクションコンポーネント
function StudyTimeSection() {
  const [todayStats, setTodayStats] = useState<TimerDailyStats | null>(null)
  const [todaySessions, setTodaySessions] = useState<TimerSession[]>([])
  const [weekStats, setWeekStats] = useState<any>(null)
  const [fiveDaysStats, setFiveDaysStats] = useState<any>(null)
  const [monthStats, setMonthStats] = useState<any>(null)
  const [yearStats, setYearStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({})
  
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true)
        const [today, sessions, week, fiveDays, month, year] = await Promise.all([
          apiClient.get<TimerDailyStats>("/api/timer/daily-stats"),
          apiClient.get<TimerSession[]>("/api/timer/sessions?limit=10"),
          apiClient.get("/api/timer/stats/week"),
          apiClient.get("/api/timer/stats/5days"),
          apiClient.get("/api/timer/stats/month"),
          apiClient.get("/api/timer/stats/year"),
        ])
        console.log("Timer stats:", { today, sessions, week, fiveDays, month, year })
        setTodayStats(today)
        setTodaySessions(sessions || [])
        setWeekStats(week)
        setFiveDaysStats(fiveDays)
        setMonthStats(month)
        setYearStats(year)
      } catch (error) {
        console.error("Failed to load timer stats:", error)
        setTodayStats(null)
        setTodaySessions([])
        setWeekStats(null)
        setFiveDaysStats(null)
        setMonthStats(null)
        setYearStats(null)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])
  
  // 時間フォーマット（時間と分）
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}時間${minutes.toString().padStart(2, "0")}分`
  }
  
  // 日付フォーマット（M/D）
  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  
  // 曜日名
  const getWeekdayName = (index: number): string => {
    const weekdays = ["月", "火", "水", "木", "金", "土", "日"]
    return weekdays[index]
  }
  
  // 今週の開始日（月曜日）を取得
  const getWeekStartDate = (): Date => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // 月曜日を週の開始とする
    const monday = new Date(today.setDate(diff))
    return monday
  }
  
  // 週の日付をmm/dd形式で取得
  const getWeekDateLabel = (index: number): string => {
    const weekStart = getWeekStartDate()
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  
  const toggleCollapsible = (key: string) => {
    setOpenCollapsibles(prev => ({ ...prev, [key]: !prev[key] }))
  }
  
  return (
    <Card className="shadow-sm border-amber-200/60">
      <CardHeader className="py-1.5 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
          勉強時間
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2 space-y-2">
        {loading ? (
          <div className="text-center text-muted-foreground py-4 text-sm">読み込み中...</div>
        ) : (
          <>
            {/* Today */}
            <Collapsible open={openCollapsibles["today"]} onOpenChange={() => toggleCollapsible("today")}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-amber-50/40 rounded text-sm">
                <span>Today: {todayStats ? formatTime(todayStats.total_seconds) : "0時間00分"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles["today"] && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                <div className="space-y-1 text-xs">
                  {todaySessions.length === 0 ? (
                    <div className="text-muted-foreground py-2">セッションがありません</div>
                  ) : (
                    todaySessions.map((session) => {
                      const start = new Date(session.started_at)
                      const end = session.ended_at ? new Date(session.ended_at) : new Date()
                      const duration = Math.floor((end.getTime() - start.getTime()) / 1000)
                      return (
                        <div key={session.id} className="flex justify-between py-1">
                          <span>{start.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} - {end.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* This Week */}
            <Collapsible open={openCollapsibles["week"]} onOpenChange={() => toggleCollapsible("week")}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-amber-50/40 rounded text-sm">
                <span>This Week: {weekStats ? formatTime(weekStats.total_seconds) : "0時間00分"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles["week"] && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                <div className="space-y-1 text-xs">
                  {weekStats?.daily_stats?.map((day: any, index: number) => (
                    <div key={index} className="flex justify-between py-1 rounded">
                      <span>{getWeekdayName(index)} {getWeekDateLabel(index)}：{formatTime(day.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* This 5days */}
            <Collapsible open={openCollapsibles["5days"]} onOpenChange={() => toggleCollapsible("5days")}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-amber-50/40 rounded text-sm">
                <span>This 5days: {fiveDaysStats ? formatTime(fiveDaysStats.total_seconds) : "0時間00分"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles["5days"] && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                <div className="space-y-1 text-xs">
                  {fiveDaysStats?.daily_stats?.map((day: any) => (
                    <div key={day.study_date} className="flex justify-between py-1">
                      <span>{day.label}：{formatTime(day.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* This Month */}
            <Collapsible open={openCollapsibles["month"]} onOpenChange={() => toggleCollapsible("month")}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-amber-50/40 rounded text-sm">
                <span>This Month: {monthStats ? formatTime(monthStats.total_seconds) : "0時間00分"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles["month"] && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                <div className="space-y-1 text-xs">
                  {monthStats?.week_stats?.map((week: any, index: number) => (
                    <div key={index} className="flex justify-between py-1 rounded">
                      <span>第{index + 1}週：{formatTime(week.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* This Year */}
            <Collapsible open={openCollapsibles["year"]} onOpenChange={() => toggleCollapsible("year")}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-1.5 px-2 hover:bg-amber-50/40 rounded text-sm">
                <span>This Year: {yearStats ? formatTime(yearStats.total_seconds) : "0時間00分"}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles["year"] && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                <div className="space-y-1 text-xs">
                  {yearStats?.month_stats?.map((month: any) => (
                    <div key={month.month} className="flex justify-between py-1">
                      <span>{month.month.replace("-", "年").replace("-", "月")}：{formatTime(month.total_seconds)}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// 過去のチャット履歴セクションコンポーネント（講評履歴タブを内包）
function ChatHistorySection() {
  const [historySubTab, setHistorySubTab] = useState<"chat" | "review">("review")
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  
  // 講評履歴用
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [displayLimitShihou, setDisplayLimitShihou] = useState(5)
  const [displayLimitYobi, setDisplayLimitYobi] = useState(5)
  const [displayLimitOther, setDisplayLimitOther] = useState(3)
  const [displayLimitCombined, setDisplayLimitCombined] = useState(20)
  
  // フィルター
  const [typeFilter, setTypeFilter] = useState<string | null>(null)  // null = 全タイプ
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [favoriteFilter, setFavoriteFilter] = useState<"fav-only" | "fav-except" | "all">("all")
  
  // タイトル編集
  const [editingThreadId, setEditingThreadId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>("")
  
  // favorite更新用のタイマー
  const favoriteUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  
  // チャット履歴取得
  useEffect(() => {
    const loadThreads = async () => {
      try {
        setLoading(true)
        const data = await apiClient.get<{ threads: Thread[], total: number }>("/api/threads/all")
        console.log("Threads data:", data)
        setThreads(data.threads || [])
      } catch (error) {
        console.error("Failed to load threads:", error)
        setThreads([])
      } finally {
        setLoading(false)
      }
    }
    loadThreads()
  }, [])
  
  // 講評履歴取得（講評履歴タブ表示時）
  useEffect(() => {
    if (historySubTab !== "review") return
    const loadReviewHistory = async () => {
      try {
        setReviewLoading(true)
        const data = await apiClient.get<ReviewHistoryItem[]>("/api/review-history")
        setReviewHistory(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Failed to load review history:", error)
        setReviewHistory([])
      } finally {
        setReviewLoading(false)
      }
    }
    loadReviewHistory()
  }, [historySubTab])
  
  const isFilterActive = selectedSubject !== null || selectedYear !== null
  // フィルター変更時に表示件数をデフォルトに戻す
  useEffect(() => {
    if (historySubTab === "review") {
      if (isFilterActive) {
        setDisplayLimitCombined(20)
      } else {
        setDisplayLimitShihou(5)
        setDisplayLimitYobi(5)
        setDisplayLimitOther(3)
      }
    }
  }, [selectedSubject, selectedYear, historySubTab, isFilterActive])
  
  // タイトル更新
  const updateTitle = useCallback(async (threadId: number, newTitle: string) => {
    try {
      await apiClient.put(`/api/threads/${threadId}`, { title: newTitle })
      setThreads(prev => prev.map(thread => thread.id === threadId ? { ...thread, title: newTitle } : thread))
    } catch (error) {
      console.error("Failed to update title:", error)
    } finally {
      setEditingThreadId(null)
      setEditingTitle("")
    }
  }, [])
  
  // favorite更新（5秒バッファ付き）
  const updateFavorite = useCallback(async (threadId: number, favorite: number) => {
    // 既存のタイマーをクリア
    if (favoriteUpdateTimers.current[threadId]) {
      clearTimeout(favoriteUpdateTimers.current[threadId])
    }
    
    // 楽観的更新
    setThreads(prev => prev.map(thread => thread.id === threadId ? { ...thread, favorite } : thread))
    
    // 5秒後にDBに保存
    favoriteUpdateTimers.current[threadId] = setTimeout(async () => {
      try {
        await apiClient.put(`/api/threads/${threadId}`, { favorite })
        delete favoriteUpdateTimers.current[threadId]
      } catch (error) {
        console.error("Failed to update favorite:", error)
        // エラー時は元に戻す
        setThreads(prev => prev.map(thread => thread.id === threadId ? { ...thread, favorite: 1 - favorite } : thread))
      }
    }, 5000)
  }, [])
  
  // 講評履歴用：利用可能年度・フィルター済みデータ・表示用データ
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    reviewHistory.forEach((item) => { if (item.year !== null) years.add(item.year) })
    return Array.from(years).sort((a, b) => b - a)
  }, [reviewHistory])
  const resolveSubjectName = (item: ReviewHistoryItem) => {
    if (item.subject_name && item.subject_name !== "不明") return item.subject_name
    const subjectId = typeof item.subject === "string" ? Number(item.subject) : item.subject
    if (typeof subjectId === "number" && !Number.isNaN(subjectId)) return getSubjectName(subjectId)
    return "不明"
  }
  const formatItemName = (item: ReviewHistoryItem) => {
    const subjectName = resolveSubjectName(item)
    if (item.year) {
      let eraYear = item.year
      let eraPrefix = ""
      if (item.year >= 2019) { eraYear = item.year - 2018; eraPrefix = "R" }
      else if (item.year >= 1989) { eraYear = item.year - 1988; eraPrefix = "H" }
      else { eraYear = item.year - 1925; eraPrefix = "S" }
      return `${eraPrefix}${eraYear}${subjectName}`
    }
    return subjectName
  }
  const formatReviewDate = (dateString: string) => {
    const d = new Date(dateString)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const filteredReviewData = useMemo(() => {
    let filtered = reviewHistory
    if (selectedSubject !== null) {
      const subjectId = getSubjectId(selectedSubject)
      filtered = filtered.filter((item) =>
        subjectId !== null ? item.subject === subjectId : item.subject_name === selectedSubject
      )
    }
    if (selectedYear !== null) filtered = filtered.filter((item) => item.year === selectedYear)
    return filtered
  }, [reviewHistory, selectedSubject, selectedYear])
  const currentReviewData = {
    shihou: filteredReviewData.filter((item) => item.exam_type === "司法試験").map((item) => ({
      id: item.id,
      itemName: formatItemName(item),
      solvedDate: formatReviewDate(item.created_at),
      score: item.score,
      attemptCount: item.attempt_count,
      reviewLink: `/your-page/review/${item.review_id}`,
      subject: resolveSubjectName(item),
      year: item.year,
      examType: item.exam_type,
    })),
    yobi: filteredReviewData.filter((item) => item.exam_type === "予備試験").map((item) => ({
      id: item.id,
      itemName: formatItemName(item),
      solvedDate: formatReviewDate(item.created_at),
      score: item.score,
      attemptCount: item.attempt_count,
      reviewLink: `/your-page/review/${item.review_id}`,
      subject: resolveSubjectName(item),
      year: item.year,
      examType: item.exam_type,
    })),
  }
  const otherReviewData = useMemo(() => {
    return reviewHistory
      .filter((item) => !item.exam_type || (item.exam_type !== "司法試験" && item.exam_type !== "予備試験"))
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatReviewDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      }))
  }, [reviewHistory])
  
  // フィルター時：合計で日付順に並べたリスト（先頭 displayLimitCombined 件を各テーブルに振り分け）
  const combinedReviewList = useMemo(() => {
    const combined: ExamRecord[] = [
      ...currentReviewData.shihou,
      ...currentReviewData.yobi,
      ...otherReviewData,
    ]
    return combined.sort((a, b) => b.solvedDate.localeCompare(a.solvedDate))
  }, [currentReviewData.shihou, currentReviewData.yobi, otherReviewData])
  const displayedCombined = combinedReviewList.slice(0, displayLimitCombined)
  const displayedShihouFiltered = displayedCombined.filter((r) => r.examType === "司法試験")
  const displayedYobiFiltered = displayedCombined.filter((r) => r.examType === "予備試験")
  const displayedOtherFiltered = displayedCombined.filter((r) => r.examType !== "司法試験" && r.examType !== "予備試験")
  
  // フィルター適用後のスレッド
  const filteredThreads = useMemo(() => {
    let filtered = [...threads]
    
    // タイプフィルター
    if (typeFilter !== null) {
      filtered = filtered.filter(thread => thread.type === typeFilter)
    }
    
    // 期間フィルター（last_message_atベース）
    if (startDate) {
      const startStr = startDate.toISOString()
      filtered = filtered.filter(thread => {
        if (!thread.last_message_at) return true // NULLも含める
        return thread.last_message_at >= startStr
      })
    }
    if (endDate) {
      const endStr = endDate.toISOString()
      filtered = filtered.filter(thread => {
        if (!thread.last_message_at) return true // NULLも含める
        return thread.last_message_at <= endStr
      })
    }
    
    // favoriteフィルター
    if (favoriteFilter === "fav-only") {
      filtered = filtered.filter(thread => thread.favorite === 1)
    } else if (favoriteFilter === "fav-except") {
      filtered = filtered.filter(thread => thread.favorite === 0)
    }
    
    // ソート: created_atの新しい順
    filtered.sort((a, b) => {
      const aDate = a.created_at || ""
      const bDate = b.created_at || ""
      return bDate.localeCompare(aDate)
    })
    
    return filtered
  }, [threads, typeFilter, startDate, endDate, favoriteFilter])
  
  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }
  
  // タイプ名の表示
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "free_chat":
        return "フリー"
      case "review_chat":
        return "講評"
      case "short_answer_chat":
        return "短答"
      default:
        return type
    }
  }
  
  // リンク先を取得
  const getThreadLink = async (thread: Thread): Promise<string> => {
    if (thread.type === "free_chat") {
      return `/free-chat/${thread.id}`
    } else if (thread.type === "review_chat") {
      // Reviewを取得してreview_idを取得する必要がある
      // 一旦thread_idベースでリンクを作成（後で修正が必要かも）
      return `/your-page/review/${thread.id}` // 仮のリンク
    } else if (thread.type === "short_answer_chat") {
      return `/short-answer/${thread.id}`
    }
    return "#"
  }
  
  return (
    <Card className="shadow-sm border-amber-200/60">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2 text-amber-900/90">
          <button
            type="button"
            onClick={() => setHistorySubTab("review")}
            className={cn(
              "transition-opacity hover:opacity-100",
              historySubTab === "review" ? "opacity-100" : "opacity-60"
            )}
          >
            講評履歴
          </button>
          <span className="text-amber-700/60 font-normal">/</span>
          <button
            type="button"
            onClick={() => setHistorySubTab("chat")}
            className={cn(
              "transition-opacity hover:opacity-100",
              historySubTab === "chat" ? "opacity-100" : "opacity-60"
            )}
          >
            過去のチャット履歴
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2">
        {historySubTab === "review" ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">科目</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80 bg-gray-100 text-gray-700">
                      {selectedSubject ? (
                        <span className={cn(SUBJECT_COLORS[selectedSubject] && "px-1.5 py-0.5 rounded", SUBJECT_COLORS[selectedSubject] || "")}>
                          {getSubjectShortName(selectedSubject)}
                        </span>
                      ) : (
                        <span>全科目</span>
                      )}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="w-32">
                    <DropdownMenuItem onClick={() => setSelectedSubject(null)} className={cn("text-xs cursor-pointer rounded-sm bg-gray-100 text-gray-700", selectedSubject === null && "ring-2 ring-offset-1 ring-amber-500 font-medium")}>全科目</DropdownMenuItem>
                    {FIXED_SUBJECTS.map((subject) => {
                      const color = SUBJECT_COLORS[subject] || ""
                      return (
                        <DropdownMenuItem key={subject} onClick={() => setSelectedSubject(subject)} className={cn("text-xs cursor-pointer rounded-sm", selectedSubject === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium")}>
                          <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(subject)}</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">年度</span>
                <Select value={selectedYear?.toString() || "all"} onValueChange={(v) => setSelectedYear(v === "all" ? null : parseInt(v))}>
                  <SelectTrigger size="xs" className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">全年度</SelectItem>
                    {availableYears.map((year) => {
                      let eraYear = year >= 2019 ? year - 2018 : year >= 1989 ? year - 1988 : year - 1925
                      let eraPrefix = year >= 2019 ? "R" : year >= 1989 ? "H" : "S"
                      return <SelectItem key={year} value={year.toString()} className="text-xs">{eraPrefix}{eraYear}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {reviewLoading ? (
              <div className="text-center text-muted-foreground py-8">読み込み中...</div>
            ) : isFilterActive ? (
              <div className="space-y-4">
                {displayedShihouFiltered.length > 0 && <ExamTable data={displayedShihouFiltered} title="司法試験" />}
                {displayedYobiFiltered.length > 0 && <ExamTable data={displayedYobiFiltered} title="予備試験" />}
                {displayedOtherFiltered.length > 0 && <ExamTable data={displayedOtherFiltered} title="その他の試験" />}
                {combinedReviewList.length === 0 && (
                  <div className="text-center text-muted-foreground py-6 text-sm">該当する講評履歴がありません</div>
                )}
                {combinedReviewList.length > displayLimitCombined && (
                  <Button variant="ghost" size="sm" className="text-xs text-amber-700 hover:text-amber-900" onClick={() => setDisplayLimitCombined((n) => n + 20)}>
                    さらに20件表示する
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <ExamTable data={currentReviewData.shihou.slice(0, displayLimitShihou)} title="司法試験" />
                  {currentReviewData.shihou.length > displayLimitShihou && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs text-amber-700 hover:text-amber-900" onClick={() => setDisplayLimitShihou((n) => n + 20)}>
                      さらに20件表示する
                    </Button>
                  )}
                </div>
                <div>
                  <ExamTable data={currentReviewData.yobi.slice(0, displayLimitYobi)} title="予備試験" />
                  {currentReviewData.yobi.length > displayLimitYobi && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs text-amber-700 hover:text-amber-900" onClick={() => setDisplayLimitYobi((n) => n + 20)}>
                      さらに20件表示する
                    </Button>
                  )}
                </div>
                <div>
                  <ExamTable data={otherReviewData.slice(0, displayLimitOther)} title="その他の試験" />
                  {otherReviewData.length > displayLimitOther && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs text-amber-700 hover:text-amber-900" onClick={() => setDisplayLimitOther((n) => n + 20)}>
                      さらに20件表示する
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
        {/* フィルター */}
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          {/* タイプ */}
          <Select 
            value={typeFilter || "all"} 
            onValueChange={(value) => {
              if (value === "all") {
                setTypeFilter(null)
              } else {
                setTypeFilter(value)
              }
            }}
          >
            <SelectTrigger size="xs" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">全タイプ</SelectItem>
              <SelectItem value="free_chat" className="text-xs">フリー</SelectItem>
              <SelectItem value="review_chat" className="text-xs">講評</SelectItem>
              <SelectItem value="short_answer_chat" className="text-xs">短答</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 期間 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {startDate ? formatDate(startDate.toISOString()) : "開始日"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <DatePickerCalendar
                selectedDate={startDate || null}
                onSelect={(date) => setStartDate(date || undefined)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">～</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <CalendarIcon className="h-3 w-3 mr-1" />
                {endDate ? formatDate(endDate.toISOString()) : "終了日"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <DatePickerCalendar
                selectedDate={endDate || null}
                onSelect={(date) => setEndDate(date || undefined)}
              />
            </PopoverContent>
          </Popover>
          
          {/* fav */}
          <Select 
            value={favoriteFilter} 
            onValueChange={(value) => {
              setFavoriteFilter(value as "fav-only" | "fav-except" | "all")
            }}
          >
            <SelectTrigger size="xs" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fav-only" className="text-xs">favのみ</SelectItem>
              <SelectItem value="fav-except" className="text-xs">fav以外</SelectItem>
              <SelectItem value="all" className="text-xs">フィルターなし</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <TableHead className="py-1 px-1 text-left font-medium">タイトル</TableHead>
                <TableHead className="py-1 px-1 text-left font-medium">作成日</TableHead>
                <TableHead className="py-1 px-1 text-left font-medium">タイプ</TableHead>
                <TableHead className="py-1 px-1 w-8 text-center font-medium">♡</TableHead>
                <TableHead className="py-1 px-1 text-left font-medium">リンク</TableHead>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                    読み込み中...
                  </TableCell>
                </tr>
              ) : filteredThreads.length === 0 ? (
                <tr>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                    データがありません
                  </TableCell>
                </tr>
              ) : (
                filteredThreads.map((thread) => {
                  // review_chatの場合はreview_idが必須、ない場合はフリーチャットとして開く
                  let link: string
                  if (thread.type === "free_chat") {
                    link = `/free-chat/${thread.id}`
                  } else if (thread.type === "review_chat") {
                    // review_idがある場合はレビューページ、ない場合はフリーチャットとして開く
                    link = thread.review_id 
                      ? `/your-page/review/${thread.review_id}`
                      : `/free-chat/${thread.id}`
                  } else {
                    link = `/short-answer/${thread.id}`
                  }
                  
                  const isEditing = editingThreadId === thread.id
                  
                  return (
                    <tr key={thread.id} className="hover:bg-amber-50/40">
                      <TableCell className="py-1.5 px-1 align-top">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="h-6 text-xs py-0 px-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateTitle(thread.id, editingTitle)
                                } else if (e.key === "Escape") {
                                  setEditingThreadId(null)
                                  setEditingTitle("")
                                }
                              }}
                            />
                            <button
                              onClick={() => updateTitle(thread.id, editingTitle)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingThreadId(null)
                                setEditingTitle("")
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span className="text-xs">{thread.title || "(タイトルなし)"}</span>
                            <button
                              onClick={() => {
                                setEditingThreadId(thread.id)
                                setEditingTitle(thread.title || "")
                              }}
                              className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-1 align-top">
                        <span className="text-xs text-muted-foreground">{formatDate(thread.created_at)}</span>
                      </TableCell>
                      <TableCell className="py-1.5 px-1 align-top">
                        <span className="text-xs">{getTypeLabel(thread.type)}</span>
                      </TableCell>
                      <TableCell className="py-1.5 px-1 w-8 align-top text-center">
                        <button
                          onClick={() => updateFavorite(thread.id, thread.favorite === 1 ? 0 : 1)}
                          className={cn(
                            "text-lg transition-colors",
                            thread.favorite === 1 ? "text-red-500" : "text-gray-300"
                          )}
                        >
                          <Heart className={cn("h-4 w-4", thread.favorite === 1 && "fill-current")} />
                        </button>
                      </TableCell>
                      <TableCell className="py-1.5 px-1 align-top">
                        <a
                          href={link}
                          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          開く
                        </a>
                      </TableCell>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
