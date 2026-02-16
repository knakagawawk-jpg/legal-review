"use client"

import type React from "react"
import type { RefObject } from "react"
import { Bot, Sparkles } from "lucide-react"
import type { Message } from "@/types/api"
import { ChatMessageList } from "@/components/chat/chat-message-list"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { ChatMessageShell } from "@/components/chat/chat-message-shell"
import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator"
import { ChatEmptyState } from "@/components/chat/chat-empty-state"
import { getChatMessageTheme } from "@/components/chat/chat-message-theme"
import { cn } from "@/lib/utils"

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  error: string | null
  messagesEndRef: RefObject<HTMLDivElement>
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  const theme = getChatMessageTheme("free")
  const contentWrapperClassName = isUser
    ? (theme.contentWrapperUserClassName ?? theme.contentWrapperClassName)
    : (theme.contentWrapperAssistantClassName ?? theme.contentWrapperClassName)
  const markdownClassName = isUser
    ? (theme.markdownUserClassName ?? theme.markdownClassName)
    : (theme.markdownAssistantClassName ?? theme.markdownClassName)

  return (
    <ChatMessageShell
      isUser={isUser}
      layout={theme.layout}
      className={theme.rowClassName}
      contentWrapperClassName={contentWrapperClassName}
      bubbleClassName={[
        theme.bubbleBaseClassName,
        isUser ? theme.bubbleUserClassName : theme.bubbleAssistantClassName,
      ].join(" ")}
      content={(
        <ChatMarkdown
          content={message.content}
          className={markdownClassName}
        />
      )}
    />
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
  return (
    <ChatMessageList
      messages={messages}
      isLoading={isLoading}
      error={error}
      messagesEndRef={messagesEndRef}
      renderMessage={(message) => <MessageBubble key={message.id} message={message} />}
      emptyState={(
        <ChatEmptyState
          icon={<Sparkles className="h-8 w-8 text-indigo-600" />}
          title="AIとのチャットで勉強を捗らせよう"
          description={(
            <>
              勉強中に気になったことを最新のLLMを組み込んだAIに自由に聞くことができます。
              <br />
              <br />
              *注：回答はAIが生成したものであり正確性は担保されません。あくまで勉強の補助としてお使いください。
            </>
          )}
        />
      )}
      loadingIndicator={(
        <ChatLoadingIndicator
          layout="bubble"
          avatar={(
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
          )}
          text="考えています..."
        />
      )}
      containerClassName="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30"
    />
  )
}
