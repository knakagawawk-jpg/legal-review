"use client"

import { useState, useEffect, useRef, useCallback, useMemo, memo, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { JuristutorLoading, MainAreaWrapper } from "@/components/loading"
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
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  History,
} from "lucide-react"
import { PanelResizer } from "@/components/panel-resizer"
import { SubTabButton } from "@/components/sub-tab-button"
import { ScoreRing } from "@/components/score-ring"
import { FeedbackCard } from "@/components/feedback-card"
import { AnswerWithParagraphs, getAnswerParagraphId } from "@/components/answer-with-paragraphs"
import { stripParagraphMarkers } from "@/lib/paragraphs"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatMessageList } from "@/components/chat/chat-message-list"
import { ChatBar } from "@/components/chat/chat-bar"
import { ChatInput, type ChatInputHandle } from "@/components/chat/chat-input"
import { ChatLoadingIndicator } from "@/components/chat/chat-loading-indicator"
import { getChatMessageTheme } from "@/components/chat/chat-message-theme"
import { cn } from "@/lib/utils"
import type { ReviewResponse } from "@/types/api"
import { useSidebar } from "@/components/sidebar"
import { apiClient } from "@/lib/api-client"
import { getSubjectName } from "@/lib/subjects"


type ReviewThreadItem = { id: number; title: string | null; last_message_at: string | null; created_at: string }

/** 要素を含むスクロール可能な親を取得 */
function getScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent && parent !== document.body) {
    const style = getComputedStyle(parent)
    const oy = style.overflowY
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

/** 表示範囲の上からN行目（約5行）のオフセットピクセル */
const SCROLL_ANCHOR_LINE_INDEX = 5

/** 講評側の項目を一意に指すキー（答案§クリックで該当する講評項目へ飛ぶ用） */
type ReviewItemKey = { type: "strength" | "weakness" | "important" | "future"; index: number }
function getReviewItemId(k: ReviewItemKey): string {
  return `review-${k.type}-${k.index}`
}

/** チャット未送信時に表示する挨拶（第一メッセージ送信時に消す） */
const DEFAULT_CHAT_GREETING = "講評についてご質問があればお気軽にどうぞ。"

export type ReviewResultViewProps = {
  reviewId: string
  threadIdFromUrl?: string | null
  /** 管理者用: 講評取得APIに渡す database_url（指定時のみ使用） */
  databaseUrl?: string | null
  backHref: string
  backLabel: string
  /** 講評ページのベースパス（例: /your-page/review または /dev/review）。省略時は /your-page/review */
  reviewPathPrefix?: string
  /** 複数チャットタブ・履歴を使うか。false のときは単一スレッド＋クリアのみ（講評生成ページなど） */
  enableMultiThreadChat?: boolean
}

export function ReviewResultView({ reviewId, threadIdFromUrl = null, databaseUrl, backHref, backLabel, reviewPathPrefix = "/your-page/review", enableMultiThreadChat = true }: ReviewResultViewProps) {
  const router = useRouter()
  const { mainContentStyle } = useSidebar()

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftWidth, setLeftWidth] = useState(40)
  const [leftTab, setLeftTab] = useState<"answer" | "chat" | "question" | "purpose" | "grading_impression" | "review">("answer")
  const [rightTab, setRightTab] = useState<"review" | "chat" | "question" | "purpose" | "grading_impression" | "answer">("review")
  const [isLargeScreen, setIsLargeScreen] = useState(true)
  type UnifiedTab = "review" | "answer" | "chat" | "question" | "purpose" | "grading_impression"
  const [unifiedTab, setUnifiedTab] = useState<UnifiedTab>("review")
  const [highlightedParagraphNumbers, setHighlightedParagraphNumbers] = useState<number[]>([])
  const [highlightedReviewItemKeys, setHighlightedReviewItemKeys] = useState<ReviewItemKey[]>([])
  const [highlightedReviewParagraphNumber, setHighlightedReviewParagraphNumber] = useState<number | null>(null)
  const [highlightedReviewCurrentIndex, setHighlightedReviewCurrentIndex] = useState(0)

  const handleParagraphClick = useCallback((scrollTo: number, highlight?: number[]) => {
    setLeftTab("answer")
    setUnifiedTab("answer")
    const toHighlight = highlight && highlight.length > 0 ? highlight : [scrollTo]
    setHighlightedParagraphNumbers(toHighlight)
    // タブ切替で答案DOMが描画された後にスクロール調整
    setTimeout(() => {
      const el = document.getElementById(getAnswerParagraphId(scrollTo))
      if (!el) return
      const container = getScrollParent(el)
      if (!container) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" })
        return
      }
      const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || 28
      const N_pixels = lineHeightPx * SCROLL_ANCHOR_LINE_INDEX
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const elTopInContent = elRect.top - containerRect.top + container.scrollTop
      const belowN = elTopInContent > container.scrollTop + N_pixels
      const inView =
        elTopInContent >= container.scrollTop &&
        elTopInContent + el.offsetHeight <= container.scrollTop + container.clientHeight
      const aboveNAndOutOfView = elTopInContent < container.scrollTop + N_pixels && !inView
      if (belowN || aboveNAndOutOfView) {
        const desiredTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, elTopInContent - N_pixels))
        container.scrollTo({ top: desiredTop, behavior: "smooth" })
      }
    }, 0)
    const t = setTimeout(() => setHighlightedParagraphNumbers([]), 10000)
    return () => clearTimeout(t)
  }, [])

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
    { role: "assistant", content: DEFAULT_CHAT_GREETING },
  ])
  const [threadId, setThreadId] = useState<number | null>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [reviewThreads, setReviewThreads] = useState<ReviewThreadItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const isLoadingRef = useRef(false)
  const [chatInputValue, setChatInputValue] = useState("")
  const chatContainerLeftRef = useRef<HTMLDivElement>(null)
  const chatContainerRightRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // isLoadingRefをisLoadingと同期
  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true)
        setError(null)
        const url = databaseUrl
          ? `/api/reviews/${reviewId}?database_url=${encodeURIComponent(databaseUrl)}`
          : `/api/reviews/${reviewId}`
        const data = await apiClient.get<ReviewResponse>(url)
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
  }, [reviewId, databaseUrl])

  useEffect(() => {
    const refs = [chatContainerLeftRef, chatContainerRightRef]
    refs.forEach((ref) => {
      if (ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight
      }
    })
  }, [chatMessages, isLoading])

  const loadThreadList = useCallback(async () => {
    if (!reviewId) return
    try {
      const res = await apiClient.get<{ threads: ReviewThreadItem[]; total: number }>(`/api/reviews/${reviewId}/threads`)
      setReviewThreads(res?.threads ?? [])
    } catch {
      setReviewThreads([])
    }
  }, [reviewId])

  const loadChat = useCallback(async (explicitThreadId?: number): Promise<number | null> => {
    if (!reviewId) return null
    if (!enableMultiThreadChat) {
      if (chatLoaded && threadId) return threadId
      try {
        const thread = await apiClient.post<any>(`/api/reviews/${reviewId}/thread`, {})
        const newTid = Number(thread?.id)
        if (!Number.isFinite(newTid)) return null
        setThreadId(newTid)
        const msgList = await apiClient.get<any>(`/api/threads/${newTid}/messages?limit=200&offset=0`)
        const msgs = (msgList?.messages || [])
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
          .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content || "") }))
        if (msgs.length > 0) setChatMessages(msgs)
        setChatLoaded(true)
        return newTid
      } catch {
        return null
      }
    }
    const tid = explicitThreadId ?? (threadIdFromUrl ? Number(threadIdFromUrl) : null)
    if (tid != null && Number.isFinite(tid) && tid > 0) {
      if (chatLoaded && threadId === tid) return tid
      try {
        const msgList = await apiClient.get<any>(`/api/threads/${tid}/messages?limit=200&offset=0`)
        const msgs = (msgList?.messages || [])
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
          .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content || "") }))
        setThreadId(tid)
        if (msgs.length > 0) setChatMessages(msgs)
        else setChatMessages([{ role: "assistant", content: DEFAULT_CHAT_GREETING }])
        setChatLoaded(true)
        return tid
      } catch {
        // fallback to get-or-create
      }
    }
    if (chatLoaded && threadId) return threadId
    try {
      const thread = await apiClient.post<any>(`/api/reviews/${reviewId}/thread`, {})
      const newTid = Number(thread?.id)
      if (!Number.isFinite(newTid)) return null
      setThreadId(newTid)
      const msgList = await apiClient.get<any>(`/api/threads/${newTid}/messages?limit=200&offset=0`)
      const msgs = (msgList?.messages || [])
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content || "") }))
      if (msgs.length > 0) setChatMessages(msgs)
      setChatLoaded(true)
      return newTid
    } catch {
      return null
    }
  }, [reviewId, chatLoaded, threadId, threadIdFromUrl, enableMultiThreadChat])

  const switchThread = useCallback(async (tid: number) => {
    setChatLoaded(false)
    const params = new URLSearchParams()
    if (tid) params.set("thread_id", String(tid))
    if (databaseUrl) params.set("database_url", databaseUrl)
    const q = params.toString()
    router.replace(`${reviewPathPrefix}/${reviewId}${q ? `?${q}` : ""}`)
    await loadChat(tid)
    loadThreadList()
  }, [reviewId, reviewPathPrefix, databaseUrl, loadChat, loadThreadList, router])

  const handleNewTab = useCallback(async () => {
    if (!reviewId) return
    const hasUserMessage = chatMessages.some((m) => m.role === "user")
    if (!hasUserMessage) return
    try {
      const thread = await apiClient.post<any>(`/api/reviews/${reviewId}/threads`, {})
      const newTid = Number(thread?.id)
      if (Number.isFinite(newTid)) {
        const params = new URLSearchParams({ thread_id: String(newTid) })
        if (databaseUrl) params.set("database_url", databaseUrl)
        router.push(`${reviewPathPrefix}/${reviewId}?${params.toString()}`)
        setThreadId(newTid)
        setChatMessages([{ role: "assistant", content: DEFAULT_CHAT_GREETING }])
        setChatLoaded(true)
        loadThreadList()
      }
    } catch (e) {
      console.error("New thread error:", e)
    }
  }, [reviewId, chatMessages, reviewPathPrefix, databaseUrl, router, loadThreadList])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current || !review) return

    const userMessage = content.trim()
    setChatMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant" && prev[0].content === DEFAULT_CHAT_GREETING) {
        return [{ role: "user" as const, content: userMessage }]
      }
      return [...prev, { role: "user" as const, content: userMessage }]
    })
    setIsLoading(true)

    if (enableMultiThreadChat && abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const abortController = enableMultiThreadChat ? new AbortController() : null
    if (abortController) abortControllerRef.current = abortController

    try {
      const tid = threadId || (await loadChat())
      if (!tid) {
        throw new Error("スレッドの作成に失敗しました")
      }

      const options = abortController ? { signal: abortController.signal } : {}
      const assistant = await apiClient.post<any>(`/api/threads/${tid}/messages`, { content: userMessage }, options)

      if (abortController?.signal.aborted) return

      const assistantText = String(assistant?.content || "")
      setChatMessages((prev) => [...prev, { role: "assistant", content: assistantText || "（空の応答）" }])
      if (enableMultiThreadChat) loadThreadList()
    } catch (error: any) {
      if (error.name === "AbortError" || abortController?.signal.aborted) return
      console.error("Chat error:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `申し訳ございませんが、エラーが発生しました: ${error?.message || "不明なエラー"}`,
        },
      ])
    } finally {
      if (!abortController?.signal.aborted) {
        setIsLoading(false)
        if (enableMultiThreadChat) abortControllerRef.current = null
      }
    }
  }, [review, threadId, loadChat, loadThreadList, enableMultiThreadChat])

  const handleStop = useCallback(() => {
    if (enableMultiThreadChat && abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }, [enableMultiThreadChat])

  const handleClearChat = useCallback(() => {
    setChatMessages([{ role: "assistant", content: DEFAULT_CHAT_GREETING }])
    if (threadId && enableMultiThreadChat) {
      apiClient.delete(`/api/threads/${threadId}/messages`).catch(() => {}).finally(() => {})
    }
  }, [threadId, enableMultiThreadChat])

  useEffect(() => {
    if (!enableMultiThreadChat || !reviewId || !threadIdFromUrl) return
    const tid = Number(threadIdFromUrl)
    if (!Number.isFinite(tid) || tid <= 0) return
    if (threadId === tid && chatLoaded) return
    loadChat(tid)
  }, [enableMultiThreadChat, reviewId, threadIdFromUrl, threadId, chatLoaded, loadChat])

  useEffect(() => {
    if (enableMultiThreadChat && reviewId && (leftTab === "chat" || unifiedTab === "chat")) loadThreadList()
  }, [enableMultiThreadChat, reviewId, leftTab, unifiedTab, loadThreadList])

  /** 左右どちらかがチャットタブのときのみ、テキストを「」でくくって入力欄に挿入（カーソル位置 or 末尾） */
  const isChatTabVisible = leftTab === "chat" || rightTab === "chat" || unifiedTab === "chat"
  /** 未送信時のみ表示する「答案・講評をクリックで入力欄に挿入」の説明（第一メッセージ送信時に消す） */
  const showCopyExplanation =
    chatMessages.length === 1 && chatMessages[0].role === "assistant" && chatMessages[0].content === DEFAULT_CHAT_GREETING
  const handleInsertToChat = useCallback((text: string) => {
    if (isChatTabVisible) chatInputRef.current?.insertText(`「${text}」`)
  }, [isChatTabVisible])

  // ChatInputをメモ化して再マウントを防ぐ（早期リターンの前に配置）
  const leftChatInput = useMemo(
    () => <ChatInput ref={chatInputRef} onSend={handleSendMessage} isLoading={isLoading} onStop={enableMultiThreadChat ? handleStop : undefined} fullWidth value={chatInputValue} onChange={setChatInputValue} />,
    [handleSendMessage, isLoading, handleStop, enableMultiThreadChat, chatInputValue]
  )
  const rightChatInput = useMemo(
    () => <ChatInput ref={chatInputRef} onSend={handleSendMessage} isLoading={isLoading} onStop={enableMultiThreadChat ? handleStop : undefined} fullWidth value={chatInputValue} onChange={setChatInputValue} />,
    [handleSendMessage, isLoading, handleStop, enableMultiThreadChat, chatInputValue]
  )

  // 講評データ（早期 return の後で review があるときと同じ値を参照するため、フックはここで実行）
  const evaluationArrays = useMemo(() => {
    if (!review) return { strengths: [] as any[], weaknesses: [] as any[], importantPoints: [] as any[], futureConsiderations: [] as any[] }
    const rj = typeof review.review_json === "string" ? (() => { try { return JSON.parse(review.review_json) as ReviewResponse["review_json"] } catch { return {} } })() : (review.review_json || {})
    const ev = rj.evaluation ?? rj
    return {
      strengths: ev.strengths || [],
      weaknesses: ev.weaknesses || [],
      importantPoints: ev.important_points || [],
      futureConsiderations: ev.future_considerations || [],
    }
  }, [review])

  /** 講評側の指定キーへスクロール（5行基準） */
  const scrollToReviewItemKey = useCallback((key: ReviewItemKey) => {
    const id = getReviewItemId(key)
    const el = document.getElementById(id)
    if (!el) return
    const container = getScrollParent(el)
    if (!container) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || 28
    const N_pixels = lineHeightPx * SCROLL_ANCHOR_LINE_INDEX
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const elTopInContent = elRect.top - containerRect.top + container.scrollTop
    const belowN = elTopInContent > container.scrollTop + N_pixels
    const inView =
      elTopInContent >= container.scrollTop &&
      elTopInContent + el.offsetHeight <= container.scrollTop + container.clientHeight
    const aboveNAndOutOfView = elTopInContent < container.scrollTop + N_pixels && !inView
    if (belowN || aboveNAndOutOfView) {
      const desiredTop = Math.max(
        0,
        Math.min(container.scrollHeight - container.clientHeight, elTopInContent - N_pixels),
      )
      container.scrollTo({ top: desiredTop, behavior: "smooth" })
    }
  }, [])

  /** 逆側が講評タブのとき、該当段落を持つ講評項目をすべてハイライトし、先頭へスクロール（5行基準） */
  const handleNavigateToReviewFromAnswer = useCallback(
    (paragraphNumber: number) => {
      const isReviewOnOpposite =
        (leftTab === "answer" && rightTab === "review") ||
        (rightTab === "answer" && leftTab === "review") ||
        unifiedTab === "answer"
      if (!isReviewOnOpposite) return

      const didSwitchToReview = unifiedTab === "answer"
      if (didSwitchToReview) setUnifiedTab("review")

      const N = paragraphNumber
      const keys: ReviewItemKey[] = []
      const { strengths: str, weaknesses: wkn, importantPoints: imp, futureConsiderations: fut } = evaluationArrays
      str.forEach((s: { paragraph_numbers?: number[] }, i: number) => {
        const nums = s.paragraph_numbers ?? []
        if (nums.some((p: number) => p === N)) keys.push({ type: "strength", index: i })
      })
      wkn.forEach((w: { paragraph_numbers?: number[] }, i: number) => {
        const nums = w.paragraph_numbers ?? []
        if (nums.some((p: number) => p === N)) keys.push({ type: "weakness", index: i })
      })
      imp.forEach((p: { paragraph_number?: number }, i: number) => {
        if (p.paragraph_number === N) keys.push({ type: "important", index: i })
      })
      fut.forEach((item: any, i: number) => {
        const nums = item?.paragraph_numbers ?? item?.paragraphNumbers ?? []
        const arr = Array.isArray(nums) ? nums : []
        if (arr.some((p: number) => Number(p) === N)) keys.push({ type: "future", index: i })
      })

      if (keys.length === 0) {
        setHighlightedReviewItemKeys([])
        setHighlightedReviewParagraphNumber(null)
        return
      }
      setHighlightedReviewItemKeys(keys)
      setHighlightedReviewParagraphNumber(N)
      setHighlightedReviewCurrentIndex(0)
      const scrollDelay = didSwitchToReview ? 150 : 0
      setTimeout(() => scrollToReviewItemKey(keys[0]), scrollDelay)
    },
    [leftTab, rightTab, unifiedTab, evaluationArrays, scrollToReviewItemKey],
  )

  /** 答案§の〇/〇表示で上/下を押したとき、講評側の該当項目へスクロール */
  const handleReviewFocusIndexChange = useCallback(
    (newIndex: number) => {
      const keys = highlightedReviewItemKeys
      if (newIndex < 0 || newIndex >= keys.length) return
      setHighlightedReviewCurrentIndex(newIndex)
      scrollToReviewItemKey(keys[newIndex])
    },
    [highlightedReviewItemKeys, scrollToReviewItemKey],
  )

  const highlightedReviewIdSet = useMemo(
    () => new Set(highlightedReviewItemKeys.map(getReviewItemId)),
    [highlightedReviewItemKeys],
  )

  /** 講評のいずれかの項目が Paragraph Num に含む段落番号（対応しない§を薄く表示する用） */
  const paragraphNumbersWithReviewItems = useMemo(() => {
    const set = new Set<number>()
    const { strengths, weaknesses, importantPoints, futureConsiderations } = evaluationArrays
    strengths.forEach((s: { paragraph_numbers?: number[] }) => (s.paragraph_numbers ?? []).forEach((p: number) => set.add(p)))
    weaknesses.forEach((w: { paragraph_numbers?: number[] }) => (w.paragraph_numbers ?? []).forEach((p: number) => set.add(p)))
    importantPoints.forEach((p: { paragraph_number?: number }) => { if (p.paragraph_number != null) set.add(p.paragraph_number) })
    futureConsiderations.forEach((item: any) => {
      const nums = item?.paragraph_numbers ?? item?.paragraphNumbers ?? []
      ;(Array.isArray(nums) ? nums : []).forEach((p: number) => set.add(Number(p)))
    })
    return set
  }, [evaluationArrays])

  if (loading) {
    return (
      <MainAreaWrapper>
        <JuristutorLoading message="講評を取得しています" fullScreen />
      </MainAreaWrapper>
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
          <Button onClick={() => router.push(backHref)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>
        </div>
      </div>
    )
  }

  const reviewJson =
    typeof review.review_json === "string"
      ? (() => {
          try {
            return JSON.parse(review.review_json) as ReviewResponse["review_json"]
          } catch {
            return {}
          }
        })()
      : (review.review_json || {})
  const evaluation = reviewJson.evaluation ?? reviewJson
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

  // subject_idから科目名を取得（subject_nameが優先）
  const subjectName = review.subject_name || (review.subject ? getSubjectName(review.subject) : "")
  const questionText = review.question_text || ""
  const purposeText = review.purpose || ""
  const gradingImpressionText = review.grading_impression_text || ""
  const purposeLabel = review.source_type === "custom" ? "参考文章" : "出題趣旨"
  const questionTitle = review.question_title || ""
  const chatBadgeCount = Math.max(chatMessages.length - 1, 0)
  const chatTheme = getChatMessageTheme("review")

  const ChatPanel = memo(({ 
    containerRef,
    chatMessages: msgs,
    isLoading: loading,
    chatBadgeCount: badgeCount,
    chatTheme: theme,
    enableMultiThread: multiThread,
    onClearChat,
    onNewTab,
    canCreateNewTab,
    reviewThreads: threads,
    historyOpen: historyOpenProp,
    onHistoryOpenChange,
    currentThreadId,
    onSelectThread,
  }: { 
    containerRef: RefObject<HTMLDivElement>
    chatMessages: Array<{ role: "user" | "assistant"; content: string }>
    isLoading: boolean
    chatBadgeCount: number
    chatTheme: ReturnType<typeof getChatMessageTheme>
    enableMultiThread: boolean
    onClearChat?: () => void
    onNewTab?: () => void
    canCreateNewTab?: boolean
    reviewThreads?: ReviewThreadItem[]
    historyOpen?: boolean
    onHistoryOpenChange?: (open: boolean) => void
    currentThreadId?: number | null
    onSelectThread?: (tid: number) => void
  }) => {
    const trailing = multiThread ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewTab}
                disabled={!canCreateNewTab}
                title={canCreateNewTab ? "新しいチャットを開始" : "1通以上メッセージを送信すると利用できます"}
                className="h-7 text-muted-foreground hover:text-foreground rounded-full disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                新規タブ
              </Button>
              <span className="text-[10px] text-muted-foreground leading-tight hidden sm:inline">
                話題が変わる場合には
                <br />
                新しいタブで行うことを推奨しています
              </span>
              {(threads?.length ?? 0) > 0 && (
                <div className="relative border-l border-border pl-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onHistoryOpenChange?.(!historyOpenProp)}
                    className="h-7 text-muted-foreground hover:text-foreground rounded-full gap-1"
                  >
                    {historyOpenProp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <History className="h-3.5 w-3.5" />
                    <span className="text-xs">チャット履歴</span>
                  </Button>
                  {historyOpenProp && (
                    <div className="absolute right-0 top-full mt-1 z-10 min-w-[200px] max-h-[240px] overflow-y-auto rounded-lg border border-border bg-card shadow-md py-1">
                      {(threads ?? []).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onSelectThread?.(t.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm truncate",
                            currentThreadId === t.id
                              ? "bg-lime-500/15 text-lime-800 font-medium"
                              : "text-foreground hover:bg-muted"
                          )}
                          title={t.title || `スレッド ${t.id}`}
                        >
                          {t.title || `スレッド ${t.id}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="h-7 text-muted-foreground hover:text-foreground rounded-full"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              クリア
            </Button>
          )
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
          trailing={trailing}
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
    if (prevProps.chatMessages.length !== nextProps.chatMessages.length) return false
    if (prevProps.chatMessages.length > 0 && nextProps.chatMessages.length > 0) {
      const lastPrev = prevProps.chatMessages[prevProps.chatMessages.length - 1]
      const lastNext = nextProps.chatMessages[nextProps.chatMessages.length - 1]
      if (lastPrev.content !== lastNext.content || lastPrev.role !== lastNext.role) {
        return false
      }
    }
    if (prevProps.isLoading !== nextProps.isLoading) return false
    if (prevProps.chatBadgeCount !== nextProps.chatBadgeCount) return false
    if (prevProps.enableMultiThread !== nextProps.enableMultiThread) return false
    if (prevProps.enableMultiThread && nextProps.enableMultiThread) {
      if (prevProps.currentThreadId !== nextProps.currentThreadId) return false
      if (prevProps.historyOpen !== nextProps.historyOpen) return false
      if (prevProps.canCreateNewTab !== nextProps.canCreateNewTab) return false
      if ((prevProps.reviewThreads?.length ?? 0) !== (nextProps.reviewThreads?.length ?? 0)) return false
    }
    return true
  })
  
  ChatPanel.displayName = "ChatPanel"

  return (
    <div
      className="h-screen min-w-0 bg-background flex flex-col overflow-hidden transition-all duration-300"
      style={mainContentStyle}
    >
      <header className="border-b border-border shrink-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="px-5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2 h-8 text-muted-foreground hover:text-foreground" onClick={() => router.push(backHref)}>
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">{backLabel}</span>
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
        className={cn(
          "flex flex-1 min-h-0 min-w-0 overflow-hidden w-full",
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
                active={leftTab === "review"}
                onClick={() => setLeftTab("review")}
                icon={BookOpen}
                label="講評"
              />
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
                      onClick={() => handleCopy(stripParagraphMarkers(review.answer_text))}
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
                  <AnswerWithParagraphs
                    answerText={review.answer_text}
                    highlightedNumbers={highlightedParagraphNumbers}
                    onParagraphCopyClick={(num, content) => handleInsertToChat(content + `（§${num}）`)}
                    onParagraphNavigateToReview={handleNavigateToReviewFromAnswer}
                    reviewFocusInfo={
                      highlightedReviewParagraphNumber != null && highlightedReviewItemKeys.length > 0
                        ? {
                            paragraphNumber: highlightedReviewParagraphNumber,
                            currentIndex: highlightedReviewCurrentIndex,
                            totalCount: highlightedReviewItemKeys.length,
                          }
                        : null
                    }
                    onReviewFocusIndexChange={handleReviewFocusIndexChange}
                    paragraphNumbersWithReviewItems={paragraphNumbersWithReviewItems}
                  />
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

              {leftTab === "review" && (
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
                        {strengths.map((strength: any, index: number) => {
                          const key: ReviewItemKey = { type: "strength", index }
                          const id = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={id}
                              className={cn(
                                "transition-colors duration-300 rounded-xl",
                                highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <FeedbackCard
                                type="strength"
                                category={strength.category}
                                description={strength.description}
                                paragraphs={strength.paragraph_numbers}
                                onParagraphClick={handleParagraphClick}
                                onCopyToChat={handleInsertToChat}
                                isChatTabVisible={isChatTabVisible}
                              />
                            </div>
                          )
                        })}
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
                        {weaknesses.map((weakness: any, index: number) => {
                          const key: ReviewItemKey = { type: "weakness", index }
                          const id = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={id}
                              className={cn(
                                "transition-colors duration-300 rounded-xl",
                                highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <FeedbackCard
                                type="weakness"
                                category={weakness.category}
                                description={weakness.description}
                                paragraphs={weakness.paragraph_numbers}
                                suggestion={weakness.suggestion}
                                onParagraphClick={handleParagraphClick}
                                onCopyToChat={handleInsertToChat}
                                isChatTabVisible={isChatTabVisible}
                              />
                            </div>
                          )
                        })}
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
                        {importantPoints.map((point: any, index: number) => {
                          const pNum = point.paragraph_number != null && point.paragraph_number > 0 ? point.paragraph_number : null
                          const key: ReviewItemKey = { type: "important", index }
                          const reviewItemId = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={reviewItemId}
                              role={pNum != null && !isChatTabVisible ? "button" : undefined}
                              tabIndex={pNum != null && !isChatTabVisible ? 0 : undefined}
                              onClick={pNum != null && !isChatTabVisible ? () => handleParagraphClick(pNum, [pNum]) : undefined}
                              onKeyDown={
                                pNum != null && !isChatTabVisible
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        handleParagraphClick(pNum, [pNum])
                                      }
                                    }
                                  : undefined
                              }
                              className={cn(
                                "bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow",
                                pNum != null && !isChatTabVisible && "cursor-pointer",
                                highlightedReviewIdSet.has(reviewItemId) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <div className="flex items-center gap-2 mb-4 flex-wrap">
                                {pNum != null && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!isChatTabVisible) handleParagraphClick(pNum)
                                    }}
                                    className="text-xs font-bold px-2 py-1 rounded-full bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                  >
                                    §{pNum}
                                  </button>
                                )}
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary">
                                  第{point.paragraph_number}段落
                                </span>
                              </div>
                              <div className="space-y-4 text-sm">
                                <div
                                  className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <div className="w-1 rounded-full bg-success shrink-0" />
                                  <div>
                                    <span className="text-xs font-semibold text-success uppercase tracking-wider">
                                      良い点
                                    </span>
                                    <p className="mt-1 text-muted-foreground">{point.what_is_good}</p>
                                  </div>
                                </div>
                                <div
                                  className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <div className="w-1 rounded-full bg-error shrink-0" />
                                  <div>
                                    <span className="text-xs font-semibold text-error uppercase tracking-wider">不足点</span>
                                    <p className="mt-1 text-muted-foreground">{point.what_is_lacking}</p>
                                  </div>
                                </div>
                                <div
                                  className="pt-3 border-t border-border rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">改善点</span>
                                  <p className="mt-1 text-xs text-foreground/70 italic leading-relaxed">{point.why_important}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
                          const content = typeof item === "string" ? item : item.content
                          const blockNumber = typeof item === "object" && item && "block_number" in item ? item.block_number : index + 1
                          const paragraphNumbers = item && (item.paragraph_numbers ?? item.paragraphNumbers)
                          const validParagraphNumbers = (paragraphNumbers && Array.isArray(paragraphNumbers) ? paragraphNumbers.filter((n: number) => Number(n) > 0) : []) as number[]
                          const firstPara = validParagraphNumbers.length > 0 ? Math.min(...validParagraphNumbers) : null
                          const futureKey: ReviewItemKey = { type: "future", index }
                          const futureId = getReviewItemId(futureKey)
                          return (
                            <li
                              key={index}
                              id={futureId}
                              role={firstPara != null ? "button" : undefined}
                              tabIndex={firstPara != null ? 0 : undefined}
                              onClick={firstPara != null ? () => { if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : "")); else handleParagraphClick(firstPara, validParagraphNumbers) } : undefined}
                              onKeyDown={
                                firstPara != null
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : ""))
                                        else handleParagraphClick(firstPara, validParagraphNumbers)
                                      }
                                    }
                                  : undefined
                              }
                              className={cn(
                                "flex items-start gap-3 text-sm text-foreground/80 rounded-lg transition-colors duration-300",
                                firstPara != null && "cursor-pointer",
                                highlightedReviewIdSet.has(futureId) && "ring-2 ring-primary/30 bg-primary/5 p-2 -m-2",
                              )}
                            >
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                {blockNumber}
                              </span>
                              <div className="flex-1 min-w-0">
                                {validParagraphNumbers.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mb-1">
                                    {validParagraphNumbers.map((p: number) => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!isChatTabVisible) handleParagraphClick(p)
                                        }}
                                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                      >
                                        §{p}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <span className="leading-relaxed">{content}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
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
                    enableMultiThread={enableMultiThreadChat}
                    onClearChat={handleClearChat}
                    onNewTab={handleNewTab}
                    canCreateNewTab={chatMessages.some((m) => m.role === "user")}
                    reviewThreads={reviewThreads}
                    historyOpen={historyOpen}
                    onHistoryOpenChange={setHistoryOpen}
                    currentThreadId={threadId}
                    onSelectThread={switchThread}
                  />
                </div>
              )}
            </div>
            {/* ChatInputはチャットタブのときのみレンダリング（下部領域の有効活用） */}
            {leftTab === "chat" && (
              <div className="border-t border-border/70 bg-card shrink-0">
                {showCopyExplanation && (
                  <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
                    答案・講評タブの段落やカードをクリックすると、その内容がチャット入力欄に引用として挿入されます。
                  </p>
                )}
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
                active={rightTab === "answer"}
                onClick={() => setRightTab("answer")}
                icon={FileText}
                label="答案"
              />
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
              {rightTab === "answer" && (
                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-secondary/50 to-transparent">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">提出答案</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(stripParagraphMarkers(review.answer_text))}
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
                  <AnswerWithParagraphs
                    answerText={review.answer_text}
                    highlightedNumbers={highlightedParagraphNumbers}
                    paragraphIdPrefix="answer-para-right-"
                    onParagraphCopyClick={(num, content) => handleInsertToChat(content + `（§${num}）`)}
                    onParagraphNavigateToReview={handleNavigateToReviewFromAnswer}
                    reviewFocusInfo={
                      highlightedReviewParagraphNumber != null && highlightedReviewItemKeys.length > 0
                        ? {
                            paragraphNumber: highlightedReviewParagraphNumber,
                            currentIndex: highlightedReviewCurrentIndex,
                            totalCount: highlightedReviewItemKeys.length,
                          }
                        : null
                    }
                    onReviewFocusIndexChange={handleReviewFocusIndexChange}
                    paragraphNumbersWithReviewItems={paragraphNumbersWithReviewItems}
                  />
                </div>
              )}

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

                  {strengths.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-success uppercase tracking-wider mb-4 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-success/10">
                          <TrendingUp className="h-3.5 w-3.5" />
                        </div>
                        評価した点
                      </h3>
                      <div className="space-y-3">
                        {strengths.map((strength: any, index: number) => {
                          const key: ReviewItemKey = { type: "strength", index }
                          const id = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={id}
                              className={cn(
                                "transition-colors duration-300 rounded-xl",
                                highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <FeedbackCard
                                type="strength"
                                category={strength.category}
                                description={strength.description}
                                paragraphs={strength.paragraph_numbers}
                                onParagraphClick={handleParagraphClick}
                                onCopyToChat={handleInsertToChat}
                                isChatTabVisible={isChatTabVisible}
                              />
                            </div>
                          )
                        })}
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
                        {weaknesses.map((weakness: any, index: number) => {
                          const key: ReviewItemKey = { type: "weakness", index }
                          const id = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={id}
                              className={cn(
                                "transition-colors duration-300 rounded-xl",
                                highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <FeedbackCard
                                type="weakness"
                                category={weakness.category}
                                description={weakness.description}
                                paragraphs={weakness.paragraph_numbers}
                                suggestion={weakness.suggestion}
                                onParagraphClick={handleParagraphClick}
                                onCopyToChat={handleInsertToChat}
                                isChatTabVisible={isChatTabVisible}
                              />
                            </div>
                          )
                        })}
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
                        {importantPoints.map((point: any, index: number) => {
                          const pNum = point.paragraph_number != null && point.paragraph_number > 0 ? point.paragraph_number : null
                          const key: ReviewItemKey = { type: "important", index }
                          const reviewItemId = getReviewItemId(key)
                          return (
                            <div
                              key={index}
                              id={reviewItemId}
                              role={pNum != null && !isChatTabVisible ? "button" : undefined}
                              tabIndex={pNum != null && !isChatTabVisible ? 0 : undefined}
                              onClick={pNum != null && !isChatTabVisible ? () => handleParagraphClick(pNum, [pNum]) : undefined}
                              onKeyDown={
                                pNum != null && !isChatTabVisible
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        handleParagraphClick(pNum, [pNum])
                                      }
                                    }
                                  : undefined
                              }
                              className={cn(
                                "bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow",
                                pNum != null && !isChatTabVisible && "cursor-pointer",
                                highlightedReviewIdSet.has(reviewItemId) && "ring-2 ring-primary/30 bg-primary/5",
                              )}
                            >
                              <div className="flex items-center gap-2 mb-4 flex-wrap">
                                {pNum != null && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!isChatTabVisible) handleParagraphClick(pNum)
                                    }}
                                    className="text-xs font-bold px-2 py-1 rounded-full bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                  >
                                    §{pNum}
                                  </button>
                                )}
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary">
                                  第{point.paragraph_number}段落
                                </span>
                              </div>
                              <div className="space-y-4 text-sm">
                                <div
                                  className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <div className="w-1 rounded-full bg-success shrink-0" />
                                  <div>
                                    <span className="text-xs font-semibold text-success uppercase tracking-wider">
                                      良い点
                                    </span>
                                    <p className="mt-1 text-muted-foreground">{point.what_is_good}</p>
                                  </div>
                                </div>
                                <div
                                  className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <div className="w-1 rounded-full bg-error shrink-0" />
                                  <div>
                                    <span className="text-xs font-semibold text-error uppercase tracking-wider">不足点</span>
                                    <p className="mt-1 text-muted-foreground">{point.what_is_lacking}</p>
                                  </div>
                                </div>
                                <div
                                  className="pt-3 border-t border-border rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                >
                                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">改善点</span>
                                  <p className="mt-1 text-xs text-foreground/70 italic leading-relaxed">{point.why_important}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
                          const content = typeof item === "string" ? item : item.content
                          const blockNumber = typeof item === "object" && item && "block_number" in item ? item.block_number : index + 1
                          const paragraphNumbers = item && (item.paragraph_numbers ?? item.paragraphNumbers)
                          const validParagraphNumbers = (paragraphNumbers && Array.isArray(paragraphNumbers) ? paragraphNumbers.filter((n: number) => Number(n) > 0) : []) as number[]
                          const firstPara = validParagraphNumbers.length > 0 ? Math.min(...validParagraphNumbers) : null
                          const futureKey: ReviewItemKey = { type: "future", index }
                          const futureId = getReviewItemId(futureKey)
                          return (
                            <li
                              key={index}
                              id={futureId}
                              role={firstPara != null ? "button" : undefined}
                              tabIndex={firstPara != null ? 0 : undefined}
                              onClick={firstPara != null ? () => { if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : "")); else handleParagraphClick(firstPara, validParagraphNumbers) } : undefined}
                              onKeyDown={
                                firstPara != null
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : ""))
                                        else handleParagraphClick(firstPara, validParagraphNumbers)
                                      }
                                    }
                                  : undefined
                              }
                              className={cn(
                                "flex items-start gap-3 text-sm text-foreground/80 rounded-lg transition-colors duration-300",
                                firstPara != null && "cursor-pointer",
                                highlightedReviewIdSet.has(futureId) && "ring-2 ring-primary/30 bg-primary/5 p-2 -m-2",
                              )}
                            >
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                {blockNumber}
                              </span>
                              <div className="flex-1 min-w-0">
                                {validParagraphNumbers.length > 0 && (
                                  <div className="flex gap-1 flex-wrap mb-1">
                                    {validParagraphNumbers.map((p: number) => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!isChatTabVisible) handleParagraphClick(p)
                                        }}
                                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                      >
                                        §{p}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <span className="leading-relaxed">{content}</span>
                              </div>
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

              {rightTab === "chat" && (
                <div className="flex flex-col h-full">
                  <ChatPanel 
                    containerRef={chatContainerRightRef}
                    chatMessages={chatMessages}
                    isLoading={isLoading}
                    chatBadgeCount={chatBadgeCount}
                    chatTheme={chatTheme}
                    enableMultiThread={enableMultiThreadChat}
                    onClearChat={handleClearChat}
                    onNewTab={handleNewTab}
                    canCreateNewTab={chatMessages.some((m) => m.role === "user")}
                    reviewThreads={reviewThreads}
                    historyOpen={historyOpen}
                    onHistoryOpenChange={setHistoryOpen}
                    currentThreadId={threadId}
                    onSelectThread={switchThread}
                  />
                </div>
              )}
            </div>
            {/* ChatInputはチャットタブのときのみレンダリング（下部領域の有効活用） */}
            {rightTab === "chat" && (
              <div className="border-t border-border/70 bg-card shrink-0">
                {showCopyExplanation && (
                  <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
                    答案・講評タブの段落やカードをクリックすると、その内容がチャット入力欄に引用として挿入されます。
                  </p>
                )}
                {rightChatInput}
              </div>
            )}
          </div>
        </div>
          </>
        ) : (
          /* 縦並び: 1ウィンドウで講評・答案・チャット・問題文・出題趣旨を統合タブ表示 */
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden w-full bg-background">
            <div className="px-5 py-3 border-b border-border shrink-0 flex flex-wrap items-center justify-between gap-2 bg-card/50">
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
                          {strengths.map((strength: any, index: number) => {
                            const key: ReviewItemKey = { type: "strength", index }
                            const id = getReviewItemId(key)
                            return (
                              <div
                                key={index}
                                id={id}
                                className={cn(
                                  "transition-colors duration-300 rounded-xl",
                                  highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                                )}
                              >
                                <FeedbackCard
                                  type="strength"
                                  category={strength.category}
                                  description={strength.description}
                                  paragraphs={strength.paragraph_numbers}
                                  onParagraphClick={handleParagraphClick}
                                  onCopyToChat={handleInsertToChat}
                                  isChatTabVisible={isChatTabVisible}
                                />
                              </div>
                            )
                          })}
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
                          {weaknesses.map((weakness: any, index: number) => {
                            const key: ReviewItemKey = { type: "weakness", index }
                            const id = getReviewItemId(key)
                            return (
                              <div
                                key={index}
                                id={id}
                                className={cn(
                                  "transition-colors duration-300 rounded-xl",
                                  highlightedReviewIdSet.has(id) && "ring-2 ring-primary/30 bg-primary/5",
                                )}
                              >
                                <FeedbackCard
                                  type="weakness"
                                  category={weakness.category}
                                  description={weakness.description}
                                  paragraphs={weakness.paragraph_numbers}
                                  suggestion={weakness.suggestion}
                                  onParagraphClick={handleParagraphClick}
                                  onCopyToChat={handleInsertToChat}
                                  isChatTabVisible={isChatTabVisible}
                                />
                              </div>
                            )
                          })}
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
                          {importantPoints.map((point: any, index: number) => {
                            const pNum = point.paragraph_number != null && point.paragraph_number > 0 ? point.paragraph_number : null
                            const key: ReviewItemKey = { type: "important", index }
                            const reviewItemId = getReviewItemId(key)
                            return (
                              <div
                                key={index}
                                id={reviewItemId}
                                role={pNum != null && !isChatTabVisible ? "button" : undefined}
                                tabIndex={pNum != null && !isChatTabVisible ? 0 : undefined}
                                onClick={pNum != null && !isChatTabVisible ? () => handleParagraphClick(pNum, [pNum]) : undefined}
                                onKeyDown={
                                  pNum != null && !isChatTabVisible
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault()
                                          handleParagraphClick(pNum, [pNum])
                                        }
                                      }
                                    : undefined
                                }
                                className={cn(
                                  "bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow",
                                  pNum != null && !isChatTabVisible && "cursor-pointer",
                                  highlightedReviewIdSet.has(reviewItemId) && "ring-2 ring-primary/30 bg-primary/5",
                                )}
                              >
                                <div className="flex items-center gap-2 mb-4 flex-wrap">
                                  {pNum != null && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!isChatTabVisible) handleParagraphClick(pNum)
                                      }}
                                      className="text-xs font-bold px-2 py-1 rounded-full bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                    >
                                      §{pNum}
                                    </button>
                                  )}
                                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary">
                                    第{point.paragraph_number}段落
                                  </span>
                                </div>
                                <div className="space-y-4 text-sm">
                                  <div
                                    className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_good ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                  >
                                    <div className="w-1 rounded-full bg-success shrink-0" />
                                    <div>
                                      <span className="text-xs font-semibold text-success uppercase tracking-wider">良い点</span>
                                      <p className="mt-1 text-muted-foreground">{point.what_is_good}</p>
                                    </div>
                                  </div>
                                  <div
                                    className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.what_is_lacking ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                  >
                                    <div className="w-1 rounded-full bg-error shrink-0" />
                                    <div>
                                      <span className="text-xs font-semibold text-error uppercase tracking-wider">不足点</span>
                                      <p className="mt-1 text-muted-foreground">{point.what_is_lacking}</p>
                                    </div>
                                  </div>
                                  <div
                                    className="pt-3 border-t border-border rounded-lg p-2 -m-2 hover:bg-muted/50 cursor-pointer transition-colors"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : ""))
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); handleInsertToChat((point.why_important ?? "") + (pNum != null ? `（§${pNum}）` : "")) } }}
                                  >
                                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">改善点</span>
                                    <p className="mt-1 text-xs text-foreground/70 italic leading-relaxed">{point.why_important}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {futureConsiderations.length > 0 && (
                      <div className="bg-gradient-to-br from-secondary/60 to-accent/20 rounded-2xl p-6 border border-border/50">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">今後意識すべきこと</h3>
                        <ul className="space-y-3">
                          {futureConsiderations.map((item: any, index: number) => {
                            const content = typeof item === "string" ? item : item.content
                            const blockNumber = typeof item === "object" && item && "block_number" in item ? item.block_number : index + 1
                            const paragraphNumbers = item && (item.paragraph_numbers ?? item.paragraphNumbers)
                            const validParagraphNumbers = (paragraphNumbers && Array.isArray(paragraphNumbers) ? paragraphNumbers.filter((n: number) => Number(n) > 0) : []) as number[]
                            const firstPara = validParagraphNumbers.length > 0 ? Math.min(...validParagraphNumbers) : null
                            return (
                              <li
                                key={index}
                                role={firstPara != null ? "button" : undefined}
                                tabIndex={firstPara != null ? 0 : undefined}
                                onClick={firstPara != null ? () => { if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : "")); else handleParagraphClick(firstPara, validParagraphNumbers) } : undefined}
                                onKeyDown={
                                  firstPara != null
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault()
                                          if (isChatTabVisible) handleInsertToChat((content ?? "") + (validParagraphNumbers.length > 0 ? `（§${validParagraphNumbers.join("，§")}）` : ""))
                                          else handleParagraphClick(firstPara, validParagraphNumbers)
                                        }
                                      }
                                    : undefined
                                }
                                className={cn(
                                  "flex items-start gap-3 text-sm text-foreground/80",
                                  firstPara != null && "cursor-pointer",
                                )}
                              >
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                  {blockNumber}
                                </span>
                                <div className="flex-1 min-w-0">
                                  {validParagraphNumbers.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mb-1">
                                      {validParagraphNumbers.map((p: number) => (
                                        <button
                                          key={p}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (!isChatTabVisible) handleParagraphClick(p)
                                          }}
                                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary hover:opacity-80 transition-opacity"
                                        >
                                          §{p}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <span className="leading-relaxed">{content}</span>
                                </div>
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
                        onClick={() => handleCopy(stripParagraphMarkers(review.answer_text))}
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
                    <AnswerWithParagraphs
                      answerText={review.answer_text}
                      highlightedNumbers={highlightedParagraphNumbers}
                      onParagraphCopyClick={(num, content) => handleInsertToChat(content + `（§${num}）`)}
                      onParagraphNavigateToReview={handleNavigateToReviewFromAnswer}
                      reviewFocusInfo={
                        highlightedReviewParagraphNumber != null && highlightedReviewItemKeys.length > 0
                          ? {
                              paragraphNumber: highlightedReviewParagraphNumber,
                              currentIndex: highlightedReviewCurrentIndex,
                              totalCount: highlightedReviewItemKeys.length,
                            }
                          : null
                      }
                      onReviewFocusIndexChange={handleReviewFocusIndexChange}
                      paragraphNumbersWithReviewItems={paragraphNumbersWithReviewItems}
                    />
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
                      enableMultiThread={enableMultiThreadChat}
                      onClearChat={handleClearChat}
                      onNewTab={handleNewTab}
                      canCreateNewTab={chatMessages.some((m) => m.role === "user")}
                      reviewThreads={reviewThreads}
                      historyOpen={historyOpen}
                      onHistoryOpenChange={setHistoryOpen}
                      currentThreadId={threadId}
                      onSelectThread={switchThread}
                    />
                  </div>
                )}
                {unifiedTab === "question" && (
                  <div className="bg-secondary/40 rounded-2xl border border-border/50 p-5">
                    <pre className="text-sm whitespace-pre-wrap text-muted-foreground leading-7">{questionText}</pre>
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
              {/* ChatInputはチャットタブのときのみレンダリング（下部領域の有効活用） */}
              {unifiedTab === "chat" && (
                <div className="border-t border-border/70 bg-card shrink-0">
                  {showCopyExplanation && (
                    <p className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
                      答案・講評タブの段落やカードをクリックすると、その内容がチャット入力欄に引用として挿入されます。
                    </p>
                  )}
                  {rightChatInput}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
