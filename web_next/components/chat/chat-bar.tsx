"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChatBarProps {
  leading: ReactNode
  trailing?: ReactNode
  className?: string
  leadingClassName?: string
  trailingClassName?: string
}

export function ChatBar({
  leading,
  trailing,
  className,
  leadingClassName,
  trailingClassName,
}: ChatBarProps) {
  return (
    <header className={cn("flex items-center justify-between border-b px-4 py-3", className)}>
      <div className={cn("flex items-center gap-3 min-w-0", leadingClassName)}>{leading}</div>
      {trailing && <div className={cn("shrink-0", trailingClassName)}>{trailing}</div>}
    </header>
  )
}
