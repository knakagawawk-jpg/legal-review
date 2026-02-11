"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { FileText, ArrowLeft, Plus, GripVertical, Trash2, Menu } from "lucide-react"
import { SortableRow } from "@/components/sortable-row"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectId } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerCalendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
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

type StudyTag = {
  id: number
  user_id: number
  subject_id: number
  name: string
  created_at: string
}

type StudyItem = {
  id: number
  item: string
  importance: number
  masteryLevel?: number | null
  content: string
  memo: string
  tags?: string[]
  createdAt: string
  position: number
}

type StudyItemApi = {
  id: number
  item: string
  importance: number
  mastery_level: number | null
  content: string
  memo: string | null
  tags: string[]
  created_date: string
  position: number
}

// Dashboardと同じ高さ制御ロジック（入力時は最大5行、表示時は1〜3行）
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
  const maxHeight = lineHeight * maxDisplayLines

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
          displayLines = 5
        }
      }

      const displayHeight = displayLines * lineHeight
      textareaRef.current.style.height = `${displayHeight}px`
      textareaRef.current.style.maxHeight = `${maxHeight}px`
    }
  }, [localValue, value, isFocused, isComposing, maxHeight, lineHeight])

  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  return (
    <textarea
      ref={textareaRef}
      value={isComposing ? localValue : value}
      onChange={(e) => {
        const newValue = e.target.value
        const cursorPosition = e.target.selectionStart

        setLocalValue(newValue)

        if (!isComposing) {
          onChange(e)
        }

        requestAnimationFrame(() => {
          adjustHeight()
          if (textareaRef.current && cursorPosition !== null) {
            const maxPosition = Math.min(cursorPosition, newValue.length)
            textareaRef.current.setSelectionRange(maxPosition, maxPosition)
          }
        })
      }}
      onCompositionStart={() => {
        setIsComposing(true)
      }}
      onCompositionEnd={() => {
        setIsComposing(false)
        if (textareaRef.current) {
          const cursorPosition = textareaRef.current.selectionStart
          const syntheticEvent = {
            target: textareaRef.current,
            currentTarget: textareaRef.current,
            bubbles: true,
            cancelable: true,
          } as React.ChangeEvent<HTMLTextAreaElement>
          onChange(syntheticEvent)

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
        if (e.key === 'Enter') {
          if (!e.shiftKey) {
            e.preventDefault()
            textareaRef.current?.blur()
          }
        }
      }}
      onFocus={() => {
        setIsFocused(true)
      }}
      onBlur={() => {
        setIsFocused(false)
      }}
      placeholder={placeholder}
      className="min-h-[1.5rem] text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0 resize-none overflow-y-auto w-full"
      style={{ lineHeight: `${lineHeight}px` }}
    />
  )
}


const IMPORTANCE_OPTIONS = [
  { value: 1, label: "High", color: "bg-pink-600 text-white" },
  { value: 2, label: "Middle", color: "bg-lime-600 text-white" },
  { value: 3, label: "Low", color: "bg-cyan-600 text-white" },
]

const MASTERY_LEVEL_OPTIONS = [
  { value: 1, label: "1", description: "未習得", color: "bg-gray-100 text-gray-700" },
  { value: 2, label: "2", description: "初級", color: "bg-blue-100 text-blue-700" },
  { value: 3, label: "3", description: "中級", color: "bg-yellow-100 text-yellow-700" },
  { value: 4, label: "4", description: "上級", color: "bg-green-100 text-green-700" },
  { value: 5, label: "5", description: "完全習得", color: "bg-purple-100 text-purple-700" },
]

function getImportanceColor(importance: number): string {
  const opt = IMPORTANCE_OPTIONS.find(o => o.value === importance)
  return opt?.color || ""
}

function getImportanceLabel(importance: number): string {
  const opt = IMPORTANCE_OPTIONS.find(o => o.value === importance)
  return opt?.label || ""
}

function getMasteryLevelColor(level: number): string {
  const opt = MASTERY_LEVEL_OPTIONS.find(o => o.value === level)
  return opt?.color || ""
}

function getMasteryLevelLabel(level: number): string {
  const opt = MASTERY_LEVEL_OPTIONS.find(o => o.value === level)
  return opt?.label || ""
}

function PointsPage() {
  const router = useRouter()
  const params = useParams()
  const { isOpen, setIsOpen, mainContentStyle } = useSidebar()
  const [allItems, setAllItems] = useState<StudyItem[]>([])
  const [displayedItems, setDisplayedItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [availableTags, setAvailableTags] = useState<StudyTag[]>([])
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState<Record<number, boolean>>({})
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})
  const [tagFilterOpen, setTagFilterOpen] = useState(false)

  const itemsPerPage = 20

  // フィルター
  const [importanceFilter, setImportanceFilter] = useState<string>("all")
  const [masteryFilter, setMasteryFilter] = useState<string>("all")
  const [tagFilters, setTagFilters] = useState<string[]>([])

  const saveTimeoutRef = useRef<Record<number, number>>({})

  const decodeSubject = (encoded?: string | string[]): string | null => {
    if (!encoded) return null
    const str = Array.isArray(encoded) ? encoded[0] : encoded
    try {
      const decoded = decodeURIComponent(str)
      if (FIXED_SUBJECTS.includes(decoded as typeof FIXED_SUBJECTS[number])) {
        return decoded
      }
    } catch (error) {
      console.error('Failed to decode subject:', error)
    }
    return null
  }

  const selectedSubject = decodeSubject(params.subject) || "憲法"

  const formatCreatedAtMmDd = useCallback((createdDateIso: string): string => {
    try {
      const d = new Date(createdDateIso)
      return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    } catch {
      return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    }
  }, [])

  const toUiStudyItem = useCallback((api: StudyItemApi): StudyItem => {
    return {
      id: api.id,
      item: api.item,
      importance: api.importance,
      masteryLevel: api.mastery_level,
      content: api.content,
      memo: api.memo ?? "",
      tags: api.tags ?? [],
      createdAt: formatCreatedAtMmDd(api.created_date),
      position: api.position,
    }
  }, [formatCreatedAtMmDd])

  const queueUpdateStudyItem = (id: number, patch: Record<string, any>) => {
    const existing = saveTimeoutRef.current[id]
    if (existing) {
      window.clearTimeout(existing)
    }
    saveTimeoutRef.current[id] = window.setTimeout(async () => {
      try {
        await apiClient.put(`/api/study-items/${id}`, patch)
      } catch (e) {
        console.error("Failed to update study item:", e)
      }
    }, 350)
  }

  const deleteStudyTagCandidate = async (tagName: string) => {
    const subjectId = getSubjectId(selectedSubject)
    if (!subjectId) return

    const candidate = availableTags.find((t) => t.subject_id === subjectId && t.name === tagName)
    if (!candidate) return

    try {
      await apiClient.delete(`/api/study-tags/${candidate.id}`)
      setAvailableTags((prev) => prev.filter((t) => t.id !== candidate.id))
    } catch (e) {
      console.error("Failed to delete study tag candidate:", e)
    }
  }

  const getAllTags = (items: StudyItem[]): string[] => {
    const tagSet = new Set<string>()
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tagSet.add(tag)
          }
        })
      }
    })
    return Array.from(tagSet).sort()
  }

  const filterTagOptions = useMemo(() => {
    const s = new Set<string>()
    for (const t of availableTags) {
      if (t && t.name) s.add(t.name)
    }
    for (const t of getAllTags(allItems)) {
      s.add(t)
    }
    return Array.from(s).sort()
  }, [availableTags, allItems])

  const matchesStudyFilters = useCallback((it: StudyItem) => {
    if (importanceFilter !== "all") {
      if (String(it.importance) !== importanceFilter) return false
    }
    if (masteryFilter !== "all") {
      if (masteryFilter === "unset") {
        if (it.masteryLevel != null) return false
      } else {
        if (String(it.masteryLevel ?? "") !== masteryFilter) return false
      }
    }
    if (tagFilters.length > 0) {
      const tags = it.tags || []
      if (!tags.some((t) => tagFilters.includes(t))) return false
    }
    return true
  }, [importanceFilter, masteryFilter, tagFilters])

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
      const subjectId = getSubjectId(selectedSubject)
      if (!subjectId) {
        setAllItems([])
        return
      }

      const pointsData = await apiClient.get<StudyItemApi[]>(`/api/study-items?subject_id=${subjectId}&entry_type=2`)
      setAllItems((Array.isArray(pointsData) ? pointsData : []).map(toUiStudyItem))
    } catch (error) {
      console.error("Failed to load points:", error)
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [selectedSubject, toUiStudyItem])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 科目別タグ候補を取得
  useEffect(() => {
    const fetchStudyTags = async () => {
      try {
        const subjectId = getSubjectId(selectedSubject)
        if (!subjectId) {
          setAvailableTags([])
          return
        }
        const tags = await apiClient.get<StudyTag[]>(`/api/study-tags?subject_id=${subjectId}`)
        setAvailableTags(Array.isArray(tags) ? tags : [])
      } catch (e) {
        console.error("Failed to fetch study tags:", e)
        setAvailableTags([])
      }
    }
    fetchStudyTags()
  }, [selectedSubject])

  // 新しいアイテムを作成
  const createItem = useCallback(async () => {
    try {
      const subjectId = getSubjectId(selectedSubject)
      if (!subjectId) return

      const created = await apiClient.post<StudyItemApi>("/api/study-items", {
        entry_type: 2,
        subject_id: subjectId,
        item: "",
        importance: 1,
        mastery_level: null,
        content: "",
        memo: "",
        tags: [],
      })

      await loadData()
      return created
    } catch (error) {
      console.error("Failed to create item:", error)
      return undefined
    }
  }, [selectedSubject, loadData])

  // フィルター適用後のデータ
  const filteredItems = useMemo(() => {
    return allItems.filter(matchesStudyFilters)
  }, [allItems, matchesStudyFilters])

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

  // アイテム削除
  const deleteItem = async (itemId: number) => {
    try {
      await apiClient.delete(`/api/study-items/${itemId}`)
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
        await apiClient.put(`/api/study-items/${movedItem.id}`, {
          position: newPosition,
        })
      } catch (error) {
        console.error("Failed to reorder item:", error)
        loadData()
      }
    }
  }

  const updateCreatedDate = async (id: number, date: Date, type: "norms" | "points") => {
    const dateStr = date.toISOString().split("T")[0]
    try {
      await apiClient.put(`/api/study-items/${id}`, { created_date: dateStr })
      await loadData()
    } catch (e) {
      console.error("Failed to update created date:", e)
    }
  }

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
        <div className="container mx-auto px-20 py-3 max-w-6xl">
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
              <FileText className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">論点一覧</h1>
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
      <main className="container mx-auto px-20 py-4 max-w-6xl">
        {/* フィルター（重要度・理解度・タグ） */}
        <div className="mb-4 border border-amber-200/60 rounded-lg p-3 bg-white/60">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-semibold text-amber-900/80">フィルター</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">重要度</span>
              <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">すべて</SelectItem>
                  {IMPORTANCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">理解度</span>
              <Select value={masteryFilter} onValueChange={setMasteryFilter}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">すべて</SelectItem>
                  <SelectItem value="unset" className="text-xs">未設定</SelectItem>
                  {MASTERY_LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">タグ</span>
              <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-muted/50">
                    {tagFilters.length > 0 ? (
                      <span className="truncate max-w-[160px]">
                        {tagFilters.slice(0, 3).join(", ")}
                        {tagFilters.length > 3 && ` +${tagFilters.length - 3}`}
                      </span>
                    ) : (
                      "すべて"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold">タグで絞り込み</div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {filterTagOptions.length === 0 ? (
                        <div className="text-xs text-muted-foreground">タグがありません</div>
                      ) : (
                        filterTagOptions.map((tag) => (
                          <div key={tag} className="flex items-center space-x-2">
                            <Checkbox
                              id={`filter-tag-${tag}`}
                              checked={tagFilters.includes(tag)}
                              onCheckedChange={(checked: boolean) => {
                                setTagFilters((prev) =>
                                  checked ? [...prev, tag] : prev.filter((t) => t !== tag)
                                )
                              }}
                            />
                            <label htmlFor={`filter-tag-${tag}`} className="text-xs cursor-pointer flex-1">
                              {tag}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setImportanceFilter("all")
                setMasteryFilter("all")
                setTagFilters([])
              }}
            >
              クリア
            </Button>
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
                    <Table className="min-w-[1200px] table-fixed">
                      {/* 列幅は % だとズレやすいので、pxベースで固定 */}
                      <colgroup>
                        <col className="w-6" />          {/* 操作 */}
                        <col className="w-[180px]" />    {/* 項目 */}
                        <col className="w-[92px]" />     {/* 重要度 */}
                        <col className="w-[92px]" />     {/* 理解度 */}
                        <col className="w-[600px]" />    {/* 内容 */}
                        <col className="w-[400px]" />    {/* メモ */}
                        <col className="w-[100px]" />     {/* タグ */}
                        <col className="w-[96px]" />     {/* 作成日 */}
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-6 sticky top-0 bg-white z-10"></TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">項目</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">重要度</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">理解度</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">内容</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">メモ</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">タグ</TableHead>
                          <TableHead className="text-xs font-semibold text-amber-900/80 sticky top-0 bg-white z-10">作成日</TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableContext items={displayedItems.map(p => p.id.toString())} strategy={verticalListSortingStrategy}>
                        <TableBody>
                          {displayedItems.map((item) => {
                            const pointTags = item.tags || []
                            const allTags = Array.from(new Set([...(availableTags.map(t => t.name)), ...pointTags])).sort()
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
                                <TableCell className="text-xs align-top">
                                  <Input
                                    value={item.item}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setAllItems(prev => prev.map(n => n.id === item.id ? { ...n, item: v } : n))
                                      queueUpdateStudyItem(item.id, { item: v })
                                    }}
                                    placeholder="項目を入力..."
                                    className="h-7 text-xs border-0 shadow-none bg-transparent hover:bg-muted/50 focus:bg-muted/50 focus-visible:ring-0"
                                  />
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <Select
                                    value={item.importance.toString()}
                                    onValueChange={(value) => {
                                      const v = parseInt(value)
                                      const updatedItems = allItems.map(n =>
                                        n.id === item.id ? { ...n, importance: v } : n
                                      )
                                      setAllItems(updatedItems)
                                      queueUpdateStudyItem(item.id, { importance: v })
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                      {item.importance ? (
                                        <span className={`px-1.5 py-0.5 rounded ${getImportanceColor(item.importance)}`}>
                                          {getImportanceLabel(item.importance)}
                                        </span>
                                      ) : (
                                        <SelectValue placeholder="--" />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMPORTANCE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                          <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <Select
                                    value={item.masteryLevel?.toString() ?? "none"}
                                    onValueChange={(value) => {
                                      const v = value === "none" ? null : parseInt(value)
                                      const updatedItems = allItems.map(n =>
                                        n.id === item.id ? { ...n, masteryLevel: v } : n
                                      )
                                      setAllItems(updatedItems)
                                      queueUpdateStudyItem(item.id, { mastery_level: v })
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-16">
                                      {item.masteryLevel ? (
                                        <span className={`px-1.5 py-0.5 rounded ${getMasteryLevelColor(item.masteryLevel)}`}>
                                          {getMasteryLevelLabel(item.masteryLevel)}
                                        </span>
                                      ) : (
                                        <SelectValue placeholder="--" />
                                      )}
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none" className="text-xs">--</SelectItem>
                                      {MASTERY_LEVEL_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                                          <span className={`px-1.5 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <MemoField
                                    value={item.content}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setAllItems(prev => prev.map(n => n.id === item.id ? { ...n, content: v } : n))
                                      queueUpdateStudyItem(item.id, { content: v })
                                    }}
                                    placeholder="内容を入力..."
                                  />
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <MemoField
                                    value={item.memo}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setAllItems(prev => prev.map(n => n.id === item.id ? { ...n, memo: v } : n))
                                      queueUpdateStudyItem(item.id, { memo: v })
                                    }}
                                    placeholder="メモを入力..."
                                  />
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <Popover
                                    open={tagsPopoverOpen[item.id] || false}
                                    onOpenChange={(open) => {
                                      setTagsPopoverOpen(prev => ({ ...prev, [item.id]: open }))
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2 hover:bg-muted/50"
                                      >
                                        {pointTags.length > 0 ? (
                                          <span className="truncate max-w-[60px]">
                                            {pointTags.slice(0, 2).join(", ")}
                                            {pointTags.length > 2 && ` +${pointTags.length - 2}`}
                                          </span>
                                        ) : (
                                          "タグを選択"
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3" align="start">
                                      <div className="space-y-2">
                                        <div className="text-xs font-semibold mb-2">タグを選択</div>
                                        <div className="max-h-48 overflow-y-auto space-y-2">
                                          {allTags.length === 0 ? (
                                            <div className="text-xs text-muted-foreground">タグがありません</div>
                                          ) : (
                                            allTags.map((tag) => (
                                              <div key={tag} className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`tag-${item.id}-${tag}`}
                                                  checked={pointTags.includes(tag)}
                                                  onCheckedChange={(checked: boolean) => {
                                                    const updatedTags = checked
                                                      ? [...pointTags, tag]
                                                      : pointTags.filter(t => t !== tag)
                                                    const updatedItems = allItems.map(n =>
                                                      n.id === item.id ? { ...n, tags: updatedTags } : n
                                                    )
                                                    setAllItems(updatedItems)
                                                    queueUpdateStudyItem(item.id, { tags: updatedTags })
                                                  }}
                                                />
                                                <label
                                                  htmlFor={`tag-${item.id}-${tag}`}
                                                  className="text-xs cursor-pointer flex-1"
                                                >
                                                  {tag}
                                                </label>
                                                {availableTags.some((t) => t.subject_id === getSubjectId(selectedSubject) && t.name === tag) && (
                                                  <button
                                                    type="button"
                                                    className="p-1 rounded hover:bg-muted"
                                                    title="候補から削除"
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      deleteStudyTagCandidate(tag)
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                  </button>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                        <Input
                                          placeholder="新規タグを追加..."
                                          className="h-7 text-xs mt-2"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              const input = e.currentTarget
                                              const newTag = input.value.trim()
                                              if (newTag && !pointTags.includes(newTag)) {
                                                const subjectId = getSubjectId(selectedSubject)
                                                if (subjectId) {
                                                  apiClient.post<StudyTag>("/api/study-tags", { subject_id: subjectId, name: newTag })
                                                    .then((created) => {
                                                      setAvailableTags(prev => {
                                                        if (prev.some(t => t.id === created.id)) return prev
                                                        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
                                                      })
                                                    })
                                                    .catch((err) => console.error("Failed to create study tag:", err))
                                                }
                                                const updatedItems = allItems.map(n =>
                                                  n.id === item.id ? { ...n, tags: [...pointTags, newTag] } : n
                                                )
                                                setAllItems(updatedItems)
                                                queueUpdateStudyItem(item.id, { tags: [...pointTags, newTag] })
                                                input.value = ""
                                              }
                                            }
                                          }}
                                        />
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell className="text-xs align-top">
                                  <Popover
                                    open={createdDatePickerOpen[item.id] || false}
                                    onOpenChange={(open) => {
                                      setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: open }))
                                    }}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2 hover:bg-muted/50"
                                      >
                                        {item.createdAt}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-3" align="start">
                                      <DatePickerCalendar
                                        selectedDate={item.createdAt ? (() => {
                                          const [month, day] = item.createdAt.split('/')
                                          const currentYear = new Date().getFullYear()
                                          return new Date(currentYear, parseInt(month) - 1, parseInt(day))
                                        })() : null}
                                        onSelect={(date) => {
                                          if (date) {
                                            updateCreatedDate(item.id, date, "points")
                                            setCreatedDatePickerOpen(prev => ({ ...prev, [item.id]: false }))
                                          }
                                        }}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                              </SortableRow>
                            )
                          })}
                        </TableBody>
                      </SortableContext>
                    </Table>
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

export default withAuth(PointsPage, { requireAuth: true })
