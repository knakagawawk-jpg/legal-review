"use client"

import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { ChatMessageShell } from "@/components/chat/chat-message-shell"
import { getChatMessageTheme } from "@/components/chat/chat-message-theme"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user"
  const theme = getChatMessageTheme("review")

  return (
    <ChatMessageShell
      isUser={isUser}
      layout={theme.layout}
      className={theme.rowClassName}
      bubbleClassName={[
        theme.bubbleBaseClassName,
        isUser ? theme.bubbleUserClassName : theme.bubbleAssistantClassName,
      ].join(" ")}
      content={(
        <ChatMarkdown
          content={content}
          className={theme.markdownClassName}
        />
      )}
    />
  )
}
