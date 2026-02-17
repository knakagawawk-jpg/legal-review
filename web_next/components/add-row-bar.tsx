"use client"

import { Plus } from "lucide-react"

interface AddRowBarProps {
  onClick: () => void
  label?: string
}

/**
 * テーブル直下に配置する追加行バー。
 * テーブルと独立し、スクロール対象外（幅は表示幅に依存）。
 * テーブル1行風の見た目だが、高さは抑えめ。
 */
export function AddRowBar({ onClick, label = "行を追加" }: AddRowBarProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="flex-shrink-0 w-full min-h-6 py-1 px-2 border-t border-border border-dashed flex items-center hover:bg-muted/50 transition-colors cursor-pointer bg-background"
    >
      <span className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
    </div>
  )
}
