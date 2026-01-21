"use client"

import type React from "react"
import type { RefObject } from "react"
import { Bot, User, Copy, Check, Lightbulb, Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { Message } from "@/types/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none 
              prose-headings:mt-6 prose-headings:mb-3 
              prose-h1:text-2xl prose-h1:font-bold prose-h1:text-indigo-900 prose-h1:mt-6 prose-h1:mb-4
              prose-h2:text-xl prose-h2:font-semibold prose-h2:text-indigo-800 prose-h2:mt-5 prose-h2:mb-3 prose-h2:border-b prose-h2:border-indigo-200 prose-h2:pb-2
              prose-h3:text-lg prose-h3:font-semibold prose-h3:text-indigo-700 prose-h3:mt-4 prose-h3:mb-2
              prose-p:my-3 prose-p:leading-7 prose-p:text-foreground prose-p:text-sm
              prose-ul:my-3 prose-ul:space-y-1 prose-ul:list-disc prose-ul:pl-6
              prose-ol:my-3 prose-ol:space-y-1 prose-ol:list-decimal prose-ol:pl-6
              prose-li:my-1 prose-li:leading-6 prose-li:text-sm
              prose-strong:font-bold prose-strong:text-foreground
              prose-em:text-foreground prose-em:italic
              prose-code:text-sm prose-code:bg-indigo-50 prose-code:text-indigo-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-[''] prose-code:after:content-['']
              prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:shadow-lg prose-pre:my-4
              prose-pre code:bg-transparent prose-pre code:text-inherit prose-pre code:p-0 prose-pre code:before:content-[''] prose-pre code:after:content-['']
              prose-blockquote:border-l-4 prose-blockquote:border-indigo-400 prose-blockquote:bg-indigo-50/50 prose-blockquote:pl-4 prose-blockquote:pr-4 prose-blockquote:py-2 prose-blockquote:my-4 prose-blockquote:italic prose-blockquote:text-slate-700
              prose-table:my-4 prose-table:w-full prose-table:border-collapse prose-table:text-sm
              prose-th:border prose-th:border-slate-300 prose-th:bg-indigo-50 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-indigo-900
              prose-td:border prose-td:border-slate-300 prose-td:px-4 prose-td:py-2 prose-td:text-slate-700
              prose-hr:my-6 prose-hr:border-slate-300
              prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:text-indigo-800 hover:prose-a:underline
              prose-img:rounded-lg prose-img:shadow-md prose-img:my-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
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
      <h3 className="text-xl font-semibold text-foreground mb-2">AIとのチャットで勉強を捗らせよう</h3>
      <p className="text-center text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        勉強中に気になったことを最新のLLMを組み込んだAIに自由に聞くことができます。
        <br />
        <br />
        *注：回答はAIが生成したものであり正確性は担保されません。あくまで勉強の補助としてお使いください。
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
