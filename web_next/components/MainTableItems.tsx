"use client"

import { useState, useCallback } from "react"
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerCalendar } from "@/components/ui/calendar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { FIXED_SUBJECTS, getSubjectShortName } from "@/lib/subjects"
import { SortableRow } from "@/components/sortable-row"
import type { DashboardItem } from "@/types/dashboard"
import { SUBJECT_COLORS } from "@/lib/dashboard-constants"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CalendarIcon, ChevronDown } from "lucide-react"
import { MemoField } from "@/components/memo-field"
import { AddRowBar } from "@/components/add-row-bar"
import { TableWithAddRow } from "@/components/table-with-add-row"

export type MainTableItemsFilterState = {
  subjectFilter: string | null
  statusFilter: number | null
  startDate: Date | undefined
  endDate: Date | undefined
  favoriteFilter: "fav-only" | "fav-except" | "all"
}

type StatusOption = { value: number; label: string }

interface MainTableItemsProps {
  items: DashboardItem[]
  loading?: boolean
  emptyMessage?: string
  showAddButton?: boolean
  onAdd?: () => void
  filterVisible?: boolean
  filterState?: MainTableItemsFilterState
  onFilterChange?: (state: MainTableItemsFilterState) => void
  statusOptionsForFilter?: StatusOption[]
  statusFilterAllLabel?: string
  headerColumns: { id: string; label: string; width?: string; minWidth?: string; maxWidth?: string; className?: string }[]
  renderRow: (item: DashboardItem) => React.ReactNode
  onDragEnd: (event: DragEndEvent) => void
  onDelete: (id: number) => void
  showCreatedDateButton?: boolean
  onEditCreatedDate?: (id: number) => void
  entryType?: 1 | 2 | 3
  onConvertToTopic?: (id: number) => void
  onConvertToMemo?: (id: number) => void
  onConvertToTarget?: (id: number) => void
  emptyRowEnabled?: boolean
  onCreateFromDraft?: (draft: Partial<DashboardItem>) => Promise<void>
  renderEmptyRow?: (
    draft: Partial<DashboardItem>,
    updateDraft: (field: keyof DashboardItem, value: unknown) => void,
    confirm: () => void
  ) => React.ReactNode
  tableClassName?: string
  minWidth?: string
  scrollMaxHeight?: string
  placeholderRowCount?: number
  /** Renders below the table (e.g. "load more" button) */
  footer?: React.ReactNode
}

const defaultFilterState: MainTableItemsFilterState = {
  subjectFilter: null,
  statusFilter: null,
  startDate: undefined,
  endDate: undefined,
  favoriteFilter: "all",
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Re-export for convenience; use @/components/memo-field for new code */
export { MemoField }

export function MainTableItems({
  items,
  loading = false,
  emptyMessage = "\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093",
  showAddButton = false,
  onAdd,
  filterVisible = false,
  filterState = defaultFilterState,
  onFilterChange,
  statusOptionsForFilter = [],
  statusFilterAllLabel = "\u5168\u985e\u5225",
  headerColumns,
  renderRow,
  onDragEnd,
  onDelete,
  showCreatedDateButton = false,
  onEditCreatedDate,
  entryType,
  onConvertToTopic,
  onConvertToMemo,
  onConvertToTarget,
  emptyRowEnabled = false,
  onCreateFromDraft,
  renderEmptyRow,
  tableClassName,
  minWidth,
  scrollMaxHeight,
  placeholderRowCount = 0,
  footer,
}: MainTableItemsProps) {
  const [draft, setDraft] = useState<Partial<DashboardItem>>({})
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const updateDraft = useCallback((field: keyof DashboardItem, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }, [])

  const confirmDraft = useCallback(() => {
    const hasValid = (draft.item?.trim() ?? "") !== "" || (draft.memo?.trim() ?? "") !== ""
    if (!hasValid || !onCreateFromDraft) return
    onCreateFromDraft(draft).then(() => setDraft({}))
  }, [draft, onCreateFromDraft])

  const state = filterState ?? defaultFilterState
  const setState = useCallback(
    (next: Partial<MainTableItemsFilterState>) => {
      onFilterChange?.({ ...state, ...next })
    },
    [state, onFilterChange]
  )

  const columnCount = headerColumns.length + 1

  const tableContent = (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="flex flex-col min-h-0">
        <TableWithAddRow
          maxHeight={scrollMaxHeight}
          addRowBar={showAddButton && onAdd ? <AddRowBar onClick={onAdd} /> : undefined}
        >
          <table className={cn("w-full text-sm", tableClassName)} style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <TableHead className="py-2 px-2 w-6" />
              {headerColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn("py-2 px-2 text-left font-medium", col.className)}
                  style={
                    col.width || col.minWidth || col.maxWidth
                      ? {
                          width: col.width,
                          minWidth: col.minWidth ?? col.width,
                          maxWidth: col.maxWidth ?? col.width,
                        }
                      : undefined
                  }
                >
                  {col.label}
                </TableHead>
              ))}
            </tr>
          </thead>
          <SortableContext items={items.map((i) => i.id.toString())} strategy={verticalListSortingStrategy}>
            <TableBody>
              {loading ? (
                <tr>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-6 text-sm">
                    \u8aad\u307f\u8fbc\u307f\u4e2d...
                  </TableCell>
                </tr>
              ) : items.length === 0 && !emptyRowEnabled ? (
                <tr>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground py-6 text-sm">
                    {emptyMessage}
                  </TableCell>
                </tr>
              ) : (
                <>
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onDelete={onDelete}
                      onEditCreatedDate={onEditCreatedDate}
                      showCreatedDateButton={showCreatedDateButton}
                      entryType={entryType}
                      onConvertToTopic={onConvertToTopic}
                      onConvertToMemo={onConvertToMemo}
                      onConvertToTarget={onConvertToTarget}
                      itemText={item.item}
                    >
                      {renderRow(item)}
                    </SortableRow>
                  ))}
                  {emptyRowEnabled && renderEmptyRow && (
                    <TableRow className="hover:bg-amber-50/40">
                      <TableCell className="py-1.5 px-1 w-6" />
                      {renderEmptyRow(draft, updateDraft, confirmDraft)}
                    </TableRow>
                  )}
                  {placeholderRowCount > 0 && Array.from({ length: placeholderRowCount }).map((_, i) => (
                    <TableRow key={`placeholder-${i}`} className="border-b border-border">
                      <TableCell colSpan={columnCount} className="py-1.5 px-2 h-8" />
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </SortableContext>
        </table>
        </TableWithAddRow>
        {footer && (
          <div className="flex-shrink-0 flex justify-center py-3 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </DndContext>
  )

  return (
    <div className="flex flex-col min-h-0">
      {filterVisible && onFilterChange && (
        <div className="sticky top-0 z-10 flex-shrink-0 flex flex-wrap items-center justify-end gap-2 py-2 px-2 border-b border-border bg-background">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md border border-input bg-background hover:bg-muted">
                  {state.subjectFilter ? (
                    <span className={cn(SUBJECT_COLORS[state.subjectFilter] && "px-1.5 py-0.5 rounded", SUBJECT_COLORS[state.subjectFilter] || "")}>
                      {getSubjectShortName(state.subjectFilter)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">\u5168\u79d1\u76ee</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-32">
                <DropdownMenuItem
                  onClick={() => setState({ subjectFilter: null })}
                  className={cn("text-xs cursor-pointer rounded-sm bg-gray-100 text-gray-700", state.subjectFilter === null && "ring-2 ring-offset-1 ring-amber-500 font-medium")}
                >
                  \u5168\u79d1\u76ee
                </DropdownMenuItem>
                {FIXED_SUBJECTS.map((subject) => {
                  const color = SUBJECT_COLORS[subject] || ""
                  return (
                    <DropdownMenuItem
                      key={subject}
                      onClick={() => setState({ subjectFilter: subject })}
                      className={cn("text-xs cursor-pointer rounded-sm", state.subjectFilter === subject && "ring-2 ring-offset-1 ring-amber-500 font-medium")}
                    >
                      <span className={color ? `px-1.5 py-0.5 rounded ${color}` : ""}>{getSubjectShortName(subject)}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {statusOptionsForFilter.length > 0 && (
              <Select
                value={state.statusFilter?.toString() ?? "all"}
                onValueChange={(v) => setState({ statusFilter: v === "all" ? null : parseInt(v) })}
              >
                <SelectTrigger size="xs" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    {statusFilterAllLabel}
                  </SelectItem>
                  {statusOptionsForFilter.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {state.startDate ? formatDate(state.startDate.toISOString()) : "\u958b\u59cb\u65e5"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar selectedDate={state.startDate ?? null} onSelect={(date) => setState({ startDate: date ?? undefined })} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">?</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {state.endDate ? formatDate(state.endDate.toISOString()) : "\u7d42\u4e86\u65e5"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <DatePickerCalendar selectedDate={state.endDate ?? null} onSelect={(date) => setState({ endDate: date ?? undefined })} />
              </PopoverContent>
            </Popover>
            <Select
              value={state.favoriteFilter}
              onValueChange={(v) => setState({ favoriteFilter: v as MainTableItemsFilterState["favoriteFilter"] })}
            >
              <SelectTrigger size="xs" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fav-only" className="text-xs">
                  fav\u307e\u306b
                </SelectItem>
                <SelectItem value="fav-except" className="text-xs">
                  fav\u4ee5\u5916
                </SelectItem>
                <SelectItem value="all" className="text-xs">
                  \u30d5\u30a3\u30eb\u30bf\u30fc\u306a\u3057
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {tableContent}
    </div>
  )
}
