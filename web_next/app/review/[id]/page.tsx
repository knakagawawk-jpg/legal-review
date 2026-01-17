"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  FileText,
  BookOpen,
  TrendingUp,
  Lightbulb,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Trash2,
  Send,
} from "lucide-react"
import { PanelResizer } from "@/components/panel-resizer"
import { SubTabButton } from "@/components/sub-tab-button"
import { ScoreRing } from "@/components/score-ring"
import { FeedbackCard } from "@/components/feedback-card"
import { ChatMessage } from "@/components/chat/chat-message"
import { cn } from "@/lib/utils"
import type { ReviewResponse } from "@/types/api"
import { useSidebar } from "@/components/sidebar"

export default function ReviewResultPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen } = useSidebar()
  const submissionId = params.id as string

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(40)
  const [leftTab, setLeftTab] = useState<"answer" | "question" | "purpose">("answer")
  const [rightTab, setRightTab] = useState<"review" | "question" | "purpose">("review")
  const [isLargeScreen, setIsLargeScreen] = useState(true) // デフォルトをtrueにして、クライアントサイドで調整

  // 画面サイズを監視
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
  const [copied, setCopied] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "講評についてご質問があればお気軽にどうぞ。",
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await fetch(`/api/review/${submissionId}`)
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || "講評の取得に失敗しました")
        }
        const data = await res.json()
        setReview(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (submissionId) {
      fetchReview()
    }
  }, [submissionId])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages, isLoading])

  if (loading) {
    return (
      <div className={cn("h-screen bg-background flex flex-col overflow-hidden transition-all duration-300", isOpen && "ml-52")}>
        <div className="container mx-auto px-5 py-12">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className={cn("h-screen bg-background flex flex-col overflow-hidden transition-all duration-300", isOpen && "ml-52")}>
        <div className="container mx-auto px-5 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error || "講評が見つかりませんでした"}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/review")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            講評生成ページに戻る
          </Button>
        </div>
      </div>
    )
  }

  const reviewJson = review.review_json || {}
  const evaluation = reviewJson.evaluation || {}
  const overallReview = evaluation.overall_review || {}
  const score = overallReview.score
  const strengths = evaluation.strengths || []
  const weaknesses = evaluation.weaknesses || []
  const importantPoints = evaluation.important_points || []
  const futureConsiderations = evaluation.future_considerations || []

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !review) return

    const userMessage = inputValue.trim()
    setInputValue("")

    // ユーザーメッセージを追加
    const updatedMessages = [...chatMessages, { role: "user" as const, content: userMessage }]
    setChatMessages(updatedMessages)
    setIsLoading(true)

    try {
      // チャット履歴を構築（最初の挨拶メッセージを除く）
      const chatHistory = updatedMessages
        .slice(1) // 最初の挨拶メッセージを除外
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

      // APIを呼び出し
      const response = await fetch("/api/review/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission_id: parseInt(submissionId),
          question: userMessage,
          chat_history: chatHistory.length > 0 ? chatHistory : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "チャットの送信に失敗しました")
      }

      const data = await response.json()

      // アシスタントの回答を追加
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "回答を取得できませんでした",
        },
      ])
    } catch (error: any) {
      console.error("Chat error:", error)
      // エラーメッセージを表示
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `申し訳ございませんが、エラーが発生しました: ${error.message || "不明なエラー"}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    setChatMessages([
      {
        role: "assistant",
        content: "講評についてご質問があればお気軽にどうぞ。",
      },
    ])
  }

  // 科目名を取得（review.subject または review_json から）
  const subject = review.subject || reviewJson.subject || ""

  // V0に合わせて、問題文と出題趣旨は常に表示
  const questionText = review.question_text || ""
  const purposeText = review.purpose || ""

  return (
    <div className={cn("h-screen bg-background flex flex-col overflow-hidden transition-all duration-300", isOpen && "ml-52")}>
      <header className="border-b border-border shrink-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="px-5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground hover:text-foreground" onClick={() => router.push("/review")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">戻る</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{subject}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {score}点
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        className="flex flex-row min-h-0 overflow-hidden w-full"
        style={{
          height: isChatOpen
            ? 'calc(50vh - 3rem)'  // チャットが開いている時は画面の上半分
            : 'calc(100vh - 3rem - 3.5rem)'  // ヘッダー(約3rem) + チャットバー(約3.5rem)
        }}
      >
        {/* Left Panel */}
        <div
          className="lg:min-h-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col overflow-hidden shrink-0"
          style={{
            width: `${leftWidth}%`,
            flexBasis: `${leftWidth}%`,
            flexGrow: 0,
            flexShrink: 0,
          }}
        >
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-4 bg-card/50">
            <button
              onClick={() => setLeftTab("answer")}
              className={cn(
                "text-sm font-semibold transition-all px-3 py-1 rounded-full",
                leftTab === "answer"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              答案
            </button>
            <div className="flex items-center gap-1.5">
              <SubTabButton
                active={leftTab === "question"}
                onClick={() => setLeftTab("question")}
                icon={FileText}
                label="問題文"
              />
              <SubTabButton
                active={leftTab === "purpose"}
                onClick={() => setLeftTab("purpose")}
                icon={BookOpen}
                label="出題趣旨"
              />
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
            {leftTab === "answer" && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-secondary/50 to-transparent">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">提出答案</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(review.answer_text)}
                    className="h-7 gap-1.5 text-muted-foreground hover:text-foreground rounded-full"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-success" />
                        <span className="text-xs">コピー済</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="text-xs">コピー</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-5">
                  <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/90 leading-7">
                    {review.answer_text}
                  </pre>
                </div>
              </div>
            )}

            {leftTab === "question" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.question_text}</pre>
              </div>
            )}

            {leftTab === "purpose" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.purpose}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <PanelResizer onResize={setLeftWidth} currentWidth={leftWidth} />

        {/* Right Panel */}
        <div
          className="flex flex-col min-h-0 overflow-hidden min-w-0 bg-background"
          style={{
            width: 'auto',
            flexBasis: 0,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-4 bg-card/50">
            <button
              onClick={() => setRightTab("review")}
              className={cn(
                "text-sm font-semibold transition-all px-3 py-1 rounded-full",
                rightTab === "review"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              講評
            </button>
            <div className="flex items-center gap-1.5">
              <SubTabButton
                active={rightTab === "question"}
                onClick={() => setRightTab("question")}
                icon={FileText}
                label="問題文"
              />
              <SubTabButton
                active={rightTab === "purpose"}
                onClick={() => setRightTab("purpose")}
                icon={BookOpen}
                label="出題趣旨"
              />
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
            {rightTab === "review" && (
              <div className="space-y-8 max-w-2xl">
                {score !== undefined && (
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <div className="flex items-start gap-6">
                      <ScoreRing score={score} />
                      <div className="flex-1 pt-2">
                        <h2 className="text-lg font-bold text-foreground mb-3">総合評価</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {overallReview.comment || "コメントがありません"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {strengths.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-success uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-success/10">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </div>
                      評価した点
                    </h3>
                    <div className="space-y-3">
                      {strengths.map((strength, index) => (
                        <FeedbackCard
                          key={index}
                          type="strength"
                          category={strength.category}
                          description={strength.description}
                          paragraphs={strength.paragraph_numbers}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Weaknesses */}
                {weaknesses.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-error uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-error/10">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                      改善点
                    </h3>
                    <div className="space-y-3">
                      {weaknesses.map((weakness, index) => (
                        <FeedbackCard
                          key={index}
                          type="weakness"
                          category={weakness.category}
                          description={weakness.description}
                          paragraphs={weakness.paragraph_numbers}
                          suggestion={weakness.suggestion}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Important Points */}
                {importantPoints.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Lightbulb className="h-3.5 w-3.5" />
                      </div>
                      重要な段落
                    </h3>
                    <div className="space-y-3">
                      {importantPoints.map((point, index) => (
                        <div
                          key={index}
                          className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary">
                              第{point.paragraph_number}段落
                            </span>
                          </div>
                          <div className="space-y-4 text-sm">
                            <div className="flex gap-3">
                              <div className="w-1 rounded-full bg-success shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-success uppercase tracking-wider">
                                  良い点
                                </span>
                                <p className="mt-1 text-muted-foreground">{point.what_is_good}</p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="w-1 rounded-full bg-error shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-error uppercase tracking-wider">不足点</span>
                                <p className="mt-1 text-muted-foreground">{point.what_is_lacking}</p>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-border">
                              <p className="text-xs text-foreground/70 italic leading-relaxed">{point.why_important}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Future Considerations */}
                {futureConsiderations.length > 0 && (
                  <div className="bg-gradient-to-br from-secondary/60 to-accent/20 rounded-2xl p-6 border border-border/50">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                      今後意識すべきこと
                    </h3>
                    <ul className="space-y-3">
                      {futureConsiderations.map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-foreground/80">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                            {index + 1}
                          </span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {rightTab === "question" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.question_text}</pre>
              </div>
            )}

            {rightTab === "purpose" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.purpose}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card shrink-0">
        {/* Chat toggle bar */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">講評について質問する</span>
            {chatMessages.length > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {chatMessages.length - 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {isChatOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </button>

        {/* Expandable chat content */}
        {isChatOpen && (
          <div className="border-t border-border" style={{ height: '50vh', maxHeight: '50vh' }}>
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="px-5 py-2 flex items-center justify-end shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="h-7 text-muted-foreground hover:text-foreground rounded-full"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  クリア
                </Button>
              </div>

              <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-3 custom-scrollbar min-h-0">
                {chatMessages.map((message, index) => (
                  <ChatMessage key={index} {...message} />
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex gap-1">
                      <span
                        className="h-2 w-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pb-4 pt-2 shrink-0">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="質問を入力..."
                    className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="px-5 rounded-full"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
