"use client"

import { ChevronUp, ChevronDown } from "lucide-react"
import { getParagraphsFromAnswerText } from "@/lib/paragraphs"
import { cn } from "@/lib/utils"

const ANSWER_PARAGRAPH_ID_PREFIX = "answer-para-"

export function getAnswerParagraphId(paragraphNumber: number): string {
  return `${ANSWER_PARAGRAPH_ID_PREFIX}${paragraphNumber}`
}

export interface AnswerWithParagraphsProps {
  answerText: string
  className?: string
  preClassName?: string
  /** 段落に付与する id のプレフィックス（デフォルト answer-para-） */
  paragraphIdPrefix?: string
  /** ハイライト対象の段落番号（複数ある場合も可。表示時にうっすら色づけ） */
  highlightedNumbers?: number[]
  /** § または段落本文クリック時に呼ばれる（チャット入力へ「本文＋（§N）」を挿入する用途） */
  onParagraphCopyClick?: (paragraphNumber: number, content: string) => void
  /** § または段落本文クリック時に呼ばれる（逆側が講評タブのとき、該当段落の講評項目へハイライト・スクロールする用途） */
  onParagraphNavigateToReview?: (paragraphNumber: number) => void
  /** 該当§を Paragraph Num に含む講評項目のうち、現在何番目を表示しているか（その下に〇/〇と上下ナビを表示） */
  reviewFocusInfo?: { paragraphNumber: number; currentIndex: number; totalCount: number } | null
  /** 〇/〇の上/下ボタンでインデックスを変更したときに呼ばれる */
  onReviewFocusIndexChange?: (newIndex: number) => void
  /** 講評のいずれかの項目が Paragraph Num に含む段落番号。含まない§は色を薄くする */
  paragraphNumbersWithReviewItems?: Set<number>
}

export function AnswerWithParagraphs({
  answerText,
  className,
  preClassName,
  paragraphIdPrefix = ANSWER_PARAGRAPH_ID_PREFIX,
  highlightedNumbers = [],
  onParagraphCopyClick,
  onParagraphNavigateToReview,
  reviewFocusInfo,
  onReviewFocusIndexChange,
  paragraphNumbersWithReviewItems,
}: AnswerWithParagraphsProps) {
  const paragraphs = getParagraphsFromAnswerText(answerText)
  const highlightSet = new Set(highlightedNumbers)
  const hasClickHandler = Boolean(onParagraphCopyClick || onParagraphNavigateToReview)
  const handleParagraphClick = (number: number, content: string) => {
    onParagraphCopyClick?.(number, content)
    onParagraphNavigateToReview?.(number)
  }
  const showFocusFor = reviewFocusInfo && reviewFocusInfo.totalCount > 0 ? reviewFocusInfo.paragraphNumber : null
  const hasReviewItems = (n: number) => !paragraphNumbersWithReviewItems || paragraphNumbersWithReviewItems.has(n)

  if (paragraphs.length === 0) {
    return (
      <div className={cn("p-5", className)}>
        <pre className={cn("text-sm font-mono whitespace-pre-wrap text-foreground/90 leading-7", preClassName)}>
          {answerText}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn("p-5 space-y-0", className)}>
      {paragraphs.map(({ number, content }, index) =>
        number === 0 ? (
          <div key={`empty-${index}`} className="leading-7 min-h-[1.75rem]" aria-hidden />
        ) : (
          <div
            key={number}
            id={paragraphIdPrefix + number}
            className={cn(
              "transition-colors duration-300 rounded-md flex gap-2",
              highlightSet.has(number) && "bg-primary/10 dark:bg-primary/20",
            )}
          >
            <div className="flex flex-col items-center shrink-0 gap-0.5">
              <span
                role={hasClickHandler ? "button" : undefined}
                tabIndex={hasClickHandler ? 0 : undefined}
                className={cn(
                  "text-xs font-semibold shrink-0",
                  hasReviewItems(number)
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50",
                  hasClickHandler && "cursor-pointer hover:text-primary hover:opacity-80 transition-opacity select-none",
                )}
                aria-hidden={!hasClickHandler}
                onClick={hasClickHandler ? () => handleParagraphClick(number, content) : undefined}
                onKeyDown={
                  hasClickHandler
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleParagraphClick(number, content)
                        }
                      }
                    : undefined
                }
              >
                §{number}
              </span>
              {showFocusFor === number && reviewFocusInfo && onReviewFocusIndexChange && (
                <>
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {reviewFocusInfo.currentIndex + 1}/{reviewFocusInfo.totalCount}
                  </span>
                  <div className="flex items-center gap-0.5 text-muted-foreground">
                    <button
                      type="button"
                      aria-label="前の項目へ"
                      disabled={reviewFocusInfo.currentIndex <= 0}
                      onClick={() => onReviewFocusIndexChange(reviewFocusInfo.currentIndex - 1)}
                      className={cn(
                        "p-0.5 rounded hover:bg-muted transition-colors",
                        reviewFocusInfo.currentIndex <= 0 && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="次の項目へ"
                      disabled={reviewFocusInfo.currentIndex >= reviewFocusInfo.totalCount - 1}
                      onClick={() => onReviewFocusIndexChange(reviewFocusInfo.currentIndex + 1)}
                      className={cn(
                        "p-0.5 rounded hover:bg-muted transition-colors",
                        reviewFocusInfo.currentIndex >= reviewFocusInfo.totalCount - 1 && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
            <pre
              role={hasClickHandler ? "button" : undefined}
              tabIndex={hasClickHandler ? 0 : undefined}
              className={cn(
                "text-sm font-mono whitespace-pre-wrap text-foreground/90 leading-7 flex-1 min-w-0",
                hasClickHandler && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
              )}
              onClick={hasClickHandler ? () => handleParagraphClick(number, content) : undefined}
              onKeyDown={
                hasClickHandler
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleParagraphClick(number, content)
                      }
                    }
                  : undefined
              }
            >
              {content}
            </pre>
          </div>
        ),
      )}
    </div>
  )
}
