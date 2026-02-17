"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { ListTodo, ArrowLeft, Plus, Calendar as CalendarIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { TableCell } from "@/components/ui/table"
import { useSidebar, SidebarToggle } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectName, getSubjectId, getSubjectShortName } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ItemField } from "@/components/item-field"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerCalendar } from "@/components/ui/calendar"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { SUBJECT_COLORS, TASK_STATUS_OPTIONS } from "@/lib/dashboard-constants"
import type { DashboardItem } from "@/types/dashboard"
import { MainTableItems, type MainTableItemsFilterState } from "@/components/MainTableItems"
import { MemoField } from "@/components/memo-field"

const TOPICS_HEADERS = [
  { id: "subject", label: "科目", width: "5rem", minWidth: "5rem" },
  { id: "item", label: "項目", minWidth: "112px", maxWidth: "210px" },
  { id: "created", label: "作成", width: "5rem", minWidth: "5rem", className: "text-center" },
  { id: "due", label: "期限", width: "5rem", minWidth: "5rem" },
  { id: "status", label: "状態", width: "5rem", minWidth: "5rem" },
  { id: "memo", label: "メモ", minWidth: "399px" },
  { id: "fav", label: "♡", width: "3rem", className: "text-center" },
]

function TopicsPage() {
  const router = useRouter()
  const { mainContentStyle } = useSidebar()
  const [allItems, setAllItems] = useState<DashboardItem[]>([])
  const [displayedItems, setDisplayedItems] = useState<DashboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [createdDatePickerOpen, setCreatedDatePickerOpen] = useState<Record<number, boolean>>({})

  const itemsPerPage = 20

  const [filterState, setFilterState] = useState<MainTableItemsFilterState>({
    subjectFilter: null,
    statusFilter: null,
    startDate: undefined,
    endDate: undefined,
    favoriteFilter: "all",
  })

  const favoriteUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const memoUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingMemoUpdates = useRef<Record<number, string>>({})
  const itemUpdateTimers = useRef<Record<number, NodeJS.Timeout>>({})
  const pendingItemUpdates = useRef<Record<number, Partial<DashboardItem>>>({})
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<{ items: DashboardItem[]; total: number }>("/api/dashboard/items/all?entry_type=2")
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

  const createItem = useCallback(async () => {
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
      console.error("Failed to create item:", error)
    }
  }, [loadData])

  const filteredItems = useMemo(() => {
    let filtered = [...allItems]
    if (filterState.subjectFilter !== null) {
      const subjectId = getSubjectId(filterState.subjectFilter)
      filtered = filtered.filter((item) =>
        subjectId !== null ? item.subject === subjectId : getSubjectName(item.subject || 0) === filterState.subjectFilter
      )
    }
    if (filterState.statusFilter !== null) {
      filtered = filtered.filter((item) => item.status === filterState.statusFilter)
    }
    if (filterState.startDate) {
      const startStr = new Date(filterState.startDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter((item) => !item.created_at || item.created_at >= startStr)
    }
    if (filterState.endDate) {
      const endStr = new Date(filterState.endDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }))
        .toISOString()
        .split("T")[0]
      filtered = filtered.filter((item) => !item.created_at || item.created_at <= endStr)
    }
    if (filterState.favoriteFilter === "fav-only") {
      filtered = filtered.filter((item) => item.favorite === 1)
    } else if (filterState.favoriteFilter === "fav-except") {
      filtered = filtered.filter((item) => item.favorite === 0)
    }
    filtered.sort((a, b) => {
      if (a.favorite !== b.favorite) return b.favorite - a.favorite
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
    return filtered
  }, [allItems, filterState])

  useEffect(() => {
    if (!loading) {
      const initial = filteredItems.slice(0, itemsPerPage)
      setDisplayedItems(initial)
      setHasMore(initial.length < filteredItems.length)
    }
  }, [filteredItems, loading])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setTimeout(() => {
      const next = filteredItems.slice(0, displayedItems.length + itemsPerPage)
      setDisplayedItems(next)
      setHasMore(next.length < filteredItems.length)
      setLoadingMore(false)
    }, 300)
  }, [displayedItems.length, filteredItems, hasMore, loadingMore])

  const updateFavorite = useCallback(async (itemId: number, favorite: number) => {
    if (favoriteUpdateTimers.current[itemId]) clearTimeout(favoriteUpdateTimers.current[itemId])
    setAllItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, favorite } : item)))
    favoriteUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        await apiClient.put(`/api/dashboard/items/${itemId}`, { favorite })
        delete favoriteUpdateTimers.current[itemId]
      } catch (error) {
        console.error("Failed to update favorite:", error)
        setAllItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, favorite: 1 - favorite } : item)))
      }
    }, 5000)
  }, [])

  const updateMemo = useCallback(async (itemId: number, memo: string) => {
    setAllItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, memo } : item)))
    if (memoUpdateTimers.current[itemId]) clearTimeout(memoUpdateTimers.current[itemId])
    pendingMemoUpdates.current[itemId] = memo
    memoUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        const toSave = pendingMemoUpdates.current[itemId]
        await apiClient.put(`/api/dashboard/items/${itemId}`, { memo: toSave })
        delete memoUpdateTimers.current[itemId]
        delete pendingMemoUpdates.current[itemId]
      } catch (error) {
        console.error("Failed to update memo:", error)
        delete memoUpdateTimers.current[itemId]
        delete pendingMemoUpdates.current[itemId]
      }
    }, 5000)
  }, [])

  const updateItemField = useCallback(
    async (itemId: number, field: keyof DashboardItem, value: unknown) => {
      setAllItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)))
      if (itemUpdateTimers.current[itemId]) clearTimeout(itemUpdateTimers.current[itemId])
      pendingItemUpdates.current[itemId] = {
        ...pendingItemUpdates.current[itemId],
        [field]: value,
      }
      itemUpdateTimers.current[itemId] = setTimeout(async () => {
        try {
          const updateData = pendingItemUpdates.current[itemId]
          await apiClient.put(`/api/dashboard/items/${itemId}`, updateData)
          delete itemUpdateTimers.current[itemId]
          delete pendingItemUpdates.current[itemId]
        } catch (error) {
          console.error("Failed to update item field:", error)
          await loadData()
          delete itemUpdateTimers.current[itemId]
          delete pendingItemUpdates.current[itemId]
        }
      }, 800)
    },
    [loadData]
  )

  const deleteItem = useCallback(
    async (itemId: number) => {
      try {
        await apiClient.delete(`/api/dashboard/items/${itemId}`)
        loadData()
      } catch (error) {
        console.error("Failed to delete item:", error)
      }
    },
    [loadData]
  )

  const convertToMemo = useCallback(async (itemId: number) => {
    try {
      await apiClient.put(`/api/dashboard/items/${itemId}`, { entry_type: 1 })
      loadData()
    } catch (error) {
      console.error("Failed to convert to memo:", error)
    }
  }, [loadData])

  const convertToTarget = useCallback(async (itemId: number) => {
    try {
      await apiClient.put(`/api/dashboard/items/${itemId}`, { entry_type: 3 })
      loadData()
    } catch (error) {
      console.error("Failed to convert to target:", error)
    }
  }, [loadData])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = allItems.findIndex((i) => i.id.toString() === String(active.id))
      const newIndex = allItems.findIndex((i) => i.id.toString() === String(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      const newItems = arrayMove(allItems, oldIndex, newIndex)
      setAllItems(newItems)
      const moved = newItems[newIndex]
      const prev = newIndex > 0 ? newItems[newIndex - 1] : null
      const next = newIndex < newItems.length - 1 ? newItems[newIndex + 1] : null
      let newPosition: number
      if (prev && next) newPosition = Math.floor((prev.position + next.position) / 2)
      else if (prev) newPosition = prev.position + 10
      else if (next) newPosition = next.position - 10
      else newPosition = 10

      try {
        await apiClient.put(`/api/dashboard/items/${moved.id}`, { position: newPosition })
      } catch (error) {
        console.error("Failed to reorder item:", error)
        loadData()
      }
    },
    [allItems, loadData]
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ""
    const d = new Date(dateString)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const subjects = FIXED_SUBJECTS.map((name) => ({ id: getSubjectId(name), name })).filter(
    (s) => s.id !== null
  ) as Array<{ id: number; name: string }>

  const renderRow = useCallback(
    (item: DashboardItem) => {
      const statusOption = TASK_STATUS_OPTIONS.find((s) => s.value === item.status)
      const selectedSubject = subjects.find((s) => s.id === item.subject)
      const createdDate = item.created_at ? formatDate(item.created_at) : ""
      return (
        <>
          <TableCell className="py-2 px-2 w-20 align-top">
            <Select
              value={item.subject?.toString() || undefined}
              onValueChange={(v) => updateItemField(item.id, "subject", v ? parseInt(v) : null)}
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
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                    <span className={cn(SUBJECT_COLORS[s.name] && `px-1.5 py-0.5 rounded ${SUBJECT_COLORS[s.name]}`)}>
                      {getSubjectShortName(s.name)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-2 px-2 min-w-[112px] max-w-[210px] align-top">
            <ItemField value={item.item} onChange={(e) => updateItemField(item.id, "item", e.target.value)} className="w-full" />
          </TableCell>
          <TableCell className="py-2 px-2 w-20 text-xs text-muted-foreground text-center relative align-top">
            <Popover
              open={createdDatePickerOpen[item.id] || false}
              onOpenChange={(open) => setCreatedDatePickerOpen((p) => ({ ...p, [item.id]: open }))}
            >
              <PopoverTrigger asChild>
                <button type="button" className="w-full h-full hover:bg-muted/50 rounded px-1">
                  {createdDate}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <DatePickerCalendar
                  selectedDate={item.created_at ? new Date(item.created_at) : null}
                  onSelect={(date) => {
                    if (date) {
                      updateItemField(item.id, "created_at", date.toISOString().split("T")[0])
                      setCreatedDatePickerOpen((p) => ({ ...p, [item.id]: false }))
                    }
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
              onValueChange={(v) => updateItemField(item.id, "status", parseInt(v))}
            >
              <SelectTrigger className="h-7 text-[10px] border-0 px-1 w-20">
                {statusOption ? (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", statusOption.color)}>{statusOption.label}</span>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUS_OPTIONS.filter((o) => o.value != null).map((o) => (
                  <SelectItem key={o.value} value={o.value.toString()} className="text-xs">
                    <span className={cn("px-1.5 py-0.5 rounded", o.color)}>{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="py-2 px-2 align-top min-w-[399px]">
            <MemoField value={item.memo || ""} onChange={(e) => updateMemo(item.id, e.target.value)} />
          </TableCell>
          <TableCell className="py-2 px-2 w-12 align-top text-center">
            <button
              type="button"
              onClick={() => updateFavorite(item.id, item.favorite === 1 ? 0 : 1)}
              className={cn("text-lg transition-colors", item.favorite === 1 ? "text-red-500" : "text-gray-300")}
            >
              <Heart className={cn("h-4 w-4", item.favorite === 1 && "fill-current")} />
            </button>
          </TableCell>
        </>
      )
    },
    [subjects, updateItemField, updateMemo, updateFavorite, createdDatePickerOpen]
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-orange-50/30 transition-all duration-300" style={mainContentStyle}>
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-amber-200/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-3 max-w-7xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SidebarToggle />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ListTodo className="h-4 w-4 text-amber-600" />
              <h1 className="text-base font-semibold text-amber-900">Your Topics</h1>
            </div>
            <Button variant="outline" size="sm" onClick={createItem} className="h-7 text-xs gap-1 bg-transparent px-2">
              <Plus className="h-3 w-3" />
              追加
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 max-w-7xl">
        <Card className="shadow-sm border-amber-200/60">
          <CardContent className="p-4">
            <MainTableItems
              items={displayedItems}
              loading={loading}
              emptyMessage="データがありません"
              showAddButton
              onAdd={createItem}
              filterVisible
              filterState={filterState}
              onFilterChange={setFilterState}
              statusOptionsForFilter={[...TASK_STATUS_OPTIONS]}
              statusFilterAllLabel="全状態"
              headerColumns={TOPICS_HEADERS}
              renderRow={renderRow}
              onDragEnd={handleDragEnd}
              onDelete={deleteItem}
              showCreatedDateButton
              onEditCreatedDate={(id) => setCreatedDatePickerOpen((p) => ({ ...p, [id]: true }))}
              entryType={2}
              onConvertToMemo={convertToMemo}
              onConvertToTarget={convertToTarget}
              minWidth="629px"
              footer={
                hasMore ? (
                  <Button onClick={loadMore} disabled={loadingMore} variant="outline" size="sm" className="text-xs">
                    {loadingMore ? "読み込み中..." : "さらに読み込む…"}
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default withAuth(TopicsPage, { requireAuth: true })
