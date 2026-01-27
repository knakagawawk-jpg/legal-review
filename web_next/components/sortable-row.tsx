"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { GripVertical, Trash2, CalendarDays } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"

interface SortableRowProps<T extends { id: number }> {
  item: T
  children: React.ReactNode
  onDelete: (id: number) => void
  onEditCreatedDate?: (id: number) => void
  showCreatedDateButton?: boolean
  className?: string
  usePortal?: boolean
}

export function SortableRow<T extends { id: number }>({
  item,
  children,
  onDelete,
  onEditCreatedDate,
  showCreatedDateButton = false,
  className = "",
  usePortal = false,
}: SortableRowProps<T>) {
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
    </div>
  )

  return (
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
  )
}
