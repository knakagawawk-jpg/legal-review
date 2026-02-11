"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { History, BookOpen, ChevronDown, Filter, Menu, ListTodo, Heart, Calendar as CalendarIcon, ArrowLeft, Plus, CalendarDays } from "lucide-react"
import { SortableRow } from "@/components/sortable-row"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId, getSubjectShortName } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ItemField } from "@/components/item-field"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerCalendar } from "@/components/ui/calendar"
import { useRouter } from "next/navigation"
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

// 科目と色の対応表
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

// Task行専用のStatusオプション
const TASK_STATUS_OPTIONS = [
  { value: 1, label: "未了", color: "bg-slate-100 text-slate-700" },
  { value: 2, label: "作業中", color: "bg-amber-100 text-amber-700" },
  { value: 3, label: "完了", color: "bg-blue-100 text-blue-700" },
  { value: 4, label: "後で", color: "bg-emerald-50 text-emerald-600" },
]


// Memo Field Component
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
  const [isComposing, setIsComposing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineHeight = 24
  const maxDisplayLines = 5
  const maxHeight = lineHeight * maxDisplayLines // 5行分

  // 外部からvalueが変更された場合（親のstate更新など）、ローカル値を同期
  useEffect(() => {
    if (!isComposing) {
      setLocalValue(value)
    }
  }, [value, isComposing])

  const adjustHeight = useCallback(() => {
    if (!textareaRef.current) return

    const currentValue = isComposing ? localValue : value

    if (isFocused) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      // フォーカス時も最大5行まで
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    } else {
      textareaRef.current.scrollTop = 0

      if (!currentValue || currentValue.trim() === '') {
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
        } else {
          // 5行を超える場合は5行で固定し、スクロール可能にする
          displayLines = 5
        }
      }

      const displayHeight = displayLines * lineHeight
      textareaRef.current.style.height = `${displayHeight}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    }
  }, [localValue, value, isFocused, isComposing, maxHeight, lineHeight])

  // valueまたはisFocusedが変更されたときに高さを調整
  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  return (
    <Textarea
      ref={textareaRef}
      value={isComposing ? localValue : value}
      onChange={(e) => {
        const newValue = e.target.value
        const cursorPosition = e.target.selectionStart
        
        setLocalValue(newValue)
        
        // IME入力中は親のonChangeを呼ばない（確定後に呼ぶ）
        if (!isComposing) {
          onChange(e)
        }
        
        // 高さを調整し、その後カーソル位置を復元
        requestAnimationFrame(() => {
          adjustHeight()
          if (textareaRef.current && cursorPosition !== null) {
            // カーソル位置を復元（値の長さを超えないようにする）
            const maxPosition = Math.min(cursorPosition, newValue.length)
            textareaRef.current.setSelectionRange(maxPosition, maxPosition)
          }
        })
      }}
      onCompositionStart={() => {
        setIsComposing(true)
      }}
      onCompositionUpdate={() => {
        // IME入力中は何もしない
      }}
      onCompositionEnd={() => {
        setIsComposing(false)
        // IME確定後に、現在の値を親に通知
        if (textareaRef.current) {
          const cursorPosition = textareaRef.current.selectionStart
          const syntheticEvent = {
            target: textareaRef.current,
            currentTarget: textareaRef.current,
            bubbles: true,
            cancelable: true,
          } as React.ChangeEvent<HTMLTextAreaElement>
          onChange(syntheticEvent)
          
          // IME確定後に高さを調整し、カーソル位置を復元
          requestAnimationFrame(() => {
            adjustHeight()
            if (textareaRef.current && cursorPosition !== null) {
              const maxPosition = Math.min(cursorPosition, textareaRef.current.value.length)
              textareaRef.current.setSelectionRange(maxPosition, maxPosition)
            }
          })
        }
      }}
      onKeyDown={(e) => {
        // Enterキーが押されたとき
        if (e.key === 'Enter') {
          // Shiftキーが押されていない場合はフォーカスを外す
          if (!e.shiftKey) {
            e.preventDefault()
            textareaRef.current?.blur()
          }
          // Shift+Enterの場合は通常の改行動作を許可
        }
      }}
      onFocus={() => {
        setIsFocused(true)
      }}
      onBlur={() => {
        setIsFocused(false)
      }}
      placeholder={placeholder}
      className="min-h-[1.5rem] text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 resize-none overflow-y-auto"
      style={{ lineHeight: `${lineHeight}px` }}
    />
  )
}

function TopicsPage() {
  const router = useRouter()
  const { isOpen, setIsOpen, mainContentStyle } = useSidebar()
  const [allItems, setAllItems] = useState<DashboardItem[]>([])
  const [displayedItems, setDisplayedItems] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  
  const itemsPerPage = 20
  
  // フィルター
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [favoriteFilter, setFavoriteFilter] = useState<"fav-only" | "fav-except" | "all">("all")
  
  // favorite更新用のタイマー
  const favoriteUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  
  // メモ更新用のタイマー
  const memoUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingMemoUpdates = useRef<Record<number, string>>({})
  
  // 項目・科目・種類更新用のタイマー
  const itemUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingItemUpdates = useRef<Record<number, Partial<DashboardItem>>>({})
  
  // 作成日編集用のPopover状態
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  
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
      const data = await apiClient.get<{ items: DashboardItem[], total: number }>("/api/dashboard/items/all?entry_type=2")
      console.log("Topics data:", data)
      setAllItems(data.items || [])
    } catch (error) {
      console.error("Failed to load dashboard items:", error)
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  
  // 新しいアイテムを作成
  const createItem = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const newItem = await apiClient.post<DashboardItem>("/api/dashboard/items", {
        dashboard_date: today,
        entry_type: 2,
        item: "",
        status: 1,
        position: null,
        created_at: today,
      })
      // データを再読み込み
      await loadData()
      return newItem
    } catch (error) {
      console.error("Failed to create item:", error)
      return undefined
    }
  }, [loadData])
  
  // フィルター適用後のデータ
  const filteredItems = useMemo(() => {
    let filtered = [...allItems]
    
    // 科目フィルター
    if (subjectFilter !== null) {
      const subjectId = getSubjectId(subjectFilter)
      filtered = filtered.filter(item => {
        if (subjectId !== null) {
          return item.subject === subjectId
        }
        return getSubjectName(item.subject || 0) === subjectFilter
      })
    }
    
    // 状態フィルター
    if (statusFilter !== null) {
      filtered = filtered.filter(item => item.status === statusFilter)
    }
    
    // 期間フィルター
    if (startDate) {
      const startStr = new Date(startDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true
        return item.created_at >= startStr
      })
    }
    if (endDate) {
      const endStr = new Date(endDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter(item => {
        if (!item.created_at) return true
        return item.created_at <= endStr
      })
    }
    
    // favoriteフィルター
    if (favoriteFilter === "fav-only") {
      filtered = filtered.filter(item => item.favorite === 1)
    } else if (favoriteFilter === "fav-except") {
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
  }, [allItems, subjectFilter, statusFilter, startDate, endDate, favoriteFilter])
  
  // フィルター変更時に表示をリセットして最初の20件を表示
  useEffect(() => {
    if (!loading) {
      const initialItems = filteredItems.slice(0, itemsPerPage)
      setDisplayedItems(initialItems)
      setHasMore(initialItems.length < filteredItems.length)
    }
  }, [filteredItems, loading])
  
  // さらに読み込む
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    setTimeout(() => {
      const currentLength = displayedItems.length
      const newItems = filteredItems.slice(0, currentLength + itemsPerPage)
      setDisplayedItems(newItems)
      setHasMore(newItems.length < filteredItems.length)
      setLoadingMore(false)
    }, 300)
  }, [displayedItems.length, filteredItems, hasMore, loadingMore])
  
  // favorite更新（5秒バッファ付き）
  const updateFavorite = useCallback(async (itemId: number, favorite: number) => {
    if (favoriteUpdateTimers.current[itemId]) {
      clearTimeout(favoriteUpdateTimers.current[itemId])
    }
    
    setAllItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite } : item))
    
    favoriteUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        await apiClient.put(`/api/dashboard/items/${itemId}`, { favorite })
        delete favoriteUpdateTimers.current[itemId]
      } catch (error) {
        console.error("Failed to update favorite:", error)
        setAllItems(prev => prev.map(item => item.id === itemId ? { ...item, favorite: 1 - favorite } : item))
      }
    }, 5000)
  }, [])
  
  // メモ更新（debounce付き）
  const updateMemo = useCallback(async (itemId: number, memo: string) => {
    setAllItems(prev => prev.map(item => item.id === itemId ? { ...item, memo } : item))
    
    if (memoUpdateTimers.current[itemId]) {
      clearTimeout(memoUpdateTimers.current[itemId])
    }
    
    pendingMemoUpdates.current[itemId] = memo
    
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
  const updateItemField = useCallback(async (itemId: number, field: keyof DashboardItem, value: any) => {
    // 楽観的更新
    setAllItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item))
    
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
  
  // アイテム削除
  const deleteItem = async (itemId: number) => {
    try {
      await apiClient.delete(`/api/dashboard/items/${itemId}`)
      loadData()
    } catch (error) {
      console.error("Failed to delete item:", error)
    }
  }
  
  // ドラッグ終了処理
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = allItems.findIndex((item) => item.id.toString() === active.id)
      const newIndex = allItems.findIndex((item) => item.id.toString() === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const newItems = arrayMove(allItems, oldIndex, newIndex)
      setAllItems(newItems)

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
        console.error("Failed to reorder item:", error)
        loadData() // Revert on error
      }
    }
  }
  
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
    <div 
      className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300"
      style={mainContentStyle}
    >
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-md bg-white/95 backdrop-blur-sm border border-amber-200/60 shadow-md hover:bg-amber-50/40 transition-colors"
          aria-label="サイドバーを開く"
        >
          <Menu className="h-4 w-4 text-amber-600" />
        </button>
      )}
      
      {/* Fixed Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-3 max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ListTodo className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Topics</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={createItem}
              className="h-7 text-xs gap-1 bg-transparent px-2"
            >
              <Plus className="h-3 w-3" />
              追加
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 max-w-7xl">
        {/* フィルター: スマホは2行(セレクト行+日付行)、広い画面は1行 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* 科目 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md hover:opacity-80",
                subjectFilter 
                  ? (SUBJECT_COLORS[subjectFilter] || "bg-amber-100 text-amber-900")
                  : "bg-gray-100 text-gray-700"
              )}>
                <span>{subjectFilter ? getSubjectShortName(subjectFilter) : "全科目"}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-32">
              <DropdownMenuItem
                onClick={() => setSubjectFilter(null)}
                className={cn(
                  "text-xs cursor-pointer rounded-sm",
                  "bg-gray-100 text-gray-700",
                  subjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                )}
              >
                全科目
              </DropdownMenuItem>
              {FIXED_SUBJECTS.map((subject) => (
                <DropdownMenuItem
                  key={subject}
                  onClick={() => setSubjectFilter(subject)}
                  className={cn(
                    "text-xs cursor-pointer rounded-sm",
                    SUBJECT_COLORS[subject] || "bg-gray-100 text-gray-700",
                    subjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium"
                  )}
                >
                  {getSubjectShortName(subject)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* 状態 */}
          <Select 
            value={statusFilter?.toString() || "all"} 
            onValueChange={(value) => {
              if (value === "all") {
                setStatusFilter(null)
              } else {
                setStatusFilter(parseInt(value))
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
          
          {/* fav */}
          <Select 
            value={favoriteFilter} 
            onValueChange={(value) => {
              setFavoriteFilter(value as "fav-only" | "fav-except" | "all")
            }}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fav-only" className="text-xs">favのみ</SelectItem>
              <SelectItem value="fav-except" className="text-xs">fav以外</SelectItem>
              <SelectItem value="all" className="text-xs">フィルターなし</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 期間: スマホで w-full により2行目に表示、md以上で1行に */}
          <div className="flex items-center gap-2 w-full md:w-auto">
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
          </div>
        </div>
        
        {/* テーブル */}
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4">
            {loading ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                読み込み中...
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                データがありません
              </div>
            ) : (
              <>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[629px]">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <TableHead className="py-2 px-2 w-6"></TableHead>
                          <TableHead className="py-2 px-2 w-20 text-left font-medium">科目</TableHead>
                          <TableHead className="py-2 px-2 min-w-[112px] max-w-[210px] text-left font-medium">項目</TableHead>
                          <TableHead className="py-2 px-2 w-20 text-center font-medium">作成</TableHead>
                          <TableHead className="py-2 px-2 w-20 text-left font-medium">期限</TableHead>
                          <TableHead className="py-2 px-2 w-20 text-left font-medium">状態</TableHead>
                          <TableHead className="py-2 px-2 text-left font-medium min-w-[399px]">メモ</TableHead>
                          <TableHead className="py-2 px-2 w-12 text-center font-medium">♡</TableHead>
                        </tr>
                      </thead>
                      <SortableContext items={displayedItems.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                        <TableBody>
                          {displayedItems.map((item) => {
                        const statusOption = TASK_STATUS_OPTIONS.find((s) => s.value === item.status)
                        const selectedSubject = subjects.find(s => s.id === item.subject)
                        const createdDate = item.created_at ? formatDate(item.created_at) : ""
                        return (
                          <SortableRow 
                            key={item.id} 
                            item={item} 
                            onDelete={deleteItem}
                            onEditCreatedDate={(id) => {
                              setCreatedDatePickerOpen(prev => ({ ...prev, [id]: true }))
                            }}
                            showCreatedDateButton={true}
                          >
                            <TableCell className="py-2 px-2 w-20 align-top">
                              <Select
                                value={item.subject?.toString() || undefined}
                                onValueChange={(value) => updateItemField(item.id, "subject", value ? parseInt(value) : null)}
                              >
                                <SelectTrigger className="h-7 text-[10px] border-0 bg-transparent hover:bg-muted/50 focus:bg-muted/50 px-1 w-20">
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
                            <TableCell className="py-2 px-2 min-w-[112px] max-w-[210px] align-top">
                              <ItemField
                                value={item.item}
                                onChange={(e) => updateItemField(item.id, "item", e.target.value)}
                                className="w-full"
                              />
                            </TableCell>
                            <TableCell className="py-2 px-2 w-20 text-xs text-muted-foreground text-center relative align-top">
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
                                        updateItemField(item.id, "created_at", dateStr)
                                      }
                                      setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="py-2 px-2 w-20 align-top">
                              {item.due_date ? (
                                <span className="text-xs text-muted-foreground">{formatDate(item.due_date)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 px-2 w-20 align-top">
                              <Select
                                value={item.status.toString()}
                                onValueChange={(value) => updateItemField(item.id, "status", parseInt(value))}
                              >
                                <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-20">
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
                            <TableCell className="py-2 px-2 align-top min-w-[399px]">
                              <MemoField
                                value={item.memo || ""}
                                onChange={(e) => updateMemo(item.id, e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="py-2 px-2 w-12 align-top text-center">
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
                      })}
                        </TableBody>
                      </SortableContext>
                    </table>
                  </div>
                </DndContext>
                
                {/* さらに読み込むボタン */}
                {hasMore && (
                  <div className="mt-4 text-center">
                    <Button
                      onClick={loadMore}
                      disabled={loadingMore}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {loadingMore ? "読み込み中..." : "さらに読み込む…"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(TopicsPage, { requireAuth: true })
