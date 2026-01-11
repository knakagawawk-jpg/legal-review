"use client"

import { TrendingUp, AlertCircle, Lightbulb, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export const FeedbackCard = ({
  type,
  category,
  description,
  paragraphs,
  suggestion,
}: {
  type: "strength" | "weakness" | "point"
  category: string
  description: string
  paragraphs?: number[]
  suggestion?: string
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

  return (
    <div className={cn("rounded-xl p-4 transition-all hover:shadow-md", wrapper)}>
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg shrink-0", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{category}</span>
            {paragraphs && paragraphs.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {paragraphs.map((p) => (
                  <span key={p} className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", badgeClass)}>
                    §{p}
                  </span>
                ))}
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
