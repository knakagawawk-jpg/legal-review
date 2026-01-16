"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
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

const STATUS_OPTIONS = [
  { value: 1, label: "未了", color: "bg-slate-100 text-slate-700" },
  { value: 2, label: "作業中", color: "bg-amber-100 text-amber-700" },
  { value: 3, label: "完了", color: "bg-blue-100 text-blue-700" },
  { value: 4, label: "後で", color: "bg-emerald-50 text-emerald-600" },
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
            {onEditCreatedDate && entryType === 2 && (
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

function YourPageDashboard() {
  const { isOpen } = useSidebar()
  const [revisitTab, setRevisitTab] = useState<"7days" | "whole">("7days")
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerDetailsOpen, setTimerDetailsOpen] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // Dashboard items
  const [points, setPoints] = useState<DashboardItem[]>([])
  const [tasks, setTasks] = useState<DashboardItem[]>([])
  const [leftItems, setLeftItems] = useState<DashboardItem[]>([])
  
  // Empty rows state (for tracking which empty rows are being edited)
  // Always keep exactly 2 empty rows
  const [emptyPointsRows, setEmptyPointsRows] = useState<Set<number>>(new Set([0, 1]))
  const [emptyTasksRows, setEmptyTasksRows] = useState<Set<number>>(new Set([0, 1]))
  
  // Popover open state for date pickers (key: itemId, value: boolean)
  const [datePickerOpen, setDatePickerOpen] = useState<Record<number, boolean>>({})
  
  // Popover open state for created date pickers (key: itemId, value: boolean)
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  
  // Track which empty rows are currently creating items
  const creatingEmptyRowsRef = useRef<Set<string>>(new Set())
  
  // Subjects
  const [subjects, setSubjects] = useState<Subject[]>([])
  
  // Current date (YYYY-MM-DD)
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    const jstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
    return jstDate.toISOString().split("T")[0]
  })
  
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

  // Load dashboard items
  const loadDashboardItems = useCallback(async () => {
    try {
      // Load Points
      const pointsData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items?dashboard_date=${currentDate}&entry_type=1`
      )
      setPoints(pointsData.items)
      // Always show 2 empty rows
      setEmptyPointsRows(new Set([0, 1]))

      // Load Tasks
      const tasksData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items?dashboard_date=${currentDate}&entry_type=2`
      )
      setTasks(tasksData.items)
      // Always show 2 empty rows
      setEmptyTasksRows(new Set([0, 1]))

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
      // Keep exactly 2 empty rows when an item is created via button
      if (entryType === 1) {
        setEmptyPointsRows(new Set([0, 1]))
      } else {
        setEmptyTasksRows(new Set([0, 1]))
      }
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
    const statusOption = STATUS_OPTIONS.find((s) => s.value === item.status)
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
            <SelectTrigger className={`h-7 text-[10px] border-0 px-1 w-14 ${statusOption?.color || ""}`}>
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
            <SelectTrigger className={`h-7 text-[10px] border-0 px-1 w-14 ${statusOption?.color || ""}`}>
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
    const createdDate = item.dashboard_date ? formatDueDate(item.dashboard_date) : "--"
    return (
      <TableRow key={item.id} className="border-b border-border/50 hover:bg-amber-50/30 transition-colors">
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
        <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center">
          {createdDate}
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
            <SelectTrigger className={`h-7 text-[10px] border-0 px-1 w-14 ${statusOption?.color || ""}`}>
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
        <TableCell className="py-1.5 px-1 w-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItem(item.id)}
            className="h-5 w-5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  // Render empty row (for default 3 rows)
  const renderEmptyRow = (entryType: number, index: number) => {
    const rowKey = `${entryType}-${index}`
    
    const handleEmptyRowChange = async (field: string, value: any) => {
      // Only create item if value is not empty
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return
      }
      
      // Prevent multiple creations for the same row
      if (creatingEmptyRowsRef.current.has(rowKey)) {
        return
      }
      
      creatingEmptyRowsRef.current.add(rowKey)
      
      // Create item when user starts typing
      try {
        const newItem = await createItem(entryType)
        if (newItem) {
          // Update the field immediately
          updateItemField(newItem, field as keyof DashboardItem, value)
          // Keep exactly 2 empty rows (remove the used one, but don't add a new one)
          if (entryType === 1) {
            setEmptyPointsRows(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              // If we have less than 2 empty rows, add one to maintain 2 rows
              if (newSet.size < 2) {
                const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
                newSet.add(maxIndex + 1)
              }
              return newSet
            })
          } else {
            setEmptyTasksRows(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              // If we have less than 2 empty rows, add one to maintain 2 rows
              if (newSet.size < 2) {
                const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
                newSet.add(maxIndex + 1)
              }
              return newSet
            })
          }
          creatingEmptyRowsRef.current.delete(rowKey)
        }
      } catch (error) {
        console.error("Failed to create item from empty row:", error)
        creatingEmptyRowsRef.current.delete(rowKey)
      }
    }

    if (entryType === 1) {
      // Point empty row
      return (
        <TableRow key={`empty-point-${index}`}>
          <TableCell className="py-1.5 px-1 w-6"></TableCell>
          <TableCell className="py-1.5 px-0.5 w-14">
            <Select
              value={undefined}
              onValueChange={(value) => handleEmptyRowChange("subject", value ? parseInt(value) : null)}
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
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("item", e.target.value)
                }
              }}
              placeholder="項目を入力..."
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Select
              value={undefined}
              onValueChange={(value) => {
                if (value) {
                  handleEmptyRowChange("status", parseInt(value))
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
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("memo", e.target.value)
                }
              }}
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
              value={undefined}
              onValueChange={(value) => handleEmptyRowChange("subject", value ? parseInt(value) : null)}
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
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("item", e.target.value)
                }
              }}
              placeholder="項目を入力..."
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
          <TableCell className="py-1.5 px-1 w-12 text-xs text-muted-foreground text-center">
            {getFormattedCreatedDate()}
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Button
              variant="ghost"
              className="h-7 w-full justify-start text-xs px-1 font-normal border-0 hover:bg-muted/50 text-muted-foreground"
            >
              --
            </Button>
          </TableCell>
          <TableCell className="py-1.5 px-0 w-14">
            <Select
              value={undefined}
              onValueChange={(value) => {
                if (value) {
                  handleEmptyRowChange("status", parseInt(value))
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
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("memo", e.target.value)
                }
              }}
              className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
            />
          </TableCell>
        </TableRow>
      )
    }
  }

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-background transition-all duration-300", isOpen && "ml-52")}>
      <div className="container mx-auto px-10 py-3 max-w-6xl">
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
                  onCheckedChange={setTimerEnabled}
                  className="scale-90"
                />
                <span className="text-xs font-medium min-w-[60px] text-right">
                  {formatTimeDisplay(elapsedTime)}
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
                    <p className="text-lg font-mono font-medium text-center">{formatTime(elapsedTime)}</p>
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
                          <th className="py-1 px-0 w-14 text-left font-medium">状態</th>
                          <th className="py-1 px-1 text-left font-medium">メモ</th>
                        </tr>
                      </thead>
                      <SortableContext items={points.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                        <tbody>
                          {points.map(renderPointRow)}
                          {Array.from(emptyPointsRows).map((index) => renderEmptyRow(1, index))}
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
                          <th className="py-1 px-0 w-14 text-left font-medium">状態</th>
                          <th className="py-1 px-1 text-left font-medium">メモ</th>
                        </tr>
                      </thead>
                      <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
                        <tbody>
                          {tasks.length === 0 ? (
                            <>
                              {[0, 1].map((index) => renderEmptyRow(2, index))}
                            </>
                          ) : (
                            <>
                              {tasks.map(renderTaskRow)}
                              {Array.from(emptyTasksRows).map((index) => renderEmptyRow(2, index))}
                            </>
                          )}
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-1 px-0.5 w-14 text-left font-medium">科目</th>
                          <th className="py-1 px-1 text-left font-medium">項目</th>
                          <th className="py-1 px-1 w-12 text-center font-medium">作成</th>
                          <th className="py-1 px-0 w-14 text-left font-medium">期限</th>
                          <th className="py-1 px-0 w-14 text-left font-medium">状態</th>
                          <th className="py-1 px-1 text-left font-medium">メモ</th>
                          <th className="py-1 px-1 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leftItems.map(renderLeftRow)}
                      </tbody>
                    </table>
                  </div>
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
            <Card className="shadow-sm xl:hidden">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                  カレンダー
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <div className="scale-[0.7] origin-top-left">
                  <Calendar />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Calendar (only on xl screens and above) */}
          <div className="hidden xl:block xl:col-span-1">
            <Card className="shadow-sm sticky top-3 mt-6">
              <CardHeader className="py-1.5 px-3">
                <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                  カレンダー
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <div className="scale-[0.7] origin-top-left">
                  <Calendar />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withAuth(YourPageDashboard, { requireAuth: true })
