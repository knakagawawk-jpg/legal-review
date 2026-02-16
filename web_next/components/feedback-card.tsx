"use client"

import type { MouseEvent } from "react"
import { TrendingUp, AlertCircle, Lightbulb, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export const FeedbackCard = ({
  type,
  category,
  description,
  paragraphs,
  suggestion,
  onParagraphClick,
  onCopyToChat,
  isChatTabVisible,
}: {
  type: "strength" | "weakness" | "point"
  category: string
  description: string
  paragraphs?: number[]
  suggestion?: string
  /** §N またはカードクリック時に呼ばれる。(スクロール先の番号, ハイライトする番号の配列)。配列省略時はスクロール先のみハイライト */
  onParagraphClick?: (scrollTo: number, highlight?: number[]) => void
  /** カードクリック時にチャット入力へコピーするテキストを渡す（講評ページでチャットタブ表示時のみ挿入される） */
  onCopyToChat?: (text: string) => void
  /** チャットタブ表示中なら true。true のときはクリックでコピーのみ行い答案タブへの切替・スクロールは行わない */
  isChatTabVisible?: boolean
}) => {
  const config = {
    strength: {
      icon: TrendingUp,
      wrapper: "bg-gradient-to-r from-success-muted to-transparent border-l-4 border-l-success",
      iconClass: "text-success bg-success/10",
      badgeClass: "bg-success/10 text-success",
    },
    weakness: {
      icon: AlertCircle,
      wrapper: "bg-gradient-to-r from-error-muted to-transparent border-l-4 border-l-error",
      iconClass: "text-error bg-error/10",
      badgeClass: "bg-error/10 text-error",
    },
    point: {
      icon: Lightbulb,
      wrapper: "bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-l-primary",
      iconClass: "text-primary bg-primary/10",
      badgeClass: "bg-primary/10 text-primary",
    },
  }

  const { icon: Icon, wrapper, iconClass, badgeClass } = config[type]

  const validParagraphs = paragraphs?.filter((p) => p > 0) ?? []
  const firstParagraph = validParagraphs.length > 0 ? Math.min(...validParagraphs) : null
  const handleCardClick = () => {
    if (isChatTabVisible && onCopyToChat) {
      const copyText = description + (validParagraphs.length > 0 ? `（§${validParagraphs.join("，§")}）` : "")
      onCopyToChat(copyText)
      return
    }
    if (firstParagraph != null && onParagraphClick) onParagraphClick(firstParagraph, validParagraphs)
  }
  const handleSectionClick = (p: number) => (e: MouseEvent) => {
    e.stopPropagation()
    if (isChatTabVisible && onCopyToChat) {
      onCopyToChat(description + `（§${p}）`)
      return
    }
    onParagraphClick?.(p)
  }

  const isClickable = (firstParagraph != null && onParagraphClick) || (isChatTabVisible && onCopyToChat)
  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleCardClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleCardClick()
              }
            }
          : undefined
      }
      className={cn(
        "rounded-xl p-4 transition-all hover:shadow-md",
        isClickable && "cursor-pointer",
        wrapper,
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{category}</span>
            {validParagraphs.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {validParagraphs.map((p) =>
                  onParagraphClick || (isChatTabVisible && onCopyToChat) ? (
                    <button
                      key={p}
                      type="button"
                      onClick={handleSectionClick(p)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-pointer hover:opacity-80 transition-opacity",
                        badgeClass,
                      )}
                    >
                      §{p}
                    </button>
                  ) : (
                    <span key={p} className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", badgeClass)}>
                      §{p}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {suggestion && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-xs text-foreground/80 leading-relaxed">{suggestion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
