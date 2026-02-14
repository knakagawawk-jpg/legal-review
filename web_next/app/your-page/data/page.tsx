"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, History, BookOpen, ChevronDown, ChevronUp, Filter, Menu, Lightbulb, ListTodo, Heart, Calendar as CalendarIcon, Pencil, Check, X, Maximize2, Plus, CalendarDays, Target } from "lucide-react"
import { SortableRow } from "@/components/sortable-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSidebar, SidebarToggle } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId, getSubjectShortName } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { hasFunctionalConsent } from "@/lib/cookie-consent"
import { StudyTimeCard } from "@/components/study-time-card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ItemField } from "@/components/item-field"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar, DatePickerCalendar } from "@/components/ui/calendar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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

interface DashboardItem {
  id: number
  user_id: number
  dashboard_date: string
  entry_type: number  // 1=Point, 2=Task
  subject: number | null
  item: string
  due_date: string | null
  status: number  // 1=未了, 2=作業中, 3=完了, 4=後で
  memo: string | null
  position: number
  favorite: number  // 0=OFF, 1=ON
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface TimerDailyStats {
  study_date: string  // YYYY-MM-DD
  total_seconds: number
  sessions_count: number
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

// 科目と色の対応表（subjectsページと同じ）
const SUBJECT_COLORS: Record<string, string> = {
  "憲法": "bg-red-100 text-red-700",
  "行政法": "bg-rose-100 text-rose-700",
  "民法": "bg-blue-100 text-blue-700",
  "商法": "bg-cyan-100 text-cyan-700",
  "民事訴訟法": "bg-sky-100 text-sky-700",
  "刑法": "bg-green-100 text-green-700",
  "刑事訴訟法": "bg-emerald-100 text-emerald-700",
  "労働法": "bg-indigo-100 text-indigo-700",
  "知的財産法": "bg-teal-100 text-teal-700",
  "倒産法": "bg-violet-100 text-violet-700",
  "租税法": "bg-purple-100 text-purple-700",
  "経済法": "bg-fuchsia-100 text-fuchsia-700",
  "国際関係法（公法系）": "bg-pink-100 text-pink-700",
  "国際関係法（私法系）": "bg-slate-100 text-slate-700",
  "環境法": "bg-lime-100 text-lime-700",
  "国際関係法": "bg-slate-100 text-slate-700",
  "一般教養科目": "bg-gray-100 text-gray-700",
}

// Point行専用のStatusオプション（種類表示用）
const POINT_STATUS_OPTIONS = [
  { value: 1, label: "論文", color: "bg-purple-100 text-purple-700" },
  { value: 2, label: "短答", color: "bg-orange-100 text-orange-700" },
  { value: 3, label: "判例", color: "bg-cyan-100 text-cyan-700" },
  { value: 4, label: "その他", color: "bg-gray-100 text-gray-700" },
]

// Task行専用のStatusオプション
const TASK_STATUS_OPTIONS = [
  { value: 1, label: "未了", color: "bg-slate-100 text-slate-700" },
  { value: 2, label: "作業中", color: "bg-amber-100 text-amber-700" },
  { value: 3, label: "完了", color: "bg-blue-100 text-blue-700" },
  { value: 4, label: "後で", color: "bg-emerald-50 text-emerald-600" },
]

// Memo Field Component（Dashboardから移植）
function MemoField({
  value,
  onChange,
  placeholder = "",
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
}) {
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineHeight = 24 // 1.5rem = 24px
  const maxHeight = 24 * 10 // 10行分: 1.5rem * 10 = 240px

  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return

    if (isFocused) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    } else {
      textareaRef.current.scrollTop = 0

      if (!value || value.trim() === '') {
        textareaRef.current.style.height = '1.5rem'
        textareaRef.current.style.maxHeight = '1.5rem'
        return
      }

      textareaRef.current.style.height = '1.5rem'
      const scrollHeight = textareaRef.current.scrollHeight

      let displayLines = 1
      if (scrollHeight > lineHeight + 1) {
        if (scrollHeight <= lineHeight * 2 + 1) {
          displayLines = 2
        } else if (scrollHeight <= lineHeight * 3 + 1) {
          displayLines = 3
        } else if (scrollHeight <= lineHeight * 4 + 1) {
          displayLines = 4
        } else if (scrollHeight <= lineHeight * 5 + 1) {
          displayLines = 5
        } else if (scrollHeight <= lineHeight * 6 + 1) {
          displayLines = 6
        } else if (scrollHeight <= lineHeight * 7 + 1) {
          displayLines = 7
        } else if (scrollHeight <= lineHeight * 8 + 1) {
          displayLines = 8
        } else if (scrollHeight <= lineHeight * 9 + 1) {
          displayLines = 9
        } else {
          displayLines = 10
        }
      }

      const displayHeight = displayLines * lineHeight
      textareaRef.current.style.height = `${displayHeight}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    }
  }, [isFocused, value, lineHeight, maxHeight])

  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e)
        adjustHeight()
      }}
      onFocus={() => {
        setIsFocused(true)
        adjustHeight()
      }}
      onBlur={() => {
        setIsFocused(false)
        adjustHeight()
      }}
      placeholder={placeholder}
      className="min-h-[1.5rem] text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 resize-none overflow-y-auto"
      style={{ lineHeight: `${lineHeight}px` }}
    />
  )
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

// 勉強管理ページコンポーネント
function StudyManagementPage() {
  const [memoItems, setMemoItems] = useState<DashboardItem[]>([])
  const [topicItems, setTopicItems] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [planLimits, setPlanLimits] = useState<PlanLimitUsage | null>(null)
  
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
  
  // データ取得
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [memoData, topicData, limitsData] = await Promise.all([
        apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=1"),
        apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=2"),
        apiClient.get<PlanLimitUsage>("/api/users/me/plan-limits"),
      ])
      console.log("MEMO data:", memoData)
      console.log("Topics data:", topicData)
      setMemoItems(memoData.items || [])
      setTopicItems(topicData.items || [])
      setPlanLimits(limitsData)
      
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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  
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
  
  // アイテム削除
  const deleteItem = useCallback(async (itemId: number) => {
    try {
      await apiClient.delete(`/api/dashboard/items/${itemId}`)
      await loadData()
    } catch (error) {
      console.error("Failed to delete item:", error)
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
    } else {
      setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, memo } : item))
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
    } else {
      setTopicItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
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
  
  return (
    <div className="space-y-4">
      {/* 講評回数（使用/上限） */}
      <div className="flex justify-end mb-2">
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
      
      {/* 目標達成率（今月の勉強時間カードと同様のレイアウト） */}
      {goalAchievementCardVisible && (
        <div className="rounded-xl border border-amber-200/40 bg-gradient-to-br from-white to-amber-50/30 shadow-md transition-all duration-300">
          <div className="py-3 px-4 border-b border-amber-100/40 flex items-center justify-between bg-gradient-to-r from-amber-50/50 to-transparent">
            <div className="text-sm font-semibold flex items-center gap-2 text-amber-900">
              <Target className="h-5 w-5 text-amber-600" />
              目標達成率
            </div>
            <button
              type="button"
              onClick={() => setGoalAchievementCardVisible(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex gap-8">
              {/* 左側：大きな円グラフ */}
              <div className="flex flex-col items-center justify-start flex-shrink-0">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#fef3c7" strokeWidth="6" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#gradientCircleGoal)"
                      strokeWidth="6"
                      strokeDasharray={`${42 * Math.PI * (72 / 100)}, ${42 * Math.PI * 2}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <defs>
                      <linearGradient id="gradientCircleGoal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold bg-gradient-to-br from-amber-600 to-amber-700 bg-clip-text text-transparent">72%</span>
                    <span className="text-xs text-gray-500 font-medium mt-1">達成</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-lg font-bold text-amber-900">72 / 100</p>
                  <p className="text-xs text-gray-600 mt-0.5">時間</p>
                </div>
              </div>

              {/* 右側：上下に分割 */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {/* 上部：目標達成率、短答、講評（横並び） */}
                <div className="flex gap-1.5">
                  <div style={{ flex: "2" }} className="rounded-lg px-2.5 py-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-blue-900">目標達成率</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs font-bold text-blue-700">72%</span>
                          <span className="text-xs font-bold text-blue-700">18/25</span>
                        </div>
                      </div>
                      <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full"
                          style={{ width: "72%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: "0.8" }} className="rounded-lg px-2.5 py-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-emerald-900">短答実施数</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-700">72%</span>
                          <span className="text-xs font-bold text-emerald-700">18/25</span>
                        </div>
                      </div>
                      <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full"
                          style={{ width: "72%" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: "0.8" }} className="rounded-lg px-2.5 py-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-rose-900">今月の講評</span>
                      <span className="text-xs font-bold text-rose-600 flex-shrink-0">
                        {planLimits?.reviews_used ?? "-"} / {planLimits?.reviews_limit ?? "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 下部：科目別テーブル */}
                <div className="border-t border-amber-100/60 pt-2 mt-2">
                  <div className="text-xs font-semibold flex items-center gap-2 text-amber-900 mb-2">
                    📊 科目別勉強時間
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-50/80 border-y border-amber-200/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-amber-900">科目</th>
                          <th className="px-3 py-2 text-right font-semibold text-amber-900">実績/目標</th>
                          <th className="px-3 py-2 text-center font-semibold text-amber-900">達成度</th>
                          <th className="px-3 py-2 text-center font-semibold text-amber-900">ステータス</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">データがありません</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!goalAchievementCardVisible && (
        <button
          type="button"
          onClick={() => setGoalAchievementCardVisible(true)}
          className="w-full py-2 text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200/40 rounded-lg transition-colors"
        >
          目標達成率を表示
        </button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={createMemoItem}
                className="h-7 text-xs gap-1 bg-transparent px-2"
              >
                <Plus className="h-3 w-3" />
                追加
              </Button>
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
                <button className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                  memoSubjectFilter 
                    ? (SUBJECT_COLORS[memoSubjectFilter] || "bg-amber-100 text-amber-900")
                    : "bg-gray-100 text-gray-700"
                )}>
                  <span>{memoSubjectFilter ? getSubjectShortName(memoSubjectFilter) : "全科目"}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-32">
                <DropdownMenuItem
                  onClick={() => setMemoSubjectFilter(null)}
                  className={cn(
                    "text-xs cursor-pointer rounded-sm",
                    "bg-gray-100 text-gray-700",
                    memoSubjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                  )}
                >
                  全科目
                </DropdownMenuItem>
                {FIXED_SUBJECTS.map((subject) => (
                  <DropdownMenuItem
                    key={subject}
                    onClick={() => setMemoSubjectFilter(subject)}
                    className={cn(
                      "text-xs cursor-pointer rounded-sm",
                      SUBJECT_COLORS[subject] || "bg-gray-100 text-gray-700",
                      memoSubjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                    )}
                  >
                    {getSubjectShortName(subject)}
                  </DropdownMenuItem>
                ))}
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
              <SelectTrigger className="h-7 text-xs w-24">
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
              <SelectTrigger className="h-7 text-xs w-[7.5rem]">
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
          <div 
            ref={memoScrollRef}
            onScroll={handleMemoScroll}
            className="overflow-y-auto"
            style={{ maxHeight: "480px" }} // 20行分（1.5rem * 20）
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
                    <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                    <th className="py-1 px-1 w-[120px] text-left font-medium">項目</th>
                    <th className="py-1 px-0 w-14 text-left font-medium">種類</th>
                    <th className="py-1 px-1 text-left font-medium">メモ</th>
                    <th className="py-1 px-1 w-8 text-center font-medium">♡</th>
                  </tr>
                </thead>
                <SortableContext items={filteredMemoItems.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {loading ? (
                      <tr>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                          読み込み中...
                        </TableCell>
                      </tr>
                    ) : filteredMemoItems.length === 0 ? (
                      <tr>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                          データがありません
                        </TableCell>
                      </tr>
                    ) : (
                      filteredMemoItems.map((item) => {
                    const statusOption = POINT_STATUS_OPTIONS.find((s) => s.value === item.status)
                    const selectedSubject = subjects.find(s => s.id === item.subject)
                    return (
                      <SortableRow key={item.id} item={item} onDelete={deleteItem}>
                        <TableCell className="py-1.5 px-0.5 w-14 align-top">
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
                        <TableCell className="py-1.5 px-1 w-[120px] align-top">
                          <ItemField
                            value={item.item}
                            onChange={(e) => updateItemField(item.id, "item", e.target.value, 1)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-0 w-14 align-top">
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
                        <TableCell className="py-1.5 px-1 align-top">
                          <MemoField
                            value={item.memo || ""}
                            onChange={(e) => updateMemo(item.id, e.target.value, 1)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 w-8 align-top text-center">
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
          </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={createTopicItem}
                className="h-7 text-xs gap-1 bg-transparent px-2"
              >
                <Plus className="h-3 w-3" />
                追加
              </Button>
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
                <button className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                  topicSubjectFilter 
                    ? (SUBJECT_COLORS[topicSubjectFilter] || "bg-amber-100 text-amber-900")
                    : "bg-gray-100 text-gray-700"
                )}>
                  <span>{topicSubjectFilter ? getSubjectShortName(topicSubjectFilter) : "全科目"}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-32">
                <DropdownMenuItem
                  onClick={() => setTopicSubjectFilter(null)}
                  className={cn(
                    "text-xs cursor-pointer rounded-sm",
                    "bg-gray-100 text-gray-700",
                    topicSubjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                  )}
                >
                  全科目
                </DropdownMenuItem>
                {FIXED_SUBJECTS.map((subject) => (
                  <DropdownMenuItem
                    key={subject}
                    onClick={() => setTopicSubjectFilter(subject)}
                    className={cn(
                      "text-xs cursor-pointer rounded-sm",
                      SUBJECT_COLORS[subject] || "bg-gray-100 text-gray-700",
                      topicSubjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                    )}
                  >
                    {getSubjectShortName(subject)}
                  </DropdownMenuItem>
                ))}
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
              <SelectTrigger className="h-7 text-xs w-24">
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
              <SelectTrigger className="h-7 text-xs w-[7.5rem]">
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
          <div 
            ref={topicScrollRef}
            onScroll={handleTopicScroll}
            className="overflow-y-auto"
            style={{ maxHeight: "480px" }} // 20行分（1.5rem * 20）
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
                    <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                    <th className="py-1 px-1 text-left font-medium">項目</th>
                    <th className="py-1 px-1 w-12 text-center font-medium">作成</th>
                    <th className="py-1 px-0 w-14 text-left font-medium">期限</th>
                    <th className="py-1 px-0 w-14 text-left font-medium">状態</th>
                    <th className="py-1 px-1 text-left font-medium">メモ</th>
                    <th className="py-1 px-1 w-8 text-center font-medium">♡</th>
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
                      >
                        <TableCell className="py-1.5 px-0.5 w-14 align-top">
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
                        <TableCell className="py-1.5 px-1 w-[120px] align-top">
                          <ItemField
                            value={item.item}
                            onChange={(e) => updateItemField(item.id, "item", e.target.value, 2)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center relative align-top">
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
                        <TableCell className="py-1.5 px-0 w-14 align-top">
                          {item.due_date ? (
                            <span className="text-xs text-muted-foreground">{formatDate(item.due_date)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-0 w-14 align-top">
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
                        <TableCell className="py-1.5 px-1 align-top">
                          <MemoField
                            value={item.memo || ""}
                            onChange={(e) => updateMemo(item.id, e.target.value, 2)}
                          />
                        </TableCell>
                        <TableCell className="py-1.5 px-1 w-8 align-top text-center">
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
          </div>
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

// 過去のチャット履歴セクションコンポーネント
function ChatHistorySection() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  
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
  
  // データ取得
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
      <CardHeader className="py-1.5 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-amber-900/80">
          過去のチャット履歴
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2">
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
            <SelectTrigger className="h-7 text-xs w-24">
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
            <SelectTrigger className="h-7 text-xs w-[7.5rem]">
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
      </CardContent>
    </Card>
  )
}

function HistoryPage() {
  const { isOpen, setIsOpen, mainContentStyle } = useSidebar()
  const [mainTab, setMainTab] = useState<"study" | "past-questions">("study")
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)  // null = 全科目
  const [selectedYear, setSelectedYear] = useState<number | null>(null)  // null = 全年度

  useEffect(() => {
    const loadReviewHistory = async () => {
      try {
        setLoading(true)
        // 全科目を取得（フィルターはクライアント側で行う）
        const data = await apiClient.get<ReviewHistoryItem[]>(
          `/api/review-history`
        )
        setReviewHistory(data)
      } catch (error) {
        console.error("Failed to load review history:", error)
        setReviewHistory([])
      } finally {
        setLoading(false)
      }
    }

    if (mainTab === "past-questions") {
      loadReviewHistory()
    }
  }, [mainTab])

  // 利用可能な年度のリストを取得
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    reviewHistory.forEach((item) => {
      if (item.year !== null) {
        years.add(item.year)
      }
    })
    return Array.from(years).sort((a, b) => b - a)  // 降順
  }, [reviewHistory])

  // フィルター適用後のデータ
  const filteredData = useMemo(() => {
    let filtered = reviewHistory

    // 科目フィルター
    if (selectedSubject !== null) {
      const subjectId = getSubjectId(selectedSubject)
      filtered = filtered.filter((item) => {
        if (subjectId !== null) {
          return item.subject === subjectId
        }
        return item.subject_name === selectedSubject
      })
    }

    // 年度フィルター
    if (selectedYear !== null) {
      filtered = filtered.filter((item) => item.year === selectedYear)
    }

    return filtered
  }, [reviewHistory, selectedSubject, selectedYear])

  // データを試験種別ごとに分類
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const resolveSubjectName = (item: ReviewHistoryItem) => {
    if (item.subject_name && item.subject_name !== "不明") {
      return item.subject_name
    }
    const subjectId = typeof item.subject === "string" ? Number(item.subject) : item.subject
    if (typeof subjectId === "number" && !Number.isNaN(subjectId)) {
      return getSubjectName(subjectId)
    }
    return "不明"
  }

  const formatItemName = (item: ReviewHistoryItem) => {
    // 科目名を取得
    let subjectName: string
    if (item.exam_type === "司法試験" || item.exam_type === "予備試験") {
      // 司法試験・予備試験の場合は、subject_idから積極的に科目名を取得
      // subject_nameが「不明」の場合はsubject_idから再計算
      subjectName = resolveSubjectName(item)
    } else {
      // その他の試験の場合は従来通り
      subjectName = resolveSubjectName(item)
    }
    
    if (item.year) {
      // 年度から元号記号を計算（2019年以降はR、1989年以降はH）
      let eraYear = item.year
      let eraPrefix = ""
      if (item.year >= 2019) {
        eraYear = item.year - 2018
        eraPrefix = "R"
      } else if (item.year >= 1989) {
        eraYear = item.year - 1988
        eraPrefix = "H"
      } else {
        eraYear = item.year - 1925
        eraPrefix = "S"
      }
      return `${eraPrefix}${eraYear}${subjectName}`
    }
    return subjectName
  }

  // フィルター適用後のデータ（司法試験・予備試験）
  const currentData = {
    shihou: filteredData
      .filter((item) => item.exam_type === "司法試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      })),
    yobi: filteredData
      .filter((item) => item.exam_type === "予備試験")
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      })),
  }

  // 「その他」はフィルターに関わらず常に全データから抽出
  const otherData = useMemo(() => {
    return reviewHistory
      .filter((item) => !item.exam_type || (item.exam_type !== "司法試験" && item.exam_type !== "予備試験"))
      .map((item) => ({
        id: item.id,
        itemName: formatItemName(item),
        solvedDate: formatDate(item.created_at),
        score: item.score,
        attemptCount: item.attempt_count,
        reviewLink: `/your-page/review/${item.review_id}`,
        subject: resolveSubjectName(item),
        year: item.year,
        examType: item.exam_type,
      }))
  }, [reviewHistory])

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300"
      style={mainContentStyle}
    >
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-3 max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SidebarToggle />
              <History className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Data</h1>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={mainTab} onValueChange={(v) => {
                if (v === "study" || v === "past-questions") {
                  setMainTab(v)
                }
              }}>
                <TabsList className="inline-flex w-max h-8 bg-amber-100/60 p-0.5">
                  <TabsTrigger
                    value="study"
                    className="text-xs px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm flex items-center gap-1.5"
                  >
                    <BookOpen className="h-3 w-3" />
                    勉強管理
                  </TabsTrigger>
                  <TabsTrigger
                    value="past-questions"
                    className="text-xs px-2.5 py-1 data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-sm flex items-center gap-1.5"
                  >
                    <BookOpen className="h-3 w-3" />
                    過去問管理
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 max-w-7xl">
        {mainTab === "study" && (
          <StudyManagementPage />
        )}

        {mainTab === "past-questions" && (
          <>
            {/* フィルター（ヘッダーの下） */}
            <div className="mb-4 flex items-center gap-3">
              {/* 科目フィルター */}
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">科目</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                      selectedSubject 
                        ? (SUBJECT_COLORS[selectedSubject] || "bg-amber-100 text-amber-900")
                        : "bg-gray-100 text-gray-700"
                    )}>
                      <span>{selectedSubject ? getSubjectShortName(selectedSubject) : "全科目"}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="bottom" className="w-32">
                    <DropdownMenuItem
                      onClick={() => setSelectedSubject(null)}
                      className={cn(
                        "text-xs cursor-pointer rounded-sm",
                        "bg-gray-100 text-gray-700",
                        selectedSubject === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                      )}
                    >
                      全科目
                    </DropdownMenuItem>
                    {FIXED_SUBJECTS.map((subject) => (
                      <DropdownMenuItem
                        key={subject}
                        onClick={() => setSelectedSubject(subject)}
                        className={cn(
                          "text-xs cursor-pointer rounded-sm",
                          SUBJECT_COLORS[subject] || "bg-gray-100 text-gray-700",
                          selectedSubject === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                        )}
                      >
                        {getSubjectShortName(subject)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* 年度フィルター */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">年度</span>
                <Select 
                  value={selectedYear?.toString() || "all"} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedYear(null)
                    } else {
                      setSelectedYear(parseInt(value))
                    }
                  }}
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">全年度</SelectItem>
                    {availableYears.map((year) => {
                      // 年度を元号表記に変換
                      let eraYear = year
                      let eraPrefix = ""
                      if (year >= 2019) {
                        eraYear = year - 2018
                        eraPrefix = "R"
                      } else if (year >= 1989) {
                        eraYear = year - 1988
                        eraPrefix = "H"
                      } else {
                        eraYear = year - 1925
                        eraPrefix = "S"
                      }
                      return (
                        <SelectItem key={year} value={year.toString()} className="text-xs">
                          {eraPrefix}{eraYear}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="shadow-sm border-amber-200/60">
              <CardContent className="p-4 space-y-4">
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">読み込み中...</div>
                ) : (
                  <>
                    <ExamTable data={currentData.shihou} title="司法試験" />
                    <ExamTable data={currentData.yobi} title="予備試験" />
                    <ExamTable data={otherData} title="その他の試験" />
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default withAuth(HistoryPage, { requireAuth: true })
