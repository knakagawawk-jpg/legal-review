"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, AlertCircle, Loader2, Copy, Check, ChevronDown, ChevronRight, BookOpen, PenLine, Sparkles, Scale, FileText, X, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewRequest, ReviewResponse } from "@/types/api"
import { formatYearToEra, formatYearToShortEra } from "@/lib/utils"
import { getSubjectName, getSubjectId, FIXED_SUBJECTS } from "@/lib/subjects"
import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { apiClient } from "@/lib/api-client"
import { hasFunctionalConsent } from "@/lib/cookie-consent"

type Step = 1 | 2
type Mode = "existing" | "new"

export default function ReviewPage() {
  const router = useRouter()
  const { mainContentStyle } = useSidebar()
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<Mode>("existing")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationPhase, setGenerationPhase] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [billingDialogMode, setBillingDialogMode] = useState<"plan" | "ticket">("plan")
  const [checkoutLoading, setCheckoutLoading] = useState<null | "basic" | "high" | "first_month" | "ticket">(null)
  const [fmDmEligible, setFmDmEligible] = useState(false)

  // Step 1: 問題選択 + 答案入力
  const [examType, setExamType] = useState<string>("")
  const [year, setYear] = useState<number | null>(null)
  const [subject, setSubject] = useState<number | null>(null)  // 既存問題選択用（科目ID）
  const [newSubjectId, setNewSubjectId] = useState<number | null>(null)  // 新規問題用の科目ID
  const [officialQuestionId, setOfficialQuestionId] = useState<number | null>(null)
  const [questionTitle, setQuestionTitle] = useState<string>("")
  const [questionText, setQuestionText] = useState<string>("")
  const [referenceText, setReferenceText] = useState<string>("")
  const [gradingImpressionText, setGradingImpressionText] = useState<string>("")
  const [answerText, setAnswerText] = useState<string>("")

  // データ取得
  const [years, setYears] = useState<number[]>([])
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [isQuestionOpen, setIsQuestionOpen] = useState(false)
  const [isPurposeOpen, setIsPurposeOpen] = useState(false)

  // localStorageから答案を復元
  useEffect(() => {
    // 機能Cookieの同意をチェック
    if (hasFunctionalConsent()) {
      const saved = localStorage.getItem("review_answer_text")
      if (saved) {
        setAnswerText(saved)
      }
    }
  }, [])

  // 答案をlocalStorageに保存
  useEffect(() => {
    if (answerText) {
      // 機能Cookieの同意をチェック
      if (hasFunctionalConsent()) {
        localStorage.setItem("review_answer_text", answerText)
      }
      // 同意がない場合は保存しない（警告は出さない - UX向上のための機能なので）
    }
  }, [answerText])

  useEffect(() => {
    const url = new URL(window.location.href)
    const via = url.searchParams.get("via")
    const fromFmDmPath = window.location.pathname === "/signup/fm-dm-first-month"
    const eligible = via === "fm-dm" || fromFmDmPath || localStorage.getItem("fm_dm_eligible") === "1"
    setFmDmEligible(eligible)
  }, [])


  // 年度一覧を取得（試験種別でフィルタ）
  useEffect(() => {
    const fetchYears = async () => {
      if (mode !== "existing") return
      setLoadingYears(true)
      try {
        const shiken_type =
          examType === "司法試験" ? "shihou" : examType === "予備試験" ? "yobi" : null
        const url = shiken_type ? `/api/official-questions/years?shiken_type=${shiken_type}` : "/api/official-questions/years"
        const res = await fetch(url)
        if (!res.ok) throw new Error("年度の取得に失敗しました")
        const data = await res.json()
        const fetchedYears = (data.years || []).filter(
          (year: unknown): year is number => typeof year === "number" && Number.isFinite(year),
        )
        setYears(fetchedYears)
      } catch (err: any) {
        console.error("年度データ取得エラー:", err)
        setError(err.message)
      } finally {
        setLoadingYears(false)
      }
    }
    fetchYears()
  }, [mode, examType])

  // 公式問題（active）を取得（既存問題モード）
  useEffect(() => {
    const fetchOfficial = async () => {
      if (mode !== "existing") return
      if (!examType || !year || subject === null) {
        setOfficialQuestionId(null)
        setQuestionText("")
        setReferenceText("")
        setGradingImpressionText("")
        return
      }
      setLoadingMetadata(true)
      setError(null)
      try {
        const shiken_type = examType === "司法試験" ? "shihou" : "yobi"
        const res = await fetch(
          `/api/official-questions/active?shiken_type=${encodeURIComponent(shiken_type)}&nendo=${encodeURIComponent(
            year.toString(),
          )}&subject_id=${encodeURIComponent(subject.toString())}`,
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "公式問題の取得に失敗しました" }))
          throw new Error(errorData.error || errorData.detail || `公式問題の取得に失敗しました (HTTP ${res.status})`)
        }
        const data = await res.json()
        setOfficialQuestionId(data.id ?? null)
        setQuestionText(data.text || "")
        setReferenceText(data.syutudaisyusi || "")
        setGradingImpressionText(data.grading_impression_text || "")

        setQuestionTitle("")
      } catch (err: any) {
        setOfficialQuestionId(null)
        setQuestionText("")
        setReferenceText("")
        setGradingImpressionText("")
        setError(err.message)
      } finally {
        setLoadingMetadata(false)
      }
    }
    fetchOfficial()
  }, [mode, examType, year, subject])


  // 講評を生成
  const handleGenerate = async () => {
    if (!answerText.trim()) {
      setError("答案を入力してください")
      return
    }

    // 新規問題モードの場合、問題文が必須
    if (mode === "new" && !questionText.trim()) {
      setError("問題文を入力してください")
      return
    }

    // 既存のリクエストがあれば中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 新しいAbortControllerを作成
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)
    setGenerationPhase("解析中...")

    try {
      const requestBody: ReviewRequest = {
        answer_text: answerText,
      }

      if (mode === "existing") {
        if (!officialQuestionId) {
          throw new Error("公式問題が取得できませんでした。試験種別・年度・科目を確認してください。")
        }
        requestBody.official_question_id = officialQuestionId
      } else {
        // 新規問題の場合のみ、question_titleとreference_textを送信
        if (!questionText.trim()) {
          throw new Error("問題文を入力してください")
        }
        requestBody.question_text = questionText.trim()
        // 科目IDを設定（未選択の場合はNULL）
        if (newSubjectId !== null) {
          requestBody.subject = newSubjectId
        }
        // subject_nameは送信しない（NULLでも処理可能）
        if (questionTitle.trim()) {
          requestBody.question_title = questionTitle.trim()
        }
        if (referenceText.trim()) {
          requestBody.reference_text = referenceText.trim()
        }
      }

      setGenerationPhase("評価中...")

      const data = await apiClient.post<ReviewResponse>("/api/review", requestBody, {
        signal: abortController.signal
      })

      // 中断された場合は処理を停止
      if (abortController.signal.aborted) {
        return
      }

      setGenerationPhase("生成完了")

      // 成功したら結果ページに遷移（review_idベース）
      if (data.review_id) {
        router.push(`/review/${data.review_id}`)
      } else if (data.submission_id) {
        // 後方互換（古いレスポンス用）
        router.push(`/review/${data.submission_id}`)
      } else {
        throw new Error("講評の生成に成功しましたが、review_id/submission_idが取得できませんでした")
      }
    } catch (err: any) {
      // AbortErrorの場合はエラーを表示しない
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        setGenerationPhase("")
        return
      }
      console.error("Review generation error:", err)
      const errorMessage = err?.error || err?.message || "講評の生成に失敗しました"
      setError(errorMessage)
      if (err?.status === 402 || errorMessage.includes("プラン未登録")) {
        setBillingDialogMode("plan")
        setBillingDialogOpen(true)
      } else if (err?.status === 429 && errorMessage.includes("講評の作成回数が上限")) {
        setBillingDialogMode("ticket")
        setBillingDialogOpen(true)
      }
      setGenerationPhase("")
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
        abortControllerRef.current = null
      }
    }
  }

  const startSubscriptionCheckout = async (selectedPlanCode: "basic_plan" | "high_plan" | "first_month_fm_dm") => {
    setCheckoutLoading(
      selectedPlanCode === "basic_plan" ? "basic" : selectedPlanCode === "high_plan" ? "high" : "first_month"
    )
    try {
      const payload = {
        plan_code: selectedPlanCode,
        success_url: `${window.location.origin}/checkout/success?from=review&type=subscription`,
        cancel_url: `${window.location.origin}/checkout/cancel?from=review&type=subscription`,
        via_fm_dm_link: fmDmEligible,
      }
      const res = await apiClient.post<{ checkout_url: string }>("/api/subscriptions/checkout", payload)
      window.location.href = res.checkout_url
    } catch (e: any) {
      setError(e?.error || "プラン購入の開始に失敗しました")
    } finally {
      setCheckoutLoading(null)
    }
  }

  const startTicketCheckout = async () => {
    setCheckoutLoading("ticket")
    try {
      const res = await apiClient.post<{ checkout_url: string }>("/api/review-tickets/checkout", {
        quantity: 1,
        success_url: `${window.location.origin}/checkout/success?from=review&type=ticket`,
        cancel_url: `${window.location.origin}/checkout/cancel?from=review&type=ticket`,
      })
      window.location.href = res.checkout_url
    } catch (e: any) {
      setError(e?.error || "チケット購入の開始に失敗しました")
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setLoading(false)
      setGenerationPhase("")
    }
  }

  // ステップの進行可否チェック
  const canProceedToStep2 = () => {
    // 問題の準備ができているか
    const hasProblem = mode === "existing"
      ? officialQuestionId !== null && questionText !== ""
      : questionText.trim() !== ""
    // 答案が入力されているか（最低100文字推奨）
    const hasAnswer = answerText.trim().length >= 100
    return hasProblem && hasAnswer
  }

  const canGenerate = () => {
    return canProceedToStep2() && !loading
  }

  // 文字数カウントと進捗計算
  const charCount = answerText.length
  const targetChars = 2000
  const progress = Math.min((charCount / targetChars) * 100, 100)

  const getProgressColor = () => {
    if (charCount < 100) return "bg-red-500"
    if (charCount < 500) return "bg-amber-500"
    if (charCount < 1500) return "bg-emerald-500"
    return "bg-sky-500"
  }

  // コピー機能
  const [copied, setCopied] = useState(false)
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-slate-50 transition-all duration-300"
      style={mainContentStyle}
    >
      <header className="shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-2 max-w-7xl px-3 py-2 min-h-11">
          <div className="flex items-center gap-2 shrink-0">
            <SidebarToggle />
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500">
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-slate-800">Juristutor-AI</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink min-w-0">
            {mode === "existing" && (
              <>
                <Select value={examType} onValueChange={(value) => {
                  setExamType(value)
                }}>
                  <SelectTrigger className="h-7 w-20 sm:w-24 min-w-0 border-slate-200 bg-white text-[10px] sm:text-xs shadow-sm px-2 sm:px-3">
                    <SelectValue placeholder="試験種別" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="司法試験" className="text-xs">司法試験</SelectItem>
                    <SelectItem value="予備試験" className="text-xs">予備試験</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={year ? year.toString() : ""} onValueChange={(value) => {
                  setYear(value ? parseInt(value) : null)
                }}>
                  <SelectTrigger className="h-7 w-[4.5rem] sm:w-20 min-w-0 border-slate-200 bg-white text-[10px] sm:text-xs shadow-sm px-2 sm:px-3">
                    <SelectValue placeholder="年度" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()} className="text-xs">
                        {formatYearToShortEra(y)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={subject !== null ? subject.toString() : ""}
                  onValueChange={(value) => {
                    if (value === "") {
                      setSubject(null)
                    } else {
                      const subjectId = parseInt(value, 10)
                      if (!isNaN(subjectId) && subjectId >= 1 && subjectId <= 18) {
                        setSubject(subjectId)
                      } else {
                        console.error("Invalid subject ID:", value)
                        setSubject(null)
                      }
                    }
                    // 科目変更時に公式問題IDをリセット
                    setOfficialQuestionId(null)
                  }}
                >
                  <SelectTrigger className="h-7 w-20 sm:w-24 min-w-0 border-slate-200 bg-white text-[10px] sm:text-xs shadow-sm px-2 sm:px-3">
                    {subject !== null ? (
                      <span>{getSubjectName(subject)}</span>
                    ) : (
                      <SelectValue placeholder="科目" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {FIXED_SUBJECTS.map((subjectName) => {
                      const subjectId = getSubjectId(subjectName)
                      if (subjectId === null) return null
                      return (
                        <SelectItem key={subjectId} value={subjectId.toString()} className="text-xs">
                          {subjectName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </>
            )}

            <button
              onClick={() => {
                try {
                  const newMode = mode === "existing" ? "new" : "existing"
                  // 状態をリセット
                  setQuestionTitle("")
                  setQuestionText("")
                  setReferenceText("")
                  setNewSubjectId(null) // 新規問題モード用の科目IDもリセット
                  setError(null) // エラーもクリア
                  setIsQuestionOpen(false) // Collapsibleもリセット
                  setIsPurposeOpen(false)
                  // 最後にモードを変更
                  setMode(newMode)
                } catch (err: any) {
                  console.error("Mode switch error:", err)
                  setError(err?.message || err?.toString() || "モードの切り替えに失敗しました")
                }
              }}
              className="shrink-0 ml-1 px-2 sm:px-3 py-1.5 text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              {mode === "existing" ? (
                <>
                  <span className="hidden sm:inline">好きな問題を貼りつけレビュー</span>
                  <span className="sm:hidden">新規問題</span>
                </>
              ) : (
                "既存問題"
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col min-h-0 mx-auto w-full max-w-5xl p-3 gap-2 overflow-hidden">

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: 問題準備 + 答案入力 */}
        {step === 1 && (
          <div className="flex flex-1 flex-col min-h-0 gap-2 overflow-hidden">
            {/* 問題選択/入力エリア */}
            <div className="shrink-0 rounded-lg border border-slate-200/80 bg-white shadow-sm flex-shrink-0 overflow-auto">
              {mode === "existing" ? (
                <>
                  {examType && year && subject !== null ? (
                    <>
                      {officialQuestionId && questionText ? (
                        <div className="p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100">
                                <BookOpen className="h-3 w-3 text-indigo-600" />
                              </div>
                              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                                {examType} {formatYearToEra(year || 0)} {subject !== null ? getSubjectName(subject) : ""}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(questionText)}
                              className="h-5 gap-1 px-1.5 text-xs text-slate-400 hover:text-slate-600"
                            >
                              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>

                          <Collapsible open={isQuestionOpen} onOpenChange={setIsQuestionOpen}>
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800">
                              {isQuestionOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <span className="font-medium">問題文</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-1.5">
                              <div className="max-h-[200px] overflow-y-auto rounded bg-slate-50 p-2 font-mono text-xs leading-relaxed text-slate-700">
                                <pre className="whitespace-pre-wrap">{questionText}</pre>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                          {referenceText && (
                            <Collapsible open={isPurposeOpen} onOpenChange={setIsPurposeOpen} className="mt-2">
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800">
                                {isPurposeOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="font-medium">出題趣旨</span>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-1.5">
                                <div className="max-h-[120px] overflow-y-auto rounded bg-amber-50/50 p-2 text-xs leading-relaxed text-slate-700">
                                  {referenceText}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}

                          {gradingImpressionText && (
                            <Collapsible className="mt-2">
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800">
                                <ChevronRight className="h-3 w-3" />
                                <span className="font-medium">採点実感（司法試験）</span>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-1.5">
                                <div className="max-h-[120px] overflow-y-auto rounded bg-slate-50 p-2 text-xs leading-relaxed text-slate-700">
                                  {gradingImpressionText}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      ) : (
                        <>
                          {loadingMetadata ? (
                            <div className="flex items-center justify-center gap-2 p-4">
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              <p className="text-xs text-slate-500">公式問題を取得中...</p>
                            </div>
                          ) : (
                            <div className="flex items-center justify-start gap-2 p-4">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                                <FileText className="h-4 w-4 text-slate-400" />
                              </div>
                              <p className="text-xs text-slate-500">該当する問題が見つかりませんでした</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-start gap-2 p-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                      <p className="text-xs text-slate-500">試験種別・年度・科目を選択してください</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-2.5 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100">
                      <BookOpen className="h-3 w-3 text-indigo-600" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">問題入力</span>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      科目 <span className="text-slate-400">(任意)</span>
                    </label>
                    {(() => {
                      try {
                        if (!FIXED_SUBJECTS || !Array.isArray(FIXED_SUBJECTS)) {
                          console.error("FIXED_SUBJECTS is not available:", FIXED_SUBJECTS)
                          return (
                            <div className="text-xs text-red-500">
                              科目データの読み込みに失敗しました
                            </div>
                          )
                        }
                        return (
                          <Select
                            value={newSubjectId !== null ? String(newSubjectId) : "none"}
                            onValueChange={(value) => {
                              try {
                                if (value === "none") {
                                  setNewSubjectId(null)
                                } else {
                                  const subjectId = parseInt(value, 10)
                                  if (!isNaN(subjectId) && subjectId >= 1 && subjectId <= 18) {
                                    setNewSubjectId(subjectId)
                                  } else {
                                    console.error("Invalid subject ID:", value)
                                    setNewSubjectId(null)
                                  }
                                }
                              } catch (err: any) {
                                console.error("Subject selection error:", err)
                                setError(err?.message || "科目の選択に失敗しました")
                                setNewSubjectId(null)
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="科目を選択（未選択可）" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">未選択</SelectItem>
                              {FIXED_SUBJECTS.map((subjectName) => {
                                const subjectId = getSubjectId(subjectName)
                                if (subjectId === null) return null
                                return (
                                  <SelectItem key={subjectId} value={String(subjectId)}>
                                    {subjectName}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )
                      } catch (err: any) {
                        console.error("Subject select render error:", err)
                        return (
                          <div className="text-xs text-red-500">
                            科目選択の表示に失敗しました: {err?.message || err?.toString() || "不明なエラー"}
                          </div>
                        )
                      }
                    })()}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      問題タイトル <span className="text-slate-400">(任意)</span>
                    </label>
                    <input
                      type="text"
                      value={questionTitle}
                      onChange={(e) => setQuestionTitle(e.target.value)}
                      placeholder="試験種・年・科目を入れてください…"
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      問題文 <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="問題文を入力..."
                      className="h-24 resize-none rounded border-slate-200 bg-slate-50/50 font-mono text-xs leading-relaxed focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      参照文章 <span className="text-slate-400">(任意)</span>
                    </label>
                    <Textarea
                      value={referenceText}
                      onChange={(e) => setReferenceText(e.target.value)}
                      placeholder="講評上参照してほしい解説等があれば入れてください…"
                      className="h-16 resize-none rounded border-slate-200 bg-amber-50/30 text-xs leading-relaxed focus:bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 答案入力エリア（フッター直上まで伸び、枠内はスクロール） */}
            <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              {/* 進捗バー */}
              <div className="h-1 shrink-0 overflow-hidden rounded-t-lg bg-slate-100">
                <div
                  className={cn("h-full transition-all duration-300", getProgressColor())}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* ヘッダー */}
              <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100">
                    <PenLine className="h-3 w-3 text-emerald-600" />
                  </div>
                  <h2 className="text-xs font-semibold text-slate-700">答案</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", charCount < 100 ? "text-red-500" : "text-slate-500")}>
                    {charCount.toLocaleString()}字
                  </span>
                  {charCount < 100 && <span className="text-xs text-red-400">(100字以上)</span>}
                  {answerText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAnswerText("")
                        localStorage.removeItem("review_answer_text")
                      }}
                      className="h-5 gap-1 px-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                      クリア
                    </Button>
                  )}
                </div>
              </div>

              {/* 入力欄（枠の下限＝フッター上まで。残り高さをすべて使う） */}
              <div className="flex flex-1 flex-col min-h-0 p-2">
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="答案を入力してください..."
                  className="min-h-0 flex-1 w-full resize-none rounded border-slate-200 bg-slate-50/50 font-mono text-xs leading-relaxed focus:bg-white overflow-y-auto"
                />
              </div>
            </div>

            {/* 固定フッター（講評開始ボタン） */}
            {step === 1 && (
              <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-2.5 py-2 rounded-b-lg">
                {loading && (
                  <Button
                    size="sm"
                    onClick={handleStop}
                    className="h-7 gap-1 rounded-full px-3 text-xs shadow transition-all bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Square className="h-3 w-3 fill-white" />
                    停止
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!canProceedToStep2() || loading}
                  onClick={handleGenerate}
                  className={cn(
                    "h-7 gap-1 rounded-full px-3 text-xs shadow transition-all",
                    canProceedToStep2() ? "bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600" : "",
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      講評開始
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 生成 */}
        {step === 2 && (
          <div className="flex-1 min-h-0 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: 講評生成</CardTitle>
              <CardDescription>準備ができたら、講評を生成してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 確認表示 */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">問題文</label>
                  <div className="mt-1 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap line-clamp-3">
                    {questionText || "（未入力）"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">答案</label>
                  <div className="mt-1 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap line-clamp-3">
                    {answerText || "（未入力）"}
                  </div>
                </div>
              </div>

              {/* ローディング表示 */}
              {loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="font-medium">{generationPhase || "生成中..."}</span>
                  </div>
                  <Progress value={undefined} className="h-2" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              )}

              {/* 不足項目の表示 */}
              {!canGenerate() && !loading && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>準備が完了していません</AlertTitle>
                  <AlertDescription>
                    問題を選択または入力し、答案を入力してください（推奨: 100文字以上）
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                  戻る
                </Button>
                <div className="flex gap-2">
                  {loading && (
                    <Button
                      onClick={handleStop}
                      className="min-w-[100px] bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Square className="w-4 h-4 mr-2 fill-white" />
                      停止
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerate}
                    disabled={!canGenerate()}
                    className="min-w-[120px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      "講評を生成"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        )}

      </main>

      <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{billingDialogMode === "plan" ? "プラン選択" : "レビュー追加チケット"}</DialogTitle>
            <DialogDescription>
              {billingDialogMode === "plan"
                ? "プラン未登録です。PlanA または PlanC を選択して決済に進んでください。"
                : "レビュー回数の上限に達しました。追加チケットを購入しますか？"}
            </DialogDescription>
          </DialogHeader>

          {billingDialogMode === "plan" ? (
            <div className="space-y-2">
              <Button
                className="w-full justify-between"
                onClick={() => startSubscriptionCheckout("basic_plan")}
                disabled={checkoutLoading !== null}
              >
                <span>PlanA (Basic Plan)</span>
                <span>3,980円 税抜き</span>
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-between"
                onClick={() => startSubscriptionCheckout("high_plan")}
                disabled={checkoutLoading !== null}
              >
                <span>PlanC (High Plan)</span>
                <span>7,200円 税抜き</span>
              </Button>
              {fmDmEligible && (
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => startSubscriptionCheckout("first_month_fm_dm")}
                  disabled={checkoutLoading !== null}
                >
                  <span>PlanB (for 1st Month)</span>
                  <span><span className="line-through mr-1">3,980円</span>1,000円 税抜き</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button onClick={startTicketCheckout} disabled={checkoutLoading !== null} className="w-full">
                追加チケットを購入する（900円 税抜き / +レビュー2回）
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBillingDialogOpen(false)} disabled={checkoutLoading !== null}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
