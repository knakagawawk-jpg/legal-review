"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Trash2, Send } from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function FreeChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // localStorageから履歴を復元
  useEffect(() => {
    const saved = localStorage.getItem("free_chat_history")
    if (saved) {
      try {
        setMessages(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse chat history:", e)
      }
    }
  }, [])

  // メッセージが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 履歴をlocalStorageに保存
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("free_chat_history", JSON.stringify(messages))
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    setError(null)

    try {
      // チャット履歴をAPI用の形式に変換（最後のユーザーメッセージは除く）
      const apiChatHistory = newMessages.slice(0, -1).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          chat_history: apiChatHistory.length > 0 ? apiChatHistory : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "チャットの送信に失敗しました")
      }

      const data = await response.json()
      const assistantMessage: Message = { role: "assistant", content: data.answer }
      setMessages([...newMessages, assistantMessage])
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
      const errorMessage: Message = {
        role: "assistant",
        content: `申し訳ございませんが、エラーが発生しました: ${err.message || "Unknown error"}`,
      }
      setMessages([...newMessages, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    if (confirm("チャット履歴をクリアしますか？")) {
      setMessages([])
      localStorage.removeItem("free_chat_history")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-8 py-12 max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold mb-2">💬 フリーチャット</h1>
              <p className="text-muted-foreground text-lg">
                LLMと自由にチャットできます
              </p>
            </div>
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <Trash2 className="w-4 h-4" />
              履歴をクリア
            </Button>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* チャット履歴 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg mb-2">💡 自由に質問や会話を始めてください</p>
                  <p className="text-sm">
                    法律に関する質問も、一般的な質問も可能です
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">考えています...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* 入力欄 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="メッセージを入力してください（例: 民法の時効について教えてください、または、今日の天気は？）"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[100px] resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="self-end"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter で送信、Shift + Enter で改行
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
