"use client"

import { useState, useEffect, useRef, type RefObject } from "react"
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
  MessageCircle,
  Trash2,
  Send,
} from "lucide-react"
import { PanelResizer } from "@/components/panel-resizer"
import { SubTabButton } from "@/components/sub-tab-button"
import { ScoreRing } from "@/components/score-ring"
import { FeedbackCard } from "@/components/feedback-card"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatMessageList } from "@/components/chat/chat-message-list"
import { ChatBar } from "@/components/chat/chat-bar"
import { ChatInputBar } from "@/components/chat/chat-input-bar"
import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator"
import { getChatMessageTheme } from "@/components/chat/chat-message-theme"
import { cn } from "@/lib/utils"
import type { ReviewResponse } from "@/types/api"
import { useSidebar } from "@/components/sidebar"
import { apiClient } from "@/lib/api-client"
import { getSubjectName } from "@/lib/subjects"

export default function ReviewResultPage() {
  const params = useParams()
  const router = useRouter()
  const { isOpen } = useSidebar()
  const reviewId = params.review_id as string

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(40)
  const [leftTab, setLeftTab] = useState<"answer" | "chat" | "question" | "purpose" | "grading_impression">("answer")
  const [rightTab, setRightTab] = useState<"review" | "chat" | "question" | "purpose" | "grading_impression">("review")
  const [isLargeScreen, setIsLargeScreen] = useState(true)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
  
  const [copied, setCopied] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "講評についてご質問があればお気軽にどうぞ。",
    },
  ])
  const [threadId, setThreadId] = useState<number | null>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const chatContainerLeftRef = useRef<HTMLDivElement>(null)
  const chatContainerRightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.get<ReviewResponse>(`/api/reviews/${reviewId}`)
        setReview(data)
      } catch (err: any) {
        console.error("Review fetch error:", err)
        // エラーの詳細を取得
        const errorMessage = err?.error || err?.message || "講評の取得に失敗しました"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    if (reviewId) {
      fetchReview()
    } else {
      setError("review_idが指定されていません")
      setLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    const refs = [chatContainerLeftRef, chatContainerRightRef]
    refs.forEach((ref) => {
      if (ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight
      }
    })
  }, [chatMessages, isLoading])

  if (loading) {
    return (
      <div 
        className="h-screen bg-background flex flex-col overflow-hidden transition-all duration-300"
        style={{
          marginLeft: isOpen ? '208px' : '0',
        }}
      >
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
      <div 
        className="h-screen bg-background flex flex-col overflow-hidden transition-all duration-300"
        style={{
          marginLeft: isOpen ? '208px' : '0',
        }}
      >
        <div className="container mx-auto px-5 py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error || "講評が見つかりませんでした"}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push("/your-page/past-questions")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            過去問管理ページに戻る
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

  const loadChat = async (): Promise<number | null> => {
    if (!reviewId) return null
    if (chatLoaded && threadId) return threadId
    try {
      const thread = await apiClient.post<any>(`/api/reviews/${reviewId}/thread`, {})
      const tid = Number(thread?.id)
      if (!Number.isFinite(tid)) return null
      setThreadId(tid)

      const msgList = await apiClient.get<any>(`/api/threads/${tid}/messages?limit=200&offset=0`)
      const msgs = (msgList?.messages || [])
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content || "") }))

      if (msgs.length > 0) {
        setChatMessages(msgs)
      }
      setChatLoaded(true)
      return tid
    } catch (e) {
      // noop
      return null
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !review) return

    const userMessage = inputValue.trim()
    setInputValue("")
    
    const updatedMessages = [...chatMessages, { role: "user" as const, content: userMessage }]
    setChatMessages(updatedMessages)
    setIsLoading(true)

    try {
      const tid = threadId || (await loadChat())
      if (!tid) {
        throw new Error("スレッドの作成に失敗しました")
      }

      const assistant = await apiClient.post<any>(`/api/threads/${tid}/messages`, { content: userMessage })
      const assistantText = String(assistant?.content || "")
      setChatMessages((prev) => [...prev, { role: "assistant", content: assistantText || "（空の応答）" }])
    } catch (error: any) {
      console.error("Chat error:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `申し訳ございませんが、エラーが発生しました: ${error?.message || "不明なエラー"}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearChat = () => {
    const clearLocal = () =>
      setChatMessages([
        {
          role: "assistant",
          content: "講評についてご質問があればお気軽にどうぞ。",
        },
      ])

    if (!threadId) {
      clearLocal()
      return
    }

    apiClient
      .delete(`/api/threads/${threadId}/messages`)
      .catch(() => {})
      .finally(() => {
        clearLocal()
      })
  }

  // subject_idから科目名を取得（subject_nameが優先）
  const subjectName = review.subject_name || (review.subject ? getSubjectName(review.subject) : "")
  const questionText = review.question_text || ""
  const purposeText = review.purpose || ""
  const gradingImpressionText = review.grading_impression_text || ""
  const purposeLabel = review.source_type === "custom" ? "参考文章" : "出題趣旨"
  const questionTitle = review.question_title || ""
  const chatBadgeCount = Math.max(chatMessages.length - 1, 0)
  const chatTheme = getChatMessageTheme("review")

  const ChatPanel = ({ containerRef }: { containerRef: RefObject<HTMLDivElement> }) => (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
      <ChatBar
        className="border-border bg-gradient-to-r from-lime-500/10 to-transparent"
        leading={(
          <>
            <div className="p-1.5 rounded-lg bg-lime-500/10 shrink-0">
              <MessageCircle className="h-4 w-4 text-lime-600" />
            </div>
            <span className="text-sm font-semibold text-foreground truncate">チャット</span>
            {chatBadgeCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-700 font-medium shrink-0">
                {chatBadgeCount}
              </span>
            )}
          </>
        )}
        trailing={(
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            className="h-7 text-muted-foreground hover:text-foreground rounded-full"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            クリア
          </Button>
        )}
      />

      <ChatMessageList
        messages={chatMessages}
        isLoading={isLoading}
        containerRef={containerRef}
        renderMessage={(message, index) => <ChatMessage key={index} {...message} />}
        loadingIndicator={(
          <ChatLoadingIndicator
            layout="inline"
            className="text-sm text-muted-foreground"
            dotsClassName="gap-1"
            dotClassName={chatTheme.loadingDotClassName}
          />
        )}
        containerClassName="px-4 py-3 custom-scrollbar min-h-0"
        contentClassName="space-y-3"
      />

      <ChatInputBar className="border-t border-border/70 bg-card px-4 pb-4 pt-2" contentClassName="w-full">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="質問を入力..."
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/20 focus:border-lime-600 transition-all placeholder:text-muted-foreground/60"
          />
          <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} className="px-5 rounded-full">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </ChatInputBar>
    </div>
  )

  return (
    <div 
      className="h-screen bg-background flex flex-col overflow-hidden transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      <header className="border-b border-border shrink-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="px-5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground hover:text-foreground" onClick={() => router.push("/your-page/past-questions")}>
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">戻る</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              {questionTitle && (
                <span className="text-sm font-semibold text-foreground">{questionTitle}</span>
              )}
              {!questionTitle && (
                <span className="text-sm font-semibold text-foreground">{subjectName || "不明"}</span>
              )}
              {score !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {score}点
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div 
        className="flex flex-row flex-1 min-h-0 overflow-hidden w-full"
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
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => {
                  setLeftTab("chat")
                  loadChat()
                }}
                className={cn(
                  "text-sm font-semibold transition-all px-3 py-1 rounded-full flex items-center",
                  leftTab === "chat"
                    ? "text-lime-700 bg-lime-500/15"
                    : "text-muted-foreground hover:text-lime-700 hover:bg-lime-500/10",
                )}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                チャット
                {chatBadgeCount > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-700 font-medium">
                    {chatBadgeCount}
                  </span>
                )}
              </button>
            </div>
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
                label={purposeLabel}
              />
              {!!gradingImpressionText && (
                <SubTabButton
                  active={leftTab === "grading_impression"}
                  onClick={() => setLeftTab("grading_impression")}
                  icon={BookOpen}
                  label="採点実感"
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex-1 p-5 custom-scrollbar",
              leftTab === "chat" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
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
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{questionText}</pre>
              </div>
            )}

            {leftTab === "purpose" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{purposeText}</pre>
              </div>
            )}

            {leftTab === "grading_impression" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{gradingImpressionText}</pre>
              </div>
            )}

            {leftTab === "chat" && <ChatPanel containerRef={chatContainerLeftRef} />}
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
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => {
                  setRightTab("chat")
                  loadChat()
                }}
                className={cn(
                  "text-sm font-semibold transition-all px-3 py-1 rounded-full flex items-center",
                  rightTab === "chat"
                    ? "text-lime-700 bg-lime-500/15"
                    : "text-muted-foreground hover:text-lime-700 hover:bg-lime-500/10",
                )}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                チャット
                {chatBadgeCount > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-700 font-medium">
                    {chatBadgeCount}
                  </span>
                )}
              </button>
            </div>
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
                label={purposeLabel}
              />
              {!!gradingImpressionText && (
                <SubTabButton
                  active={rightTab === "grading_impression"}
                  onClick={() => setRightTab("grading_impression")}
                  icon={BookOpen}
                  label="採点実感"
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex-1 p-5 custom-scrollbar",
              rightTab === "chat" ? "overflow-hidden" : "overflow-y-auto",
            )}
          >
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

                {strengths.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-success uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-success/10">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </div>
                      評価した点
                    </h3>
                    <div className="space-y-3">
                      {strengths.map((strength: any, index: number) => (
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

                {weaknesses.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-error uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-error/10">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                      改善点
                    </h3>
                    <div className="space-y-3">
                      {weaknesses.map((weakness: any, index: number) => (
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

                {importantPoints.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Lightbulb className="h-3.5 w-3.5" />
                      </div>
                      重要な段落
                    </h3>
                    <div className="space-y-3">
                      {importantPoints.map((point: any, index: number) => (
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

                {futureConsiderations.length > 0 && (
                  <div className="bg-gradient-to-br from-secondary/60 to-accent/20 rounded-2xl p-6 border border-border/50">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                      今後意識すべきこと
                    </h3>
                    <ul className="space-y-3">
                      {futureConsiderations.map((item: any, index: number) => {
                        // 後方互換性: stringまたはdict形式に対応
                        const content = typeof item === 'string' ? item : item.content
                        const blockNumber = typeof item === 'object' && 'block_number' in item ? item.block_number : index + 1
                        return (
                          <li key={index} className="flex items-start gap-3 text-sm text-foreground/80">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                              {blockNumber}
                            </span>
                            <span className="leading-relaxed">{content}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {rightTab === "question" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{questionText}</pre>
              </div>
            )}

            {rightTab === "purpose" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{purposeText}</pre>
              </div>
            )}

            {rightTab === "grading_impression" && (
              <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{gradingImpressionText}</pre>
              </div>
            )}

            {rightTab === "chat" && <ChatPanel containerRef={chatContainerRightRef} />}
          </div>
        </div>
      </div>
    </div>
  )
}
