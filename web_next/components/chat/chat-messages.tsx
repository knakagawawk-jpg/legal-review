"use client"

import type React from "react"
import type { RefObject } from "react"
import { Bot, User, Copy, Check, Lightbulb, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { Message } from "@/types/api"

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  error: string | null
  messagesEndRef: RefObject<HTMLDivElement>
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn("flex gap-3 px-4 py-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-gradient-to-br from-slate-500 to-slate-700" : "bg-gradient-to-br from-indigo-500 to-sky-500",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex max-w-[75%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3",
            isUser
              ? "bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-tr-sm shadow-sm"
              : "bg-white text-foreground rounded-tl-sm border border-indigo-100/80 shadow-sm",
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>

        {/* Actions & Timestamp */}
        <div className={cn("flex items-center gap-2 px-1", isUser ? "flex-row-reverse" : "flex-row")}>
          <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
          {!isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white border border-indigo-100/80 px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" />
        </div>
        <span className="text-sm text-muted-foreground">考えています...</span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 mb-6">
        <Sparkles className="h-8 w-8 text-indigo-600" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">AIとチャットで勉強を捗らせよう</h3>
      <p className="text-center text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        勉強中に気になったことを自由に聞くことができます。
        <br />
        <br />
        *注：回答はAIが生成したものであり正確性は担保されません。また、あくまでも司法試験受験勉強用の補助ツールであり法的なアドバイスを行うものではありません。
      </p>
    </div>
  )
}

function SuggestionCard({
  icon,
  title,
  description,
  color = "indigo",
}: {
  icon: React.ReactNode
  title: string
  description: string
  color?: "indigo" | "sky" | "emerald"
}) {
  const colorClasses = {
    indigo: "bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 text-indigo-600",
    sky: "bg-gradient-to-br from-sky-500/20 to-sky-600/20 text-sky-600",
    emerald: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-600",
  }

  return (
    <button className="flex items-center gap-3 rounded-xl border border-indigo-100/60 bg-white/80 backdrop-blur-sm p-4 text-left transition-colors hover:bg-indigo-50/50 hover:border-indigo-200/80 shadow-sm">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", colorClasses[color])}>{icon}</div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

export function ChatMessages({ messages, isLoading, error, messagesEndRef }: ChatMessagesProps) {
  if (messages.length === 0 && !isLoading) {
    return <EmptyState />
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="mx-auto max-w-3xl py-4">
        {error && (
          <div className="px-4 pb-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isLoading && <LoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
