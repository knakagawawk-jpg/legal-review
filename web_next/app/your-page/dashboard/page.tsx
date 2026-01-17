"use client"

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Lightbulb, ListTodo, RotateCcw, Clock, ChevronDown, Sparkles, Calendar as CalendarIcon, GripVertical, Trash2, Plus, CalendarDays } from "lucide-react"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { withAuth } from "@/components/auth/with-auth"
import { Calendar, DatePickerCalendar } from "@/components/ui/calendar"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

interface Subject {
  id: number
  name: string
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
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface TimerSession {
  id: string
  started_at: string  // ISO datetime string
  ended_at: string | null  // ISO datetime string or null
  status: "running" | "stopped"
  stop_reason?: string
}

interface TimerDailyStats {
  study_date: string  // YYYY-MM-DD
  total_seconds: number
  sessions_count: number
}

const STATUS_OPTIONS = [
  { value: 1, label: "未了", color: "bg-slate-100 text-slate-700" },
  { value: 2, label: "作業中", color: "bg-amber-100 text-amber-700" },
  { value: 3, label: "完了", color: "bg-blue-100 text-blue-700" },
  { value: 4, label: "後で", color: "bg-emerald-50 text-emerald-600" },
]

// Point行専用のStatusオプション（種類表示用）
const POINT_STATUS_OPTIONS = [
  { value: 1, label: "論文", color: "bg-purple-100 text-purple-700" },
  { value: 2, label: "短答", color: "bg-orange-100 text-orange-700" },
  { value: 3, label: "判例", color: "bg-cyan-100 text-cyan-700" },
  { value: 4, label: "その他", color: "bg-gray-100 text-gray-700" },
]

// Sortable Row Component
function SortableRow({
  item,
  children,
  entryType,
  onDelete,
  onEditCreatedDate,
}: {
  item: DashboardItem
  children: React.ReactNode
  entryType: number
  onDelete: (id: number) => void
  onEditCreatedDate?: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() })
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const clickStartPos = useRef<{ x: number; y: number } | null>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showMenu])

  // Handle mouse down to track click position
  const handleMouseDown = (e: React.MouseEvent) => {
    clickStartPos.current = { x: e.clientX, y: e.clientY }
  }

  // Handle click on drag handle
  const handleClick = (e: React.MouseEvent) => {
    // マウスが動いていない場合（クリック）のみメニューを表示
    if (clickStartPos.current) {
      const deltaX = Math.abs(e.clientX - clickStartPos.current.x)
      const deltaY = Math.abs(e.clientY - clickStartPos.current.y)
      if (deltaX < 5 && deltaY < 5) {
        e.stopPropagation()
        e.preventDefault()
        setShowMenu(true)
      }
      clickStartPos.current = null
    }
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/50 hover:bg-amber-50/30 transition-colors ${isDragging ? "opacity-50 bg-amber-50" : ""}`}
    >
      <TableCell className="py-1.5 px-1 w-6 relative">
        <button
          {...attributes}
          {...listeners}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        {showMenu && (
          <div 
            ref={menuRef}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-10 flex gap-1 bg-card border rounded shadow-lg p-1"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDelete(item.id)
                setShowMenu(false)
              }}
              className="h-6 w-6 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              title="削除"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            {onEditCreatedDate && (entryType === 2 || entryType === 3) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onEditCreatedDate(item.id)
                  setShowMenu(false)
                }}
                className="h-6 w-6 bg-muted hover:bg-muted/80"
                title="作成日の編集"
              >
                <CalendarDays className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
      {children}
    </TableRow>
  )
}

function YourPageDashboardInner() {
  const { isOpen } = useSidebar()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [revisitTab, setRevisitTab] = useState<"7days" | "whole">("7days")
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [isTimerToggling, setIsTimerToggling] = useState(false) // タイマー操作中のフラグ
  const [timerDetailsOpen, setTimerDetailsOpen] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // Timer session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSessionStartTime, setActiveSessionStartTime] = useState<Date | null>(null)
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([])
  const [timerDailyStats, setTimerDailyStats] = useState<TimerDailyStats | null>(null)
  
  // Dashboard items
  const [points, setPoints] = useState<DashboardItem[]>([])
  const [tasks, setTasks] = useState<DashboardItem[]>([])
  const [leftItems, setLeftItems] = useState<DashboardItem[]>([])
  
  // Draft state for empty rows (key: rowKey, value: draft data)
  const [draftRows, setDraftRows] = useState<Record<string, Partial<DashboardItem>>>({})
  
  // Popover open state for date pickers (key: itemId, value: boolean)
  const [datePickerOpen, setDatePickerOpen] = useState<Record<number, boolean>>({})
  
  // Popover open state for created date pickers (key: itemId, value: boolean)
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  
  // Calculate empty rows count based on data length
  const getEmptyRowsCount = (dataLength: number) => {
    if (dataLength === 0) return 2
    if (dataLength === 1) return 1
    return 0
  }
  
  // Get empty rows for Points
  const emptyPointsRowsCount = getEmptyRowsCount(points.length)
  const emptyPointsRows = Array.from({ length: emptyPointsRowsCount }, (_, i) => i)
  
  // Get empty rows for Tasks
  const emptyTasksRowsCount = getEmptyRowsCount(tasks.length)
  const emptyTasksRows = Array.from({ length: emptyTasksRowsCount }, (_, i) => i)
  
  // Subjects
  const [subjects, setSubjects] = useState<Subject[]>([])
  
  // Current date (YYYY-MM-DD) - URLクエリパラメータから取得、なければ今日の日付
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get("date")
    if (dateParam) {
      // 日付形式を検証
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (dateRegex.test(dateParam)) {
        return dateParam
      }
    }
    const now = new Date()
    const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
    return jstDate.toISOString().split("T")[0]
  })
  
  // URLクエリパラメータの変更を監視
  useEffect(() => {
    const dateParam = searchParams.get("date")
    if (dateParam) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (dateRegex.test(dateParam)) {
        setCurrentDate(dateParam)
      }
    }
  }, [searchParams])
  
  // Debounce save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaves = useRef<Set<number>>(new Set())
  
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

  // Get study date (4:00 boundary)
  const getStudyDate = (date: Date = new Date()): string => {
    const jstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
    const hours = jstDate.getHours()
    const studyDate = new Date(jstDate)
    if (hours < 4) {
      studyDate.setDate(studyDate.getDate() - 1)
    }
    return studyDate.toISOString().split("T")[0]
  }

  // Calculate running seconds for today (4:00 boundary)
  const calculateRunningSeconds = (): number => {
    if (!activeSessionStartTime) return 0
    
    const now = new Date()
    const studyDate = getStudyDate()
    const todayStart = new Date(`${studyDate}T04:00:00+09:00`)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    
    const sessionStart = new Date(activeSessionStartTime)
    const sessionEnd = now
    
    const overlapStart = sessionStart > todayStart ? sessionStart : todayStart
    const overlapEnd = sessionEnd < todayEnd ? sessionEnd : todayEnd
    
    if (overlapStart >= overlapEnd) return 0
    
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000)
  }

  // Calculate total display seconds
  const calculateTotalDisplaySeconds = (): number => {
    const confirmedSeconds = timerDailyStats?.total_seconds || 0
    const runningSeconds = timerEnabled && activeSessionStartTime ? calculateRunningSeconds() : 0
    return confirmedSeconds + runningSeconds
  }

  // Format time in minutes (floor)
  const formatTimeInMinutes = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分`
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

  // Format date for display (M/D)
  const formatDate = (date: Date) => {
    const days = ["日", "月", "火", "水", "木", "金", "土"]
    return `${date.getMonth() + 1}/${date.getDate()}（${days[date.getDay()]}）`
  }

  // Format due date for display (M/D)
  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return "--"
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // Get formatted created date (M/D)
  const getFormattedCreatedDate = () => {
    const now = new Date()
    return `${now.getMonth() + 1}/${now.getDate()}`
  }

  // Load subjects
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await apiClient.get<Subject[]>("/api/dashboard/subjects")
        setSubjects(data)
      } catch (error) {
        console.error("Failed to load subjects:", error)
      }
    }
    loadSubjects()
  }, [])

  // Load timer data
  const loadTimerData = useCallback(async () => {
    // タイマー操作中は状態を上書きしない
    if (isTimerToggling) {
      return
    }
    
    try {
      const studyDate = getStudyDate()
      const stats = await apiClient.get<TimerDailyStats>(`/api/timer/daily-stats?study_date=${studyDate}`)
      const sessions = await apiClient.get<TimerSession[]>(`/api/timer/sessions?study_date=${studyDate}`)
      setTimerDailyStats(stats)
      setTimerSessions(sessions)
      
      // runningセッションを検出して状態を設定
      const runningSession = sessions.find(s => s.status === "running")
      if (runningSession) {
        setActiveSessionId(runningSession.id)
        setActiveSessionStartTime(new Date(runningSession.started_at))
        setTimerEnabled(true)
      } else {
        setActiveSessionId(null)
        setActiveSessionStartTime(null)
        setTimerEnabled(false)
      }
    } catch (error) {
      console.error("Failed to load timer data:", error)
      // エラー時は空のデータを設定（操作中でない場合のみ）
      if (!isTimerToggling) {
        const studyDate = getStudyDate()
        setTimerDailyStats({ study_date: studyDate, total_seconds: 0, sessions_count: 0 })
        setTimerSessions([])
        setActiveSessionId(null)
        setActiveSessionStartTime(null)
        setTimerEnabled(false)
      }
    }
  }, [isTimerToggling])

  useEffect(() => {
    loadTimerData()
  }, [loadTimerData])

  // Handle timer start
  const handleTimerStart = async () => {
    const response = await apiClient.post<{
      active_session_id: string
      study_date: string
      confirmed_total_seconds: number
      active_started_at_utc: string
      daily_stats: TimerDailyStats
      sessions: TimerSession[]
    }>("/api/timer/start", {})
    
    setActiveSessionId(response.active_session_id)
    setActiveSessionStartTime(new Date(response.active_started_at_utc))
    setTimerDailyStats(response.daily_stats)
    setTimerSessions(response.sessions)
    setElapsedTime(0)
    // setTimerEnabledはhandleTimerToggleで管理するため、ここでは呼び出さない
  }

  // Handle timer stop
  const handleTimerStop = async () => {
    if (!activeSessionId) {
      throw new Error("アクティブなセッションがありません")
    }
    
    const response = await apiClient.post<{
      study_date: string
      confirmed_total_seconds: number
      daily_stats: TimerDailyStats
      sessions: TimerSession[]
    }>(`/api/timer/stop/${activeSessionId}`, {})
    
    setTimerDailyStats(response.daily_stats)
    setTimerSessions(response.sessions)
    setActiveSessionId(null)
    setActiveSessionStartTime(null)
    // setTimerEnabledはhandleTimerToggleで管理するため、ここでは呼び出さない
  }

  // Handle timer toggle
  const handleTimerToggle = async (enabled: boolean) => {
    setIsTimerToggling(true)
    // 楽観的更新: すぐに状態を更新
    setTimerEnabled(enabled)
    try {
      if (enabled) {
        await handleTimerStart()
      } else {
        await handleTimerStop()
      }
      // 成功時は状態を確定（既に楽観的更新で設定済み）
    } catch (error) {
      console.error("Failed to toggle timer:", error)
      // エラー時は状態を元に戻す
      setTimerEnabled(!enabled)
    } finally {
      // 操作完了後、少し遅延してフラグを解除（loadTimerDataの再実行を許可）
      setTimeout(() => {
        setIsTimerToggling(false)
      }, 500)
    }
  }

  // Load dashboard items
  const loadDashboardItems = useCallback(async () => {
    try {
      // Load Points
      const pointsData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items?dashboard_date=${currentDate}&entry_type=1`
      )
      setPoints(pointsData.items)

      // Load Tasks
      const tasksData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items?dashboard_date=${currentDate}&entry_type=2`
      )
      setTasks(tasksData.items)

      // Load Left items
      const leftData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items/left?dashboard_date=${currentDate}&period=${revisitTab}`
      )
      setLeftItems(leftData.items)
    } catch (error) {
      console.error("Failed to load dashboard items:", error)
    }
  }, [currentDate, revisitTab])

  useEffect(() => {
    loadDashboardItems()
  }, [loadDashboardItems])

  // Debounced save function
  const debouncedSave = useCallback((itemId: number, updateData: Partial<DashboardItem>) => {
    pendingSaves.current.add(itemId)
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await apiClient.put(`/api/dashboard/items/${itemId}`, updateData)
        pendingSaves.current.delete(itemId)
        // Reload to get updated data
        loadDashboardItems()
      } catch (error) {
        console.error("Failed to save item:", error)
        pendingSaves.current.delete(itemId)
      }
    }, 30000) // 30 seconds
  }, [loadDashboardItems])

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save all pending changes synchronously
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      // Force save all pending items
      const pendingIds = Array.from(pendingSaves.current)
      for (const itemId of pendingIds) {
        // Use sendBeacon for reliable unload saving
        const item = [...points, ...tasks, ...leftItems].find(i => i.id === itemId)
        if (item) {
          const updateData: Record<string, any> = {}
          // Get the latest state - this is a simplified version
          // In production, track changes more carefully
          navigator.sendBeacon(
            `/api/dashboard/items/${itemId}`,
            new Blob([JSON.stringify(updateData)], { type: 'application/json' })
          )
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [points, tasks, leftItems])

  // Create new item
  const createItem = async (entryType: number) => {
    try {
      const newItem = await apiClient.post<DashboardItem>("/api/dashboard/items", {
        dashboard_date: currentDate,
        entry_type: entryType,
        item: "",
        status: 1,
        position: null, // Auto-assign
        created_at: new Date().toISOString().split("T")[0], // Set created date
      })
      // Reload items to get the new item
      await loadDashboardItems()
      return newItem
    } catch (error) {
      console.error("Failed to create item:", error)
      return undefined
    }
  }

  // Delete item
  const deleteItem = async (itemId: number) => {
    try {
      await apiClient.delete(`/api/dashboard/items/${itemId}`)
      loadDashboardItems()
    } catch (error) {
      console.error("Failed to delete item:", error)
    }
  }

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px移動するまでドラッグを開始しない（クリックと区別するため）
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for Points
  const handleDragEndPoints = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = points.findIndex((item) => item.id.toString() === active.id)
      const newIndex = points.findIndex((item) => item.id.toString() === over.id)

      const newItems = arrayMove(points, oldIndex, newIndex)
      setPoints(newItems)

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
        // Use PUT to update position
        await apiClient.put(`/api/dashboard/items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder item:", error)
        loadDashboardItems() // Revert on error
      }
    }
  }

  // Handle drag end for Tasks
  const handleDragEndTasks = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((item) => item.id.toString() === active.id)
      const newIndex = tasks.findIndex((item) => item.id.toString() === over.id)

      const newItems = arrayMove(tasks, oldIndex, newIndex)
      setTasks(newItems)

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
        // Use PUT to update position
        await apiClient.put(`/api/dashboard/items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder item:", error)
        loadDashboardItems() // Revert on error
      }
    }
  }

  // Handle drag end for Left items
  const handleDragEndLeftItems = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = leftItems.findIndex((item) => item.id.toString() === active.id)
      const newIndex = leftItems.findIndex((item) => item.id.toString() === over.id)

      const newItems = arrayMove(leftItems, oldIndex, newIndex)
      setLeftItems(newItems)

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
        // Use PUT to update position
        await apiClient.put(`/api/dashboard/items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder item:", error)
        loadDashboardItems() // Revert on error
      }
    }
  }

  // Update item field
  const updateItemField = (item: DashboardItem, field: keyof DashboardItem, value: any) => {
    const updateData = { [field]: value }
    debouncedSave(item.id, updateData)
    
    // Optimistic update
    if (item.entry_type === 1) {
      setPoints(prev => prev.map(p => p.id === item.id ? { ...p, [field]: value } : p))
    } else if (item.dashboard_date === currentDate) {
      setTasks(prev => prev.map(t => t.id === item.id ? { ...t, [field]: value } : t))
    } else {
      // Left欄の項目を更新した場合
      setLeftItems(prev => prev.map(l => l.id === item.id ? { ...l, [field]: value } : l))
    }
  }

  // Render table row for Point
  const renderPointRow = (item: DashboardItem) => {
    const statusOption = POINT_STATUS_OPTIONS.find((s) => s.value === item.status)
    return (
      <SortableRow key={item.id} item={item} entryType={1} onDelete={deleteItem}>
        <TableCell className="py-1.5 px-0.5 w-14">
          <Select
            value={item.subject?.toString() || undefined}
            onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
          >
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-1.5 px-1 w-60">
          <Input
            value={item.item}
            onChange={(e) => updateItemField(item, "item", e.target.value)}
            placeholder="項目を入力..."
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
        <TableCell className="py-1.5 px-0 w-14">
          <Select
            value={item.status.toString()}
            onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
              <SelectValue />
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
        <TableCell className="py-1.5 px-1">
          <Input
            value={item.memo || ""}
            onChange={(e) => updateItemField(item, "memo", e.target.value)}
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
      </SortableRow>
    )
  }

  // Render table row for Task
  const renderTaskRow = (item: DashboardItem) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === item.status)
    const createdDate = item.created_at ? formatDueDate(item.created_at) : getFormattedCreatedDate()
    return (
      <SortableRow 
        key={item.id} 
        item={item} 
        entryType={2} 
        onDelete={deleteItem}
        onEditCreatedDate={(id) => {
          setCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
        }}
      >
        <TableCell className="py-1.5 px-0.5 w-14">
          <Select
            value={item.subject?.toString() || undefined}
            onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
          >
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-1.5 px-1">
          <Input
            value={item.item}
            onChange={(e) => updateItemField(item, "item", e.target.value)}
            placeholder="項目を入力..."
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
        <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center relative">
          <Popover 
            open={createdDatePickerOpen[item.id] || false} 
            onOpenChange={(open) => setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}
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
                    updateItemField(item, "created_at", dateStr)
                  }
                  setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                }}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="py-1.5 px-0 w-14">
          <Popover open={datePickerOpen[item.id] || false} onOpenChange={(open) => setDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 w-full justify-start text-xs px-1 font-normal border-0 hover:bg-muted/50"
              >
                {item.due_date ? formatDueDate(item.due_date) : <span className="text-muted-foreground">--</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <DatePickerCalendar
                selectedDate={item.due_date ? new Date(item.due_date) : null}
                onSelect={(date) => {
                  if (date) {
                    const dateStr = date.toISOString().split("T")[0]
                    updateItemField(item, "due_date", dateStr)
                  } else {
                    updateItemField(item, "due_date", null)
                  }
                  setDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                }}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="py-1.5 px-0 w-14">
          <Select
            value={item.status.toString()}
            onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-1.5 px-1">
          <Input
            value={item.memo || ""}
            onChange={(e) => updateItemField(item, "memo", e.target.value)}
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
      </SortableRow>
    )
  }

  // Render table row for Left item
  const renderLeftRow = (item: DashboardItem) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === item.status)
    const createdDate = item.dashboard_date ? formatDueDate(item.dashboard_date) : getFormattedCreatedDate()
    return (
      <SortableRow 
        key={item.id} 
        item={item} 
        entryType={3} 
        onDelete={deleteItem}
        onEditCreatedDate={(id) => {
          setCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
        }}
      >
        <TableCell className="py-1.5 px-0.5 w-14">
          <Select
            value={item.subject?.toString() || undefined}
            onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
          >
            <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-1.5 px-1">
          <Input
            value={item.item}
            onChange={(e) => updateItemField(item, "item", e.target.value)}
            placeholder="項目を入力..."
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
        <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center relative">
          <Popover 
            open={createdDatePickerOpen[item.id] || false} 
            onOpenChange={(open) => setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}
          >
            <PopoverTrigger asChild>
              <button className="w-full h-full hover:bg-muted/50 rounded px-1">
                {createdDate}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <DatePickerCalendar
                selectedDate={item.dashboard_date ? new Date(item.dashboard_date) : null}
                onSelect={(date) => {
                  if (date) {
                    const dateStr = date.toISOString().split("T")[0]
                    updateItemField(item, "dashboard_date", dateStr)
                  }
                  setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                }}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="py-1.5 px-0 w-14">
          <Popover open={datePickerOpen[item.id] || false} onOpenChange={(open) => setDatePickerOpen(prev => ({ ...prev, [item.id]: open }))}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 w-full justify-start text-xs px-1 font-normal border-0 hover:bg-muted/50"
              >
                {item.due_date ? formatDueDate(item.due_date) : <span className="text-muted-foreground">--</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <DatePickerCalendar
                selectedDate={item.due_date ? new Date(item.due_date) : null}
                onSelect={(date) => {
                  if (date) {
                    const dateStr = date.toISOString().split("T")[0]
                    updateItemField(item, "due_date", dateStr)
                  } else {
                    updateItemField(item, "due_date", null)
                  }
                  setDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                }}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="py-1.5 px-0 w-14">
          <Select
            value={item.status.toString()}
            onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
          >
            <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="py-1.5 px-1">
          <Input
            value={item.memo || ""}
            onChange={(e) => updateItemField(item, "memo", e.target.value)}
            className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
          />
        </TableCell>
      </SortableRow>
    )
  }

  // Render empty row (draft row)
  const renderEmptyRow = (entryType: number, index: number) => {
    const rowKey = `${entryType}-${index}`
    const draft = draftRows[rowKey] || {}
    
    // Update draft state
    const updateDraft = (field: string, value: any) => {
      setDraftRows(prev => ({
        ...prev,
        [rowKey]: {
          ...prev[rowKey],
          [field]: value,
        }
      }))
    }
    
    // Check if draft has valid data (item or memo is not empty)
    const hasValidDraft = () => {
      const item = draft.item
      const memo = draft.memo
      return (item && item.trim() !== '') || (memo && memo.trim() !== '')
    }
    
    // Confirm draft and create item
    const confirmDraft = async () => {
      if (!hasValidDraft()) {
        // Cancel draft if empty
        setDraftRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[rowKey]
          return newDraft
        })
        return
      }
      
      try {
        const newItem = await apiClient.post<DashboardItem>("/api/dashboard/items", {
          dashboard_date: currentDate,
          entry_type: entryType,
          item: draft.item || "",
          subject: draft.subject || null,
          status: draft.status || 1,
          memo: draft.memo || null,
          due_date: draft.due_date || null,
          position: null,
          created_at: new Date().toISOString().split("T")[0],
        })
        
        // Remove draft
        setDraftRows(prev => {
          const newDraft = { ...prev }
          delete newDraft[rowKey]
          return newDraft
        })
        
        // Reload items
        await loadDashboardItems()
      } catch (error) {
        console.error("Failed to create item from draft:", error)
        // Keep draft on error for retry
      }
    }
    
    // Handle blur (focus out)
    const handleBlur = () => {
      confirmDraft()
    }
    
    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        confirmDraft()
      }
    }

    if (entryType === 1) {
      // Point empty row
      return (
        <TableRow key={`empty-point-${index}`}>
          <TableCell className="py-1.5 px-1 w-6"></TableCell>
          <TableCell className="py-1.5 px-0.5 w-14">
            <Select
              value={draft.subject?.toString() || undefined}
              onValueChange={(value) => updateDraft("subject", value ? parseInt(value) : null)}
              onOpenChange={(open) => {
                if (!open) {
                  // Blur when select closes
                  setTimeout(handleBlur, 100)
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
                <SelectValue placeholder="--" />
              </SelectTrigger>
              <SelectContent>
                {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-1.5 px-1 w-60">
            <Input
              value={draft.item || ""}
              onChange={(e) => updateDraft("item", e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="項目を入力..."
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Select
              value={draft.status?.toString() || undefined}
              onValueChange={(value) => updateDraft("status", parseInt(value))}
              onOpenChange={(open) => {
                if (!open) {
                  // Blur when select closes
                  setTimeout(handleBlur, 100)
                }
              }}
            >
              <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
                <SelectValue placeholder="論文" />
              </SelectTrigger>
              <SelectContent>
                {POINT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-1.5 px-1">
            <Input
              value={draft.memo || ""}
              onChange={(e) => updateDraft("memo", e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
        </TableRow>
      )
    } else {
      // Task empty row
      return (
        <TableRow key={`empty-task-${index}`}>
          <TableCell className="py-1.5 px-1 w-6"></TableCell>
          <TableCell className="py-1.5 px-0.5 w-14">
            <Select
              value={draft.subject?.toString() || undefined}
              onValueChange={(value) => updateDraft("subject", value ? parseInt(value) : null)}
              onOpenChange={(open) => {
                if (!open) {
                  // Blur when select closes
                  setTimeout(handleBlur, 100)
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-14">
                <SelectValue placeholder="--" />
              </SelectTrigger>
              <SelectContent>
                {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-1.5 px-1">
            <Input
              value={draft.item || ""}
              onChange={(e) => updateDraft("item", e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="項目を入力..."
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
          <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center">
            {getFormattedCreatedDate()}
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 w-full justify-start text-xs px-1 font-normal border-0 hover:bg-muted/50 text-muted-foreground"
                >
                  {draft.due_date ? formatDueDate(draft.due_date) : "--"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <DatePickerCalendar
                  selectedDate={draft.due_date ? new Date(draft.due_date) : null}
                  onSelect={(date) => {
                    if (date) {
                      const dateStr = date.toISOString().split("T")[0]
                      updateDraft("due_date", dateStr)
                    } else {
                      updateDraft("due_date", null)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Select
              value={draft.status?.toString() || undefined}
              onValueChange={(value) => updateDraft("status", parseInt(value))}
              onOpenChange={(open) => {
                if (!open) {
                  // Blur when select closes
                  setTimeout(handleBlur, 100)
                }
              }}
            >
              <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-14">
                <SelectValue placeholder="未了" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-1.5 px-1">
            <Input
              value={draft.memo || ""}
              onChange={(e) => updateDraft("memo", e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
        </TableRow>
      )
    }
  }

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-background transition-all duration-300", isOpen && "ml-52")}>
      <div className="container mx-auto px-20 py-3 max-w-6xl">
        {/* Header */}
        <header className="mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left side - Title and greeting */}
            <div>
              <div className="flex items-center gap-3">
                <SidebarToggle />
                <div className="relative">
                  <h1 className="text-3xl font-light tracking-wider text-foreground">
                    <span className="font-bold">Dash</span>
                    <span className="text-amber-500 font-medium">board</span>
                  </h1>
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-transparent rounded-full" />
                </div>
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 mt-1.5 ml-12">
                <span className="text-xs text-muted-foreground font-light tracking-wide">{getGreeting()}</span>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs font-medium text-foreground">{formatDate(selectedDate)}</span>
              </div>
            </div>

            {/* Right side - Timer control */}
            <div className="flex flex-col items-start sm:items-end gap-1.5">
              <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border shadow-sm">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <Switch
                  id="timer-switch"
                  checked={timerEnabled}
                  onCheckedChange={handleTimerToggle}
                  className="scale-90"
                />
                <span className="text-xs font-medium min-w-[60px] text-right">
                  {formatTimeDisplay(calculateTotalDisplaySeconds())}
                </span>
                {timerEnabled ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">勉強中</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">休憩中</span>
                )}
              </div>

              <Collapsible open={timerDetailsOpen} onOpenChange={setTimerDetailsOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <span>詳細</span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", timerDetailsOpen && "rotate-180")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  <div className="bg-card border rounded px-3 py-2 shadow-sm">
                    <div className="border-t pt-2 mt-2">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">今日のログ</p>
                      <div className="max-h-[120px] overflow-y-auto space-y-1">
                        {timerSessions.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-2">ログがありません</p>
                        ) : (
                          timerSessions.slice(0, 5).map((session) => {
                            const startTime = new Date(session.started_at)
                            const endTime = session.ended_at ? new Date(session.ended_at) : null
                            const duration = endTime 
                              ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
                              : (timerEnabled && session.id === activeSessionId ? calculateRunningSeconds() : 0)
                            
                            return (
                              <div key={session.id} className="text-[10px] text-muted-foreground flex justify-between items-center">
                                <span>
                                  {startTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} - {endTime ? endTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "進行中"}
                                </span>
                                <span className="font-medium">{formatTimeInMinutes(duration)}</span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          {/* Left Column - Main Content */}
          <div className="xl:col-span-3 space-y-6">
            {/* Point Card */}
            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    Point（Today&apos;s メモ）
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createItem(1)}
                    className="h-6 text-xs gap-1 bg-transparent px-2"
                  >
                    <Plus className="h-3 w-3" />
                    追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndPoints}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-1 px-1 w-6"></th>
                          <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                          <th className="py-1 px-1 w-60 text-left font-medium">項目</th>
                          <th className="py-1 px-0 w-14 text-left font-medium">種類</th>
                          <th className="py-1 px-1 text-left font-medium">メモ</th>
                        </tr>
                      </thead>
                      <SortableContext items={points.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                        <tbody>
                          {points.map(renderPointRow)}
                          {emptyPointsRows.map((index) => renderEmptyRow(1, index))}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
              </CardContent>
            </Card>

            {/* Tasks Card */}
            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5 text-amber-600" />
                    Tasks（Today&apos;s Goals & Topics）
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createItem(2)}
                    className="h-6 text-xs gap-1 bg-transparent px-2"
                  >
                    <Plus className="h-3 w-3" />
                    追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndTasks}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-1 px-1 w-6"></th>
                          <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                          <th className="py-1 px-1 text-left font-medium">項目</th>
                          <th className="py-1 px-1 w-12 text-center font-medium">作成</th>
                          <th className="py-1 px-0 w-14 text-left font-medium">期限</th>
                          <th className="py-1 px-0 w-14 text-left font-medium">種類</th>
                          <th className="py-1 px-1 text-left font-medium">メモ</th>
                        </tr>
                      </thead>
                      <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
                        <tbody>
                          {tasks.map(renderTaskRow)}
                          {emptyTasksRows.map((index) => renderEmptyRow(2, index))}
                        </tbody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
              </CardContent>
            </Card>

            {/* Topics to Revisit */}
            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-3 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  Topics to Revisit
                </CardTitle>
                <Tabs value={revisitTab} onValueChange={(v) => setRevisitTab(v as "7days" | "whole")}>
                  <TabsList className="h-6">
                    <TabsTrigger value="7days" className="text-[10px] px-2 h-5">
                      this 7days
                    </TabsTrigger>
                    <TabsTrigger value="whole" className="text-[10px] px-2 h-5">
                      whole term
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                {leftItems.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndLeftItems}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="py-1 px-1 w-6"></th>
                            <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                            <th className="py-1 px-1 text-left font-medium">項目</th>
                            <th className="py-1 px-1 w-12 text-center font-medium">作成</th>
                            <th className="py-1 px-0 w-14 text-left font-medium">期限</th>
                            <th className="py-1 px-0 w-14 text-left font-medium">種類</th>
                            <th className="py-1 px-1 text-left font-medium">メモ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <SortableContext items={leftItems.map(item => item.id.toString())} strategy={verticalListSortingStrategy}>
                            {leftItems.map(renderLeftRow)}
                          </SortableContext>
                        </tbody>
                      </table>
                    </div>
                  </DndContext>
                ) : (
                  <div className="flex items-center justify-center py-6 bg-muted/20 rounded border border-dashed">
                    <p className="text-xs text-muted-foreground">未完了のトピックはありません</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Yesterday's Review */}
            <Card className="shadow-sm">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  昨日の復習問題
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <div className="flex items-center justify-center py-6 bg-muted/20 rounded border border-dashed">
                  <p className="text-xs text-muted-foreground">復習問題は今後実装予定です...</p>
                </div>
              </CardContent>
            </Card>

            {/* Calendar - Default position (below review section) */}
            <Card className="shadow-sm xl:hidden scale-[0.7] origin-top">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                  カレンダー
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 flex justify-center">
                <Calendar />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Calendar (only on xl screens and above) */}
          <div className="hidden xl:block xl:col-span-1 flex justify-center">
            <Card className="shadow-sm sticky top-3 mt-6 scale-[0.7] origin-top">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                  カレンダー
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 flex justify-center">
                <Calendar />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function YourPageDashboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    }>
      <YourPageDashboardInner />
    </Suspense>
  )
}

export default withAuth(YourPageDashboard, { requireAuth: true })
