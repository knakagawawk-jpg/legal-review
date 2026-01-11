"use client"

import type React from "react"
import { cn } from "@/lib/utils"

export const SubTabButton = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
      active
        ? "bg-primary/10 text-primary shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
    )}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
)
