"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface ImportantPointCardProps {
  paragraph_number: number
  what_is_good: string
  what_is_lacking: string
  why_important: string
}

export function ImportantPointCard({
  paragraph_number,
  what_is_good,
  what_is_lacking,
  why_important,
}: ImportantPointCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          className="px-3 py-1 text-sm font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          onClick={() => {
            console.log(`Jump to paragraph ${paragraph_number}`)
          }}
        >
          第{paragraph_number}段落
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isExpanded ? "閉じる" : "詳細を見る"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-2">なぜ重要か</p>
      <p className="text-sm text-foreground/80 leading-relaxed">{why_important}</p>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md border-l-2 border-green-500">
            <p className="text-xs text-green-700 dark:text-green-300 mb-1 font-medium">十分に書けている点</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{what_is_good}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md border-l-2 border-red-500">
            <p className="text-xs text-red-700 dark:text-red-300 mb-1 font-medium">不足している点</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{what_is_lacking}</p>
          </div>
        </div>
      )}
    </div>
  )
}
