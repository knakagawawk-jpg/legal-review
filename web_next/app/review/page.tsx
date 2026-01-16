"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, AlertCircle, Loader2, Copy, Check, ChevronDown, ChevronRight, BookOpen, PenLine, Sparkles, Scale, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewRequest, ProblemMetadata, ProblemMetadataWithDetails } from "@/types/api"
import { formatYearToEra, formatYearToShortEra } from "@/lib/utils"
import { sortSubjectsByFixedOrder } from "@/lib/subjects"
import { SidebarToggle, useSidebar } from "@/components/sidebar"

type Step = 1 | 2
type Mode = "existing" | "new"

export default function ReviewPage() {
  const router = useRouter()
  const { isOpen } = useSidebar()
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<Mode>("existing")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationPhase, setGenerationPhase] = useState<string>("")

  // Step 1: 問題選択 + 答案入力
  const [examType, setExamType] = useState<string>("")
  const [year, setYear] = useState<number | null>(null)
  const [subject, setSubject] = useState<string>("")
  const [selectedMetadata, setSelectedMetadata] = useState<ProblemMetadata | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProblemMetadataWithDetails | null>(null)
  const [questionText, setQuestionText] = useState<string>("")
  const [purposeText, setPurposeText] = useState<string>("")
  const [answerText, setAnswerText] = useState<string>("")

  // データ取得
  const [subjects, setSubjects] = useState<string[]>([])
  const [years, setYears] = useState<number[]>([])
  const [metadataList, setMetadataList] = useState<ProblemMetadata[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string>("")
  const [isQuestionOpen, setIsQuestionOpen] = useState(false)
  const [isPurposeOpen, setIsPurposeOpen] = useState(false)

  // localStorageから答案を復元
  useEffect(() => {
    const saved = localStorage.getItem("review_answer_text")
    if (saved) {
      setAnswerText(saved)
    }
  }, [])

  // 答案をlocalStorageに保存
  useEffect(() => {
    if (answerText) {
      localStorage.setItem("review_answer_text", answerText)
    }
  }, [answerText])

  // 科目一覧を取得
  useEffect(() => {
    const fetchSubjects = async () => {
      setLoadingSubjects(true)
      try {
        const res = await fetch("/api/problems/subjects")
        if (!res.ok) throw new Error("科目の取得に失敗しました")
        const data = await res.json()
        const fetchedSubjects = (data.subjects || []).filter(
          (subject: unknown): subject is string => typeof subject === "string" && subject.trim() !== "",
        )
        // 固定順序で並べ替え
        const sortedSubjects = sortSubjectsByFixedOrder(fetchedSubjects)
        setSubjects(sortedSubjects)
        // デバッグ: 取得した科目をログに出力
        console.log("科目データ取得:", { fetched: fetchedSubjects, sorted: sortedSubjects })
      } catch (err: any) {
        console.error("科目データ取得エラー:", err)
        setError(err.message)
      } finally {
        setLoadingSubjects(false)
      }
    }
    fetchSubjects()
  }, [])

  // 年度一覧を取得
  useEffect(() => {
    const fetchYears = async () => {
      setLoadingYears(true)
      try {
        const res = await fetch("/api/problems/years")
        if (!res.ok) throw new Error("年度の取得に失敗しました")
        const data = await res.json()
        const fetchedYears = (data.years || []).filter(
          (year: unknown): year is number => typeof year === "number" && Number.isFinite(year),
        )
        setYears(fetchedYears)
        // デバッグ: 取得した年度をログに出力
        console.log("年度データ取得:", { years: fetchedYears, count: fetchedYears.length })
      } catch (err: any) {
        console.error("年度データ取得エラー:", err)
        setError(err.message)
      } finally {
        setLoadingYears(false)
      }
    }
    fetchYears()
  }, [])

  // 問題メタデータを取得
  useEffect(() => {
    if (mode === "existing" && (examType || year || subject)) {
      const fetchMetadata = async () => {
        setLoadingMetadata(true)
        try {
          const params = new URLSearchParams()
          if (examType) params.append("exam_type", examType)
          if (year) params.append("year", year.toString())
          if (subject) params.append("subject", subject)

          const res = await fetch(`/api/problems/metadata?${params.toString()}`)
          if (!res.ok) throw new Error("問題データの取得に失敗しました")
          const data = await res.json()
          const metadataList = data.metadata_list || []
          setMetadataList(metadataList)

          // 3つすべて選択されていて、問題が1件のみの場合は自動的に取得
          if (examType && year && subject && metadataList.length === 1) {
            const metadata = metadataList[0]
            setSelectedMetadata(metadata)
            try {
              const detailRes = await fetch(`/api/problems/metadata/${metadata.id}`)
              if (!detailRes.ok) throw new Error("問題詳細の取得に失敗しました")
              const detailData: ProblemMetadataWithDetails = await detailRes.json()
              setSelectedDetails(detailData)
              setAccordionValue("") // 問題が選択されたときはAccordionを閉じた状態にする
              setIsQuestionOpen(false) // Collapsibleも閉じた状態にする
              setIsPurposeOpen(false)
              // 最初の設問を選択
              if (detailData.details && detailData.details.length > 0) {
                setQuestionText(detailData.details[0].question_text)
                setPurposeText(detailData.details[0].purpose || "")
              }
            } catch (err: any) {
              setError(err.message)
            }
          } else if (!(examType && year && subject)) {
            // 3つすべて選択されていない場合は選択状態をクリア
            setSelectedMetadata(null)
            setSelectedDetails(null)
            setQuestionText("")
            setPurposeText("")
          }
        } catch (err: any) {
          setError(err.message)
        } finally {
          setLoadingMetadata(false)
        }
      }
      fetchMetadata()
    }
  }, [mode, examType, year, subject])

  // 問題詳細を取得
  const handleSelectMetadata = async (metadata: ProblemMetadata) => {
    setSelectedMetadata(metadata)
    setLoadingMetadata(true)
    try {
      const res = await fetch(`/api/problems/metadata/${metadata.id}`)
      if (!res.ok) throw new Error("問題詳細の取得に失敗しました")
      const data: ProblemMetadataWithDetails = await res.json()
      setSelectedDetails(data)
      // 最初の設問を選択
      if (data.details && data.details.length > 0) {
        setQuestionText(data.details[0].question_text)
        setPurposeText(data.details[0].purpose || "")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingMetadata(false)
    }
  }

  // 講評を生成
  const handleGenerate = async () => {
    if (!answerText.trim()) {
      setError("答案を入力してください")
      return
    }

    setLoading(true)
    setError(null)
    setGenerationPhase("解析中...")

    try {
      const requestBody: ReviewRequest = {
        answer_text: answerText,
        subject: selectedMetadata?.subject || subject || "未指定",
      }

      if (mode === "existing" && selectedDetails) {
        if (selectedDetails.details && selectedDetails.details.length > 0) {
          requestBody.problem_details_id = selectedDetails.details[0].id
          requestBody.problem_metadata_id = selectedMetadata?.id
        }
      } else {
        requestBody.question_text = questionText || undefined
      }

      setGenerationPhase("評価中...")

      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "講評の生成に失敗しました")
      }

      setGenerationPhase("生成完了")

      const data = await res.json()
      
      // 成功したら結果ページに遷移
      router.push(`/review/${data.submission_id}`)
    } catch (err: any) {
      setError(err.message)
      setGenerationPhase("")
    } finally {
      setLoading(false)
    }
  }

  // ステップの進行可否チェック
  const canProceedToStep2 = () => {
    // 問題の準備ができているか
    const hasProblem = mode === "existing"
      ? selectedDetails !== null && questionText !== ""
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
    <div className={cn("flex min-h-screen flex-col bg-slate-50 transition-all duration-300", isOpen && "ml-52")}>
      <header className="shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between px-3">
          <div className="flex items-center gap-2 ml-2">
            <SidebarToggle />
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500">
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-slate-800">Juristutor-AI</h1>
          </div>

          <div className="flex items-center gap-2">
            {mode === "existing" && (
              <>
                <Select value={examType} onValueChange={(value) => {
                  setExamType(value)
                  setSelectedMetadata(null)
                  setSelectedDetails(null)
                }}>
                  <SelectTrigger className="h-7 w-24 border-slate-200 bg-white text-xs shadow-sm">
                    <SelectValue placeholder="試験種別" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="司法試験" className="text-xs">司法試験</SelectItem>
                    <SelectItem value="予備試験" className="text-xs">予備試験</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={year ? year.toString() : ""} onValueChange={(value) => {
                  setYear(value ? parseInt(value) : null)
                  setSelectedMetadata(null)
                  setSelectedDetails(null)
                }}>
                  <SelectTrigger className="h-7 w-20 border-slate-200 bg-white text-xs shadow-sm">
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
                <Select value={subject} onValueChange={(value) => {
                  setSubject(value)
                  setSelectedMetadata(null)
                  setSelectedDetails(null)
                }}>
                  <SelectTrigger className="h-7 w-24 border-slate-200 bg-white text-xs shadow-sm">
                    <SelectValue placeholder="科目" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <button
              onClick={() => {
                const newMode = mode === "existing" ? "new" : "existing"
                setMode(newMode)
                setSelectedMetadata(null)
                setSelectedDetails(null)
                setQuestionText("")
                if (newMode === "new") {
                  setPurposeText("")
                }
              }}
              className="ml-1 px-3 py-1.5 text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              {mode === "existing" ? "好きな問題を貼りつけレビュー" : "既存問題"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col mx-auto w-full max-w-5xl p-3 gap-2" style={{ height: 'calc(100vh - 2.75rem)' }}>

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
          <>
            {/* 問題選択/入力エリア */}
            <div className="shrink-0 rounded-lg border border-slate-200/80 bg-white shadow-sm flex-shrink-0">
              {mode === "existing" ? (
                <>
                  {examType && year && subject && selectedDetails && questionText ? (
                    <div className="p-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100">
                            <BookOpen className="h-3 w-3 text-indigo-600" />
                          </div>
                          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                            {selectedMetadata?.exam_type} {formatYearToEra(selectedMetadata?.year || 0)} {selectedMetadata?.subject}
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

                      {purposeText && (
                        <Collapsible open={isPurposeOpen} onOpenChange={setIsPurposeOpen} className="mt-2">
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800">
                            {isPurposeOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="font-medium">出題趣旨</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1.5">
                            <div className="max-h-[120px] overflow-y-auto rounded bg-amber-50/50 p-2 text-xs leading-relaxed text-slate-700">
                              {purposeText}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
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
                      出題趣旨 <span className="text-slate-400">(任意)</span>
                    </label>
                    <Textarea
                      value={purposeText}
                      onChange={(e) => setPurposeText(e.target.value)}
                      placeholder="出題趣旨を入力..."
                      className="h-16 resize-none rounded border-slate-200 bg-amber-50/30 text-xs leading-relaxed focus:bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 答案入力エリア */}
            <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-slate-200/80 bg-white shadow-sm">
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

              {/* 入力欄 */}
              <div className="flex-1 min-h-0 p-2 overflow-hidden">
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="答案を入力してください..."
                  className="h-full w-full resize-none rounded border-slate-200 bg-slate-50/50 font-mono text-xs leading-relaxed focus:bg-white"
                />
              </div>

              {/* フッター（講評開始ボタン） */}
              <div className="shrink-0 flex items-center justify-end border-t border-slate-100 px-2.5 py-1.5">
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
            </div>
          </>
        )}

        {/* Step 2: 生成 */}
        {step === 2 && (
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
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  )
}
