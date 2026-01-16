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
import { Target, FileText, RotateCcw, Clock, ChevronDown, Sparkles, Calendar as CalendarIcon, GripVertical, Trash2 } from "lucide-react"
import { SidebarToggle } from "@/components/sidebar"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { withAuth } from "@/components/auth/with-auth"
import { Calendar } from "@/components/ui/calendar"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
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
  { value: 1, label: "未了" },
  { value: 2, label: "作業中" },
  { value: 3, label: "完了" },
  { value: 4, label: "後で" },
]

// Sortable Row Component
function SortableRow({
  item,
  children,
  entryType,
}: {
  item: DashboardItem
  children: React.ReactNode
  entryType: number
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id.toString() })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 cursor-move" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
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
  
  // Dashboard items
  const [points, setPoints] = useState<DashboardItem[]>([])
  const [tasks, setTasks] = useState<DashboardItem[]>([])
  const [leftItems, setLeftItems] = useState<DashboardItem[]>([])
  
  // Empty rows state (for tracking which empty rows are being edited)
  const [emptyPointsRows, setEmptyPointsRows] = useState<Set<number>>(new Set([0, 1, 2]))
  const [emptyTasksRows, setEmptyTasksRows] = useState<Set<number>>(new Set([0, 1, 2]))
  
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
      // Always show 3 empty rows
      setEmptyPointsRows(new Set([0, 1, 2]))

      // Load Tasks
      const tasksData = await apiClient.get<{ items: DashboardItem[], total: number }>(
        `/api/dashboard/items?dashboard_date=${currentDate}&entry_type=2`
      )
      setTasks(tasksData.items)
      // Always show 3 empty rows
      setEmptyTasksRows(new Set([0, 1, 2]))

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
      })
      // Add a new empty row when an item is created via button
      if (entryType === 1) {
        setEmptyPointsRows(prev => {
          const newSet = new Set(prev)
          const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
          newSet.add(maxIndex + 1)
          return newSet
        })
      } else {
        setEmptyTasksRows(prev => {
          const newSet = new Set(prev)
          const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
          newSet.add(maxIndex + 1)
          return newSet
        })
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
    useSensor(PointerSensor),
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
  const renderPointRow = (item: DashboardItem) => (
    <SortableRow key={item.id} item={item} entryType={1}>
      <TableCell className="w-32">
        <Select
          value={item.subject?.toString() || undefined}
          onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="未選択" />
          </SelectTrigger>
          <SelectContent>
            {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={item.item}
          onChange={(e) => updateItemField(item, "item", e.target.value)}
          className="h-8"
          placeholder="項目を入力..."
        />
      </TableCell>
      <TableCell className="w-32">
        <Select
          value={item.status.toString()}
          onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
              <SelectItem key={opt.value} value={opt.value.toString()}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-32">
        <Textarea
          value={item.memo || ""}
          onChange={(e) => updateItemField(item, "memo", e.target.value)}
          className="min-h-[60px] resize-none"
          placeholder="メモ..."
        />
      </TableCell>
      <TableCell className="w-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteItem(item.id)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </SortableRow>
  )

  // Render table row for Task
  const renderTaskRow = (item: DashboardItem) => (
    <SortableRow key={item.id} item={item} entryType={2}>
      <TableCell className="w-32">
        <Select
          value={item.subject?.toString() || undefined}
          onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="未選択" />
          </SelectTrigger>
          <SelectContent>
            {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={item.item}
          onChange={(e) => updateItemField(item, "item", e.target.value)}
          className="h-8"
          placeholder="項目を入力..."
        />
      </TableCell>
      <TableCell className="w-32 text-xs text-muted-foreground">
        {item.dashboard_date}
      </TableCell>
      <TableCell className="w-32">
        <Input
          type="date"
          value={item.due_date || ""}
          onChange={(e) => updateItemField(item, "due_date", e.target.value || null)}
          className="h-8"
        />
      </TableCell>
      <TableCell className="w-32">
        <Select
          value={item.status.toString()}
          onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
              <SelectItem key={opt.value} value={opt.value.toString()}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-32">
        <Textarea
          value={item.memo || ""}
          onChange={(e) => updateItemField(item, "memo", e.target.value)}
          className="min-h-[60px] resize-none"
          placeholder="メモ..."
        />
      </TableCell>
      <TableCell className="w-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteItem(item.id)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </SortableRow>
  )

  // Render table row for Left item
  const renderLeftRow = (item: DashboardItem) => (
    <TableRow key={item.id}>
      <TableCell className="w-32">
        <Select
          value={item.subject?.toString() || undefined}
          onValueChange={(value) => updateItemField(item, "subject", value ? parseInt(value) : null)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="未選択" />
          </SelectTrigger>
          <SelectContent>
            {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={item.item}
          onChange={(e) => updateItemField(item, "item", e.target.value)}
          className="h-8"
          placeholder="項目を入力..."
        />
      </TableCell>
      <TableCell className="w-32 text-xs text-muted-foreground">
        {item.dashboard_date}
      </TableCell>
      <TableCell className="w-32">
        <Input
          type="date"
          value={item.due_date || ""}
          onChange={(e) => updateItemField(item, "due_date", e.target.value || null)}
          className="h-8"
        />
      </TableCell>
      <TableCell className="w-32">
        <Select
          value={item.status.toString()}
          onValueChange={(value) => updateItemField(item, "status", parseInt(value))}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter(opt => opt.value != null && opt.value.toString() !== "").map((opt) => (
              <SelectItem key={opt.value} value={opt.value.toString()}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-32">
        <Textarea
          value={item.memo || ""}
          onChange={(e) => updateItemField(item, "memo", e.target.value)}
          className="min-h-[60px] resize-none"
          placeholder="メモ..."
        />
      </TableCell>
      <TableCell className="w-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteItem(item.id)}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )

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
          // Keep 3 empty rows (remove the used one and add a new one)
          if (entryType === 1) {
            setEmptyPointsRows(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              // Add a new empty row index
              const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
              newSet.add(maxIndex + 1)
              return newSet
            })
          } else {
            setEmptyTasksRows(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              // Add a new empty row index
              const maxIndex = newSet.size > 0 ? Math.max(...Array.from(newSet)) : -1
              newSet.add(maxIndex + 1)
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
          <TableCell className="w-8"></TableCell>
          <TableCell className="w-32">
            <Select
              value={undefined}
              onValueChange={(value) => handleEmptyRowChange("subject", value ? parseInt(value) : null)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Input
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("item", e.target.value)
                }
              }}
              className="h-8"
              placeholder="項目を入力..."
            />
          </TableCell>
          <TableCell className="w-32">
            <Select
              value={undefined}
              onValueChange={(value) => {
                if (value) {
                  handleEmptyRowChange("status", parseInt(value))
                }
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="未了" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="w-32">
            <Textarea
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("memo", e.target.value)
                }
              }}
              className="min-h-[60px] resize-none"
              placeholder="メモ..."
            />
          </TableCell>
          <TableCell className="w-10"></TableCell>
        </TableRow>
      )
    } else {
      // Task empty row
      return (
        <TableRow key={`empty-task-${index}`}>
          <TableCell className="w-8"></TableCell>
          <TableCell className="w-32">
            <Select
              value={undefined}
              onValueChange={(value) => handleEmptyRowChange("subject", value ? parseInt(value) : null)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                {subjects.filter(s => s.id != null && s.id.toString() !== "").map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <Input
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("item", e.target.value)
                }
              }}
              className="h-8"
              placeholder="項目を入力..."
            />
          </TableCell>
          <TableCell className="w-32 text-xs text-muted-foreground">
            {currentDate}
          </TableCell>
          <TableCell className="w-32">
            <Input
              type="date"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("due_date", e.target.value)
                }
              }}
              className="h-8"
            />
          </TableCell>
          <TableCell className="w-32">
            <Select
              value={undefined}
              onValueChange={(value) => {
                if (value) {
                  handleEmptyRowChange("status", parseInt(value))
                }
              }}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="未了" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="w-32">
            <Textarea
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleEmptyRowChange("memo", e.target.value)
                }
              }}
              className="min-h-[60px] resize-none"
              placeholder="メモ..."
            />
          </TableCell>
          <TableCell className="w-10"></TableCell>
        </TableRow>
      )
    }
  }

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-amber-50/80 to-background transition-all duration-300", isOpen && "ml-52")}>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
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
          {/* Point Card */}
          <Card className="shadow-sm mb-10">
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  Point（Today&apos;s メモ）
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createItem(1)}
                  className="h-7 text-xs"
                >
                  追加
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndPoints}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-32">科目</TableHead>
                      <TableHead>項目</TableHead>
                      <TableHead className="w-32">ステータス</TableHead>
                      <TableHead className="w-32">メモ</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext items={points.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                      {points.map(renderPointRow)}
                      {Array.from(emptyPointsRows).map((index) => renderEmptyRow(1, index))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </CardContent>
          </Card>

          {/* Tasks Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  Tasks（Today&apos;s Goals & Topics）
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createItem(2)}
                  className="h-7 text-xs"
                >
                  追加
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEndTasks}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-32">科目</TableHead>
                      <TableHead>項目</TableHead>
                      <TableHead className="w-32">期限</TableHead>
                      <TableHead className="w-32">ステータス</TableHead>
                      <TableHead className="w-32">メモ</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
                      {tasks.length === 0 ? (
                        <>
                          {[0, 1, 2].map((index) => renderEmptyRow(2, index))}
                        </>
                      ) : (
                        tasks.map(renderTaskRow)
                      )}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </CardContent>
          </Card>

          {/* Left Card */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    Topics to Revisit
                  </CardTitle>
                  <Tabs value={revisitTab} onValueChange={(v) => setRevisitTab(v as "7days" | "whole")} className="w-auto">
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
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">科目</TableHead>
                    <TableHead>項目</TableHead>
                    <TableHead className="w-32">作成日</TableHead>
                    <TableHead className="w-32">期限</TableHead>
                    <TableHead className="w-32">ステータス</TableHead>
                    <TableHead className="w-32">メモ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leftItems.length === 0 ? (
                    <>
                      {[0, 1, 2].map((index) => (
                        <TableRow key={`empty-left-${index}`}>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            項目がありません
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ) : (
                    leftItems.map(renderLeftRow)
                  )}
                </TableBody>
              </Table>
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
