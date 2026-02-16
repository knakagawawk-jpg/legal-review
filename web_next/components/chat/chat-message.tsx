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
          content={content}
          className={markdownClassName}
        />
      )}
    />
  )
}
