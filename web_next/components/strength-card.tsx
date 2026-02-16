"use client"

import { Badge } from "@/components/ui/badge"

interface StrengthCardProps {
  category: string
  description: string
  paragraph_numbers: number[]
}

export function StrengthCard({ category, description, paragraph_numbers }: StrengthCardProps) {
  return (
    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg border-l-4 border-green-500 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0 text-xs font-medium">
          {category}
        </Badge>
        <div className="flex gap-1 flex-wrap">
          {paragraph_numbers.filter((num) => num > 0).map((num) => (
            <button
              key={num}
              className="px-2 py-0.5 text-xs rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
              onClick={() => {
                // 段落へのジャンプ機能
                console.log(`Jump to paragraph ${num}`)
              }}
            >
              §{num}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{description}</p>
    </div>
  )
}
