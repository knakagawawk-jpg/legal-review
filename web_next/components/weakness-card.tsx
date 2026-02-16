"use client"

import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface WeaknessCardProps {
  category: string
  description: string
  paragraph_numbers: number[]
  suggestion?: string
}

export function WeaknessCard({ category, description, paragraph_numbers, suggestion }: WeaknessCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg border-l-4 border-red-500 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-0 text-xs font-medium">
          {category}
        </Badge>
        <div className="flex gap-1 flex-wrap">
          {paragraph_numbers.filter((num) => num > 0).map((num) => (
            <button
              key={num}
              className="px-2 py-0.5 text-xs rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
              onClick={() => {
                console.log(`Jump to paragraph ${num}`)
              }}
            >
              §{num}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{description}</p>

      {suggestion && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            改善提案を{isExpanded ? "閉じる" : "見る"}
          </button>
          {isExpanded && (
            <div className="mt-2 p-3 bg-card rounded-md border border-red-200 dark:border-red-800">
              <p className="text-sm text-muted-foreground leading-relaxed">{suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
