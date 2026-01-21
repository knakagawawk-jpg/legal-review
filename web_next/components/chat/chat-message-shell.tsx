"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type ChatMessageLayout = "reverse" | "align-end"

interface ChatMessageShellProps {
  isUser: boolean
  layout?: ChatMessageLayout
  avatar?: ReactNode
  content: ReactNode
  footer?: ReactNode
  className?: string
  contentWrapperClassName?: string
  bubbleClassName?: string
  footerClassName?: string
}

export function ChatMessageShell({
  isUser,
  layout = "reverse",
  avatar,
  content,
  footer,
  className,
  contentWrapperClassName,
  bubbleClassName,
  footerClassName,
}: ChatMessageShellProps) {
  const rowDirection = layout === "reverse" && isUser ? "flex-row-reverse" : "flex-row"
  const rowAlign = layout === "align-end" && isUser ? "justify-end" : ""
  const wrapperAlign = isUser ? "items-end" : "items-start"
  const footerAlign = isUser ? "flex-row-reverse" : "flex-row"

  return (
    <div className={cn("flex", rowDirection, rowAlign, className)}>
      {avatar && <div className="shrink-0">{avatar}</div>}
      <div className={cn("flex flex-col gap-1", wrapperAlign, contentWrapperClassName)}>
        <div className={bubbleClassName}>{content}</div>
        {footer && <div className={cn("flex items-center gap-2 px-1", footerAlign, footerClassName)}>{footer}</div>}
      </div>
    </div>
  )
}
