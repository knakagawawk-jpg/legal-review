"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { GripVertical, Trash2, CalendarDays } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

interface SortableRowProps<T extends { id: number }> {
  item: T
  children: React.ReactNode
  onDelete: (id: number) => void
  onEditCreatedDate?: (id: number) => void
  showCreatedDateButton?: boolean
  /** entry_type: 1=MEMO, 2=Topic, 3=Target。他タイプに変換ボタン・ダイアログの表示用 */
  entryType?: 1 | 2 | 3
  onConvertToTopic?: (id: number) => void
  onConvertToMemo?: (id: number) => void
  onConvertToTarget?: (id: number) => void
  /** 他タイプに変換確認ダイアログ用。当該行の「項目」のテキスト */
  itemText?: string
  className?: string
  usePortal?: boolean
}

export function SortableRow<T extends { id: number }>({
  item,
  children,
  onDelete,
  onEditCreatedDate,
  showCreatedDateButton = false,
  entryType,
  onConvertToTopic,
  onConvertToMemo,
  onConvertToTarget,
  itemText = "",
  className = "",
  usePortal = false,
}: SortableRowProps<T>) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
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
  const handleButtonRef = useRef<HTMLButtonElement>(null)
  const clickStartPos = useRef<{ x: number; y: number } | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current && menuRef.current.contains(target)) return
      if (usePortal && handleButtonRef.current && handleButtonRef.current.contains(target)) return
      if (showMenu) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [showMenu, usePortal])

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

  // entryType=1なら Topic(2)/Target(3) に転換、entryType=2なら MEMO(1)/Target(3)、entryType=3なら MEMO(1)/Topic(2)
  const hasAnyConvert = (entryType === 1 && (onConvertToTopic || onConvertToTarget)) ||
    (entryType === 2 && (onConvertToMemo || onConvertToTarget)) ||
    (entryType === 3 && (onConvertToMemo || onConvertToTopic))

  const menuContent = (
    <div
      ref={menuRef}
      className={cn(
        "flex gap-1 bg-card border rounded shadow-lg p-1",
        usePortal ? "fixed z-[9999]" : "absolute left-6 top-1/2 -translate-y-1/2 z-10"
      )}
      style={usePortal && menuPos ? {
        left: menuPos.left,
        top: menuPos.top,
        transform: "translateY(-50%)",
      } : undefined}
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
      {onEditCreatedDate && showCreatedDateButton && (
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
      {hasAnyConvert ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] bg-muted hover:bg-muted/80 whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setConvertDialogOpen(true)
            setShowMenu(false)
          }}
        >
          他タイプに転換
        </Button>
      ) : null}
    </div>
  )

  const convertMessage =
    entryType === 1
      ? `「${itemText}」のMEMOを他タイプに転換してもよろしいですか。`
      : entryType === 2
        ? `「${itemText}」のTopicを他タイプに転換してもよろしいですか。`
        : entryType === 3
          ? `「${itemText}」のTargetを他タイプに転換してもよろしいですか。`
          : ""

  const convertDialogContent = (
    <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>他タイプに転換</AlertDialogTitle>
          <AlertDialogDescription>{convertMessage}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {entryType !== 2 && onConvertToTopic && (
            <AlertDialogAction
              onClick={() => {
                onConvertToTopic(item.id)
                setConvertDialogOpen(false)
              }}
            >
              Topicに転換
            </AlertDialogAction>
          )}
          {entryType !== 1 && onConvertToMemo && (
            <AlertDialogAction
              onClick={() => {
                onConvertToMemo(item.id)
                setConvertDialogOpen(false)
              }}
            >
              MEMOに転換
            </AlertDialogAction>
          )}
          {entryType !== 3 && onConvertToTarget && (
            <AlertDialogAction
              onClick={() => {
                onConvertToTarget(item.id)
                setConvertDialogOpen(false)
              }}
            >
              Targetに転換
            </AlertDialogAction>
          )}
          <AlertDialogCancel>No</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return (
    <>
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-amber-50/40",
        isDragging && "opacity-50 bg-amber-50",
        className
      )}
    >
      <TableCell className="py-1.5 px-1 w-6 relative">
        <button
          ref={handleButtonRef}
          {...attributes}
          {...listeners}
          onMouseDown={handleMouseDown}
          onClick={handleClick}
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        {showMenu && (
          usePortal && typeof document !== "undefined" && menuPos
            ? createPortal(menuContent, document.body)
            : !usePortal
            ? menuContent
            : null
        )}
      </TableCell>
      {children}
    </TableRow>
    {hasAnyConvert && typeof document !== "undefined" && createPortal(convertDialogContent, document.body)}
    </>
  )
}
