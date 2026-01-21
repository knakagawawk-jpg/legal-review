"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChatInputBarProps {
  children: ReactNode
  helperText?: ReactNode
  className?: string
  contentClassName?: string
  helperClassName?: string
}

export function ChatInputBar({
  children,
  helperText,
  className,
  contentClassName,
  helperClassName,
}: ChatInputBarProps) {
  return (
    <div className={cn("border-t border-indigo-100/50 bg-white/80 backdrop-blur-md p-4", className)}>
      <div className={cn("mx-auto max-w-3xl", contentClassName)}>
        {children}
        {helperText && <div className={cn("mt-2 flex justify-end", helperClassName)}>{helperText}</div>}
      </div>
    </div>
  )
}
