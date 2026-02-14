"use client"

import { useState, useEffect, useRef, useCallback, useMemo, memo, type RefObject } from "react"
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
import { ChatInput } from "@/components/chat/chat-input"
import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator"
import { getChatMessageTheme } from "@/components/chat/chat-message-theme"
import { cn } from "@/lib/utils"
import type { ReviewResponse } from "@/types/api"
import { useSidebar } from "@/components/sidebar"
import { apiClient } from "@/lib/api-client"

export default function ReviewResultPage() {
  const params = useParams()
  const router = useRouter()
  const { mainContentStyle } = useSidebar()
  const reviewId = params.id as string

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(40)
  const [leftTab, setLeftTab] = useState<"answer" | "chat" | "question" | "purpose" | "grading_impression">("answer")
  const [rightTab, setRightTab] = useState<"review" | "chat" | "question" | "purpose" | "grading_impression">("review")
  const [isLargeScreen, setIsLargeScreen] = useState(true) // デフォルトをtrueにして、クライアントサイドで調整
  type UnifiedTab = "review" | "answer" | "chat" | "question" | "purpose" | "grading_impression"
  const [unifiedTab, setUnifiedTab] = useState<UnifiedTab>("review")

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
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "講評についてご質問があればお気軽にどうぞ。",
    },
  ])
  const [threadId, setThreadId] = useState<number | null>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const chatContainerLeftRef = useRef<HTMLDivElement>(null)
  const chatContainerRightRef = useRef<HTMLDivElement>(null)

  // isLoadingRefをisLoadingと同期
  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const data = await apiClient.get<ReviewResponse>(`/api/reviews/${reviewId}`)
        setReview(data)
      } catch (err: any) {
        const errorMessage = err?.error || err?.message || "講評の取得に失敗しました"
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    if (reviewId) {
      fetchReview()
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


  const loadChat = useCallback(async (): Promise<number | null> => {
    if (!reviewId) return null
    if (chatLoaded && threadId) return threadId
    try {
      // スレッドを取得/作成
      const thread = await apiClient.post<any>(`/api/reviews/${reviewId}/thread`, {})
      const tid = Number(thread?.id)
      if (!Number.isFinite(tid)) return null
      setThreadId(tid)

      // メッセージを取得
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
      // 読み込み失敗時はUIだけ維持（送信時に再トライ）
      return null
    }
  }, [reviewId, chatLoaded, threadId])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current || !review) return

    const userMessage = content.trim()

    // ユーザーメッセージを追加
    setChatMessages((prev) => [...prev, { role: "user" as const, content: userMessage }])
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
      // エラーメッセージを表示
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
  }, [review, threadId, loadChat])

  const handleClearChat = useCallback(() => {
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
      .catch(() => { })
      .finally(() => {
        clearLocal()
      })
  }, [threadId])

  // ChatInputをメモ化して再マウントを防ぐ（早期リターンの前に配置）
  const leftChatInput = useMemo(
    () => <ChatInput onSend={handleSendMessage} isLoading={isLoading} fullWidth />,
    [handleSendMessage, isLoading]
  )
  const rightChatInput = useMemo(
    () => <ChatInput onSend={handleSendMessage} isLoading={isLoading} fullWidth />,
    [handleSendMessage, isLoading]
  )

  if (loading) {
    return (
      <div
        className="h-dvh bg-background flex flex-col overflow-hidden transition-all duration-300"
        style={mainContentStyle}
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
        className="h-dvh bg-background flex flex-col overflow-hidden transition-all duration-300"
        style={mainContentStyle}
      >
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

  const reviewJson = review?.review_json || {}
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

  // 科目名を取得（review.subject または review_json から）
  const subject = review?.subject || review?.review_json?.subject || ""

  const questionText = review?.question_text || ""
  const purposeText = review?.purpose || ""
  const gradingImpressionText = review?.grading_impression_text || ""
  const purposeLabel = review?.source_type === "custom" ? "参考文章" : "出題趣旨"
  const chatBadgeCount = Math.max(chatMessages.length - 1, 0)
  const chatTheme = getChatMessageTheme("review")

  const ChatPanel = memo(({ 
    containerRef,
    chatMessages: msgs,
    isLoading: loading,
    chatBadgeCount: badgeCount,
    chatTheme: theme,
    onClearChat
  }: { 
    containerRef: RefObject<HTMLDivElement>
    chatMessages: Array<{ role: "user" | "assistant"; content: string }>
    isLoading: boolean
    chatBadgeCount: number
    chatTheme: ReturnType<typeof getChatMessageTheme>
    onClearChat: () => void
  }) => {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
        <ChatBar
          className="border-border bg-gradient-to-r from-lime-500/10 to-transparent"
          leading={(
            <>
              <div className="p-1.5 rounded-lg bg-lime-500/10 shrink-0">
                <MessageCircle className="h-4 w-4 text-lime-600" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">チャット</span>
              {badgeCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-lime-500/15 text-lime-700 font-medium shrink-0">
                  {badgeCount}
                </span>
              )}
            </>
          )}
          trailing={(
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="h-7 text-muted-foreground hover:text-foreground rounded-full"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              クリア
            </Button>
          )}
        />

        <ChatMessageList
          messages={msgs}
          isLoading={loading}
          containerRef={containerRef}
          renderMessage={(message, index) => <ChatMessage key={index} {...message} />}
          loadingIndicator={(
            <ChatLoadingIndicator
              layout="inline"
              className="text-sm text-muted-foreground"
              dotsClassName="gap-1"
              dotClassName={theme.loadingDotClassName}
            />
          )}
          containerClassName="px-4 py-3 custom-scrollbar min-h-0"
          contentClassName="space-y-3"
        />
      </div>
    )
  }, (prevProps, nextProps) => {
    // メッセージが変更された場合は再レンダリングが必要
    if (prevProps.chatMessages.length !== nextProps.chatMessages.length) return false
    // メッセージの内容が変更された場合も再レンダリングが必要
    if (prevProps.chatMessages.length > 0 && nextProps.chatMessages.length > 0) {
      const lastPrev = prevProps.chatMessages[prevProps.chatMessages.length - 1]
      const lastNext = nextProps.chatMessages[nextProps.chatMessages.length - 1]
      if (lastPrev.content !== lastNext.content || lastPrev.role !== lastNext.role) {
        return false
      }
    }
    // ローディング状態が変更された場合は再レンダリングが必要
    if (prevProps.isLoading !== nextProps.isLoading) return false
    // バッジ数が変更された場合は再レンダリングが必要
    if (prevProps.chatBadgeCount !== nextProps.chatBadgeCount) return false
    // onClearChatの参照が変更されても再レンダリングしない
    // （これはuseCallbackでメモ化されているため、実際の機能は変わらない）
    // その他の変更は無視
    return true
  })
  
  ChatPanel.displayName = "ChatPanel"

  return (
    <div
      className="h-screen bg-background flex flex-col overflow-hidden transition-all duration-300"
      style={mainContentStyle}
    >
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
        className={cn(
          "flex flex-1 min-h-0 overflow-hidden w-full",
          isLargeScreen ? "flex-row" : "flex-col",
        )}
      >
        {isLargeScreen ? (
          <>
        {/* Left Panel */}
        <div
          className="border-b border-border flex flex-col overflow-hidden lg:min-h-0 lg:border-b-0 lg:border-r shrink-0"
          style={{
            width: `${leftWidth}%`,
            flexBasis: `${leftWidth}%`,
            flexGrow: 0,
            flexShrink: 0,
          }}
        >
          <div className="px-3 sm:px-5 py-3 border-b border-border shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-card/50">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-1.5">
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

          <div className="flex-1 flex flex-col min-h-0">
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
                  <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.question_text}</pre>
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

              {leftTab === "chat" && (
                <div className="flex flex-col h-full">
                  <ChatPanel 
                    containerRef={chatContainerLeftRef}
                    chatMessages={chatMessages}
                    isLoading={isLoading}
                    chatBadgeCount={chatBadgeCount}
                    chatTheme={chatTheme}
                    onClearChat={handleClearChat}
                  />
                </div>
              )}
            </div>
            {/* ChatInputはチャットタブのときのみレンダリング（下部領域の有効活用） */}
            {leftTab === "chat" && (
              <div className="border-t border-border/70 bg-card shrink-0">
                {leftChatInput}
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <PanelResizer onResize={setLeftWidth} currentWidth={leftWidth} />

        {/* Right Panel */}
        <div
          className="flex flex-col min-h-0 overflow-hidden bg-background min-w-0"
          style={{
            width: 'auto',
            flexBasis: 0,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <div className="px-3 sm:px-5 py-3 border-b border-border shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-card/50">
            <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex flex-wrap items-center gap-1.5">
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

          <div className="flex-1 flex flex-col min-h-0">
            <div
              className={cn(
                "flex-1 p-5 custom-scrollbar",
                rightTab === "chat" ? "overflow-hidden" : "overflow-y-auto",
              )}
            >
              {rightTab === "review" && (
                <div className="space-y-8 w-full">
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
                        {futureConsiderations.map((item, index) => {
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
                  <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review.question_text}</pre>
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

              {rightTab === "chat" && (
                <div className="flex flex-col h-full">
                  <ChatPanel 
                    containerRef={chatContainerRightRef}
                    chatMessages={chatMessages}
                    isLoading={isLoading}
                    chatBadgeCount={chatBadgeCount}
                    chatTheme={chatTheme}
                    onClearChat={handleClearChat}
                  />
                </div>
              )}
            </div>
            {/* ChatInputはチャットタブのときのみレンダリング（下部領域の有効活用） */}
            {rightTab === "chat" && (
              <div className="border-t border-border/70 bg-card shrink-0">
                {rightChatInput}
              </div>
            )}
          </div>
        </div>
          </>
        ) : (
          /* 縦並び: 1ウィンドウで講評・答案・チャット・問題文・出題趣旨を統合タブ表示 */
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden w-full bg-background">
            <div className="px-3 sm:px-5 py-3 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-2 bg-card/50">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setUnifiedTab("review")}
                  className={cn(
                    "text-sm font-semibold transition-all px-3 py-1 rounded-full",
                    unifiedTab === "review"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  講評
                </button>
                <button
                  onClick={() => setUnifiedTab("answer")}
                  className={cn(
                    "text-sm font-semibold transition-all px-3 py-1 rounded-full",
                    unifiedTab === "answer"
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  答案
                </button>
                <button
                  onClick={() => {
                    setUnifiedTab("chat")
                    loadChat()
                  }}
                  className={cn(
                    "text-sm font-semibold transition-all px-3 py-1 rounded-full flex items-center",
                    unifiedTab === "chat"
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
              <div className="flex flex-wrap items-center gap-1.5">
                <SubTabButton
                  active={unifiedTab === "question"}
                  onClick={() => setUnifiedTab("question")}
                  icon={FileText}
                  label="問題文"
                />
                <SubTabButton
                  active={unifiedTab === "purpose"}
                  onClick={() => setUnifiedTab("purpose")}
                  icon={BookOpen}
                  label={purposeLabel}
                />
                {!!gradingImpressionText && (
                  <SubTabButton
                    active={unifiedTab === "grading_impression"}
                    onClick={() => setUnifiedTab("grading_impression")}
                    icon={BookOpen}
                    label="採点実感"
                  />
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div
                className={cn(
                  "flex-1 p-5 custom-scrollbar",
                  unifiedTab === "chat" ? "overflow-hidden" : "overflow-y-auto",
                )}
              >
                {unifiedTab === "review" && (
                  <div className="space-y-8 w-full">
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
                                    <span className="text-xs font-semibold text-success uppercase tracking-wider">良い点</span>
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
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">今後意識すべきこと</h3>
                        <ul className="space-y-3">
                          {futureConsiderations.map((item, index) => {
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
                {unifiedTab === "answer" && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-secondary/50 to-transparent">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">提出答案</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(review!.answer_text)}
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
                        {review!.answer_text}
                      </pre>
                    </div>
                  </div>
                )}
                {unifiedTab === "chat" && (
                  <div className="flex flex-col h-full">
                    <ChatPanel
                      containerRef={chatContainerRightRef}
                      chatMessages={chatMessages}
                      isLoading={isLoading}
                      chatBadgeCount={chatBadgeCount}
                      chatTheme={chatTheme}
                      onClearChat={handleClearChat}
                    />
                  </div>
                )}
                {unifiedTab === "question" && (
                  <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{review!.question_text}</pre>
                  </div>
                )}
                {unifiedTab === "purpose" && (
                  <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{purposeText}</pre>
                  </div>
                )}
                {unifiedTab === "grading_impression" && (
                  <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{gradingImpressionText}</pre>
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "border-t border-border/70 bg-card shrink-0",
                  unifiedTab === "chat" ? "visible" : "invisible pointer-events-none"
                )}
              >
                {rightChatInput}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
