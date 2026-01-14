"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import type { Message, Thread } from "@/types/api"

export default function FreeChatThreadPage() {
  const params = useParams()
  const { isOpen } = useSidebar()
  const threadId = params.id as string
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null!)

  // スレッド情報とメッセージを取得
  useEffect(() => {
    const fetchThreadAndMessages = async () => {
      try {
        // スレッド情報を取得
        const threadRes = await fetch(`/api/threads/${threadId}`)
        if (!threadRes.ok) {
          throw new Error("スレッドが見つかりません")
        }
        const threadData = await threadRes.json()
        setThread(threadData)

        // メッセージ一覧を取得
        const messagesRes = await fetch(`/api/threads/${threadId}/messages`)
        if (!messagesRes.ok) {
          throw new Error("メッセージの取得に失敗しました")
        }
        const messagesData = await messagesRes.json()
        setMessages(messagesData.messages || [])
      } catch (err: any) {
        setError(err.message || "エラーが発生しました")
      } finally {
        setLoadingMessages(false)
      }
    }

    if (threadId) {
      fetchThreadAndMessages()
    }
  }, [threadId])

  const handleSend = async (content: string) => {
    if (!content.trim() || loading || !threadId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "メッセージの送信に失敗しました")
      }

      // メッセージ一覧を再取得
      const messagesRes = await fetch(`/api/threads/${threadId}/messages`)
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json()
        setMessages(messagesData.messages || [])
      }

      // スレッド情報を更新（last_message_atが更新されている可能性があるため）
      const threadRes = await fetch(`/api/threads/${threadId}`)
      if (threadRes.ok) {
        const threadData = await threadRes.json()
        setThread(threadData)
      }
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  if (loadingMessages) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-lg text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !thread) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 transition-all duration-300", isOpen && "ml-52")}>
      <ChatHeader title={thread?.title || "新しいチャット"} />

      <ChatMessages messages={messages} isLoading={loading} error={error} messagesEndRef={messagesEndRef} />

      <ChatInput onSend={handleSend} isLoading={loading} />
    </div>
  )
}
