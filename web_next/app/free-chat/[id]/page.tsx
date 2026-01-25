"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import type { Message, Thread } from "@/types/api"

export default function FreeChatThreadPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen } = useSidebar()
  const threadId = params.id as string
  const [thread, setThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null!)
  const abortControllerRef = useRef<AbortController | null>(null)

  // スレッド情報とメッセージを取得
  useEffect(() => {
    const fetchThreadAndMessages = async () => {
      try {
        // スレッド情報を取得
        const threadData = await apiClient.get<Thread>(`/api/threads/${threadId}`)
        setThread(threadData)

        // メッセージ一覧を取得
        const messagesData = await apiClient.get<{ messages: Message[] }>(`/api/threads/${threadId}/messages`)
        setMessages(messagesData.messages || [])
      } catch (err: any) {
        setError(err.error || err.message || "エラーが発生しました")
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

    // 既存のリクエストがあれば中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 新しいAbortControllerを作成
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)

    try {
      await apiClient.post(`/api/threads/${threadId}/messages`, {
        content: content.trim()
      }, {
        signal: abortController.signal
      })

      // 中断された場合は処理を停止
      if (abortController.signal.aborted) {
        return
      }

      // メッセージ一覧を再取得
      const messagesData = await apiClient.get<{ messages: Message[] }>(`/api/threads/${threadId}/messages`, {
        signal: abortController.signal
      })
      
      if (!abortController.signal.aborted) {
        setMessages(messagesData.messages || [])
      }

      // スレッド情報を更新（タイトルが自動生成されている可能性があるため）
      const threadData = await apiClient.get<Thread>(`/api/threads/${threadId}`, {
        signal: abortController.signal
      })
      
      if (!abortController.signal.aborted) {
        setThread(threadData)
      }
    } catch (err: any) {
      // AbortErrorの場合はエラーを表示しない
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return
      }
      setError(err.error || err.message || "エラーが発生しました")
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
        abortControllerRef.current = null
      }
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
    }
  }

  // タイトル編集
  const handleEditTitle = async (newTitle: string) => {
    if (!threadId) return
    try {
      await apiClient.put(`/api/threads/${threadId}`, { title: newTitle })
      setThread((prev) => prev ? { ...prev, title: newTitle } : null)
    } catch (err: any) {
      console.error("タイトル更新エラー:", err)
      setError(err.error || err.message || "タイトルの更新に失敗しました")
    }
  }

  // 履歴クリア
  const handleClearHistory = async () => {
    if (!threadId) return
    try {
      await apiClient.delete(`/api/threads/${threadId}/messages`)
      setMessages([])
    } catch (err: any) {
      console.error("履歴クリアエラー:", err)
      setError(err.error || err.message || "履歴のクリアに失敗しました")
    }
  }

  // チャット削除
  const handleDeleteChat = async () => {
    if (!threadId) return
    try {
      await apiClient.delete(`/api/threads/${threadId}`)
      // 削除後はフリーチャットのトップに戻る
      router.push("/free-chat")
    } catch (err: any) {
      console.error("チャット削除エラー:", err)
      setError(err.error || err.message || "チャットの削除に失敗しました")
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
    <div 
      className="flex h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      <ChatHeader 
        title={thread?.title || "新しいチャット"} 
        onEditTitle={handleEditTitle}
        onClearHistory={handleClearHistory}
        onDeleteChat={handleDeleteChat}
      />

      <ChatMessages messages={messages} isLoading={loading} error={error} messagesEndRef={messagesEndRef} />

      <ChatInput onSend={handleSend} isLoading={loading} onStop={handleStop} />
    </div>
  )
}
