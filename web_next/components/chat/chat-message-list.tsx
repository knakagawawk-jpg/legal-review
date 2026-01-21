"use client"

import type { RefObject } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface ChatMessageListProps<T> {
  messages: T[]
  isLoading?: boolean
  error?: string | null
  containerRef?: RefObject<HTMLDivElement>
  messagesEndRef?: RefObject<HTMLDivElement>
  renderMessage: (message: T, index: number) => React.ReactNode
  emptyState?: React.ReactNode
  loadingIndicator?: React.ReactNode
  containerClassName?: string
  contentClassName?: string
}

export function ChatMessageList<T>({
  messages,
  isLoading = false,
  error = null,
  containerRef,
  messagesEndRef,
  renderMessage,
  emptyState,
  loadingIndicator,
  containerClassName,
  contentClassName,
}: ChatMessageListProps<T>) {
  const showEmpty = messages.length === 0 && !isLoading && !!emptyState
  const contentClasses = contentClassName ?? "mx-auto max-w-3xl py-4"

  return (
    <div ref={containerRef} className={cn("flex-1 overflow-y-auto", containerClassName)}>
      <div className={contentClasses}>
        {error && (
          <div className="px-4 pb-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {showEmpty ? emptyState : messages.map((message, index) => renderMessage(message, index))}

        {isLoading && loadingIndicator}

        {messagesEndRef && <div ref={messagesEndRef} />}
      </div>
    </div>
  )
}
