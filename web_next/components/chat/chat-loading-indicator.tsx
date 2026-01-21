"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type ChatLoadingLayout = "bubble" | "inline"

interface ChatLoadingIndicatorProps {
  layout?: ChatLoadingLayout
  avatar?: ReactNode
  text?: string
  className?: string
  bubbleClassName?: string
  dotsClassName?: string
  dotClassName?: string
  textClassName?: string
}

export function ChatLoadingIndicator({
  layout = "bubble",
  avatar,
  text,
  className,
  bubbleClassName,
  dotsClassName,
  dotClassName,
  textClassName,
}: ChatLoadingIndicatorProps) {
  const dots = (
    <div className={cn("flex gap-1", dotsClassName)}>
      <span className={cn("h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.3s]", dotClassName)} />
      <span className={cn("h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.15s]", dotClassName)} />
      <span className={cn("h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40", dotClassName)} />
    </div>
  )

  if (layout === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        {dots}
        {text && <span className={cn("text-sm text-muted-foreground", textClassName)}>{text}</span>}
      </div>
    )
  }

  return (
    <div className={cn("flex gap-3 px-4 py-3", className)}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className={cn("flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white border border-indigo-100/80 px-4 py-3 shadow-sm", bubbleClassName)}>
        {dots}
        {text && <span className={cn("text-sm text-muted-foreground", textClassName)}>{text}</span>}
      </div>
    </div>
  )
}
