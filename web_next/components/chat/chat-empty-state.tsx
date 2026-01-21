"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChatEmptyStateProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  className?: string
  iconWrapperClassName?: string
  titleClassName?: string
  descriptionClassName?: string
}

export function ChatEmptyState({
  icon,
  title,
  description,
  className,
  iconWrapperClassName,
  titleClassName,
  descriptionClassName,
}: ChatEmptyStateProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center px-4 py-12", className)}>
      <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 mb-6", iconWrapperClassName)}>
        {icon}
      </div>
      <h3 className={cn("text-xl font-semibold text-foreground mb-2", titleClassName)}>{title}</h3>
      {description && (
        <div className={cn("text-center text-sm text-muted-foreground max-w-md mb-8 leading-relaxed", descriptionClassName)}>
          {description}
        </div>
      )}
    </div>
  )
}
