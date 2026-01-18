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
import type { ReviewRequest, ReviewResponse, ProblemMetadata, ProblemMetadataWithDetails } from "@/types/api"
import { formatYearToEra, formatYearToShortEra } from "@/lib/utils"
import { getSubjectName, FIXED_SUBJECTS } from "@/lib/subjects"
import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { apiClient } from "@/lib/api-client"

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
  const [subject, setSubject] = useState<number | null>(null)  // 既存問題選択用（科目ID）
  const [newSubjectId, setNewSubjectId] = useState<number | null>(null)  // 新規問題用の科目ID
  const [selectedMetadata, setSelectedMetadata] = useState<ProblemMetadata | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProblemMetadataWithDetails | null>(null)
  const [questionTitle, setQuestionTitle] = useState<string>("")
  const [questionText, setQuestionText] = useState<string>("")
  const [referenceText, setReferenceText] = useState<string>("")
  const [answerText, setAnswerText] = useState<string>("")

  // データ取得
  const [years, setYears] = useState<number[]>([])
  const [metadataList, setMetadataList] = useState<ProblemMetadata[]>([])
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
    if (mode === "existing" && (examType || year || subject !== null)) {
      const fetchMetadata = async () => {
        setLoadingMetadata(true)
        setError(null)
        try {
          const params = new URLSearchParams()
          if (examType) params.append("exam_type", examType)
          if (year) params.append("year", year.toString())
          if (subject !== null) {
            // 科目IDをそのまま使用
            params.append("subject", subject.toString())
          }

          const res = await fetch(`/api/problems/metadata?${params.toString()}`)
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "問題データの取得に失敗しました" }))
            throw new Error(errorData.error || errorData.detail || `問題データの取得に失敗しました (HTTP ${res.status})`)
          }
          const data = await res.json()
          const metadataList = data.metadata_list || []
          setMetadataList(metadataList)

          // 3つすべて選択されていて、問題が1件のみの場合は自動的に取得
          if (examType && year && subject !== null && metadataList.length === 1) {
            const metadata = metadataList[0]
            setSelectedMetadata(metadata)
            try {
              const detailRes = await fetch(`/api/problems/metadata/${metadata.id}`)
              if (!detailRes.ok) {
                const errorData = await detailRes.json().catch(() => ({ error: "問題詳細の取得に失敗しました" }))
                throw new Error(errorData.error || errorData.detail || `問題詳細の取得に失敗しました (HTTP ${detailRes.status})`)
              }
              const detailData: ProblemMetadataWithDetails = await detailRes.json()
              setSelectedDetails(detailData)
              setAccordionValue("") // 問題が選択されたときはAccordionを閉じた状態にする
              setIsQuestionOpen(false) // Collapsibleも閉じた状態にする
              setIsPurposeOpen(false)
              // 最初の設問を選択
              if (detailData.details && detailData.details.length > 0) {
                setQuestionText(detailData.details[0].question_text)
                setReferenceText(detailData.details[0].purpose || "")
              }
            } catch (err: any) {
              setError(err.message)
            }
          } else if (!(examType && year && subject !== null)) {
            // 3つすべて選択されていない場合は選択状態をクリア
            setSelectedMetadata(null)
            setSelectedDetails(null)
            setQuestionTitle("")
            setQuestionText("")
            setReferenceText("")
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
    setError(null)
    try {
      const res = await fetch(`/api/problems/metadata/${metadata.id}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "問題詳細の取得に失敗しました" }))
        throw new Error(errorData.error || errorData.detail || `問題詳細の取得に失敗しました (HTTP ${res.status})`)
      }
      const data: ProblemMetadataWithDetails = await res.json()
      setSelectedDetails(data)
      // 最初の設問を選択
      if (data.details && data.details.length > 0) {
        setQuestionText(data.details[0].question_text)
        setReferenceText(data.details[0].purpose || "")
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

    // 新規問題モードの場合、問題文が必須
    if (mode === "new" && !questionText.trim()) {
      setError("問題文を入力してください")
      return
    }

    setLoading(true)
    setError(null)
    setGenerationPhase("解析中...")

    try {
      const requestBody: ReviewRequest = {
        answer_text: answerText,
      }

      if (mode === "existing" && selectedDetails) {
        if (selectedDetails.details && selectedDetails.details.length > 0) {
          requestBody.problem_details_id = selectedDetails.details[0].id
          requestBody.problem_metadata_id = selectedMetadata?.id
        } else {
          throw new Error("問題詳細が取得できませんでした。問題を再度選択してください。")
        }
        // 既存問題の場合はsubject_idはmetadataから取得されるため不要
        // question_titleとreference_textも送信しない
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

      const data = await apiClient.post<ReviewResponse>("/api/review", requestBody)

      setGenerationPhase("生成完了")

      // 成功したら結果ページに遷移
      if (data.submission_id) {
        router.push(`/review/${data.submission_id}`)
      } else {
        throw new Error("講評の生成に成功しましたが、submission_idが取得できませんでした")
      }
    } catch (err: any) {
      console.error("Review generation error:", err)
      const errorMessage = err?.error || err?.message || "講評の生成に失敗しました"
      setError(errorMessage)
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
    <div
      className="flex min-h-screen flex-col bg-slate-50 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
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
                    setSelectedMetadata(null)
                    setSelectedDetails(null)
                  }}
                >
                  <SelectTrigger className="h-7 w-24 border-slate-200 bg-white text-xs shadow-sm">
                    {subject !== null ? (
                      <span>{getSubjectName(subject)}</span>
                    ) : (
                      <SelectValue placeholder="科目" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {FIXED_SUBJECTS.map((subjectName, index) => {
                      const subjectId = index + 1
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
                  setSelectedMetadata(null)
                  setSelectedDetails(null)
                  setQuestionTitle("")
                  setQuestionText("")
                  setReferenceText("")
                  setNewSubjectId(null) // 新規問題モード用の科目IDもリセット
                  setError(null) // エラーもクリア
                  setAccordionValue("") // Accordionもリセット
                  setIsQuestionOpen(false) // Collapsibleもリセット
                  setIsPurposeOpen(false)
                  // 最後にモードを変更
                  setMode(newMode)
                } catch (err: any) {
                  console.error("Mode switch error:", err)
                  setError(err?.message || err?.toString() || "モードの切り替えに失敗しました")
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
                  {examType && year && subject !== null ? (
                    <>
                      {selectedDetails && questionText ? (
                        <div className="p-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100">
                                <BookOpen className="h-3 w-3 text-indigo-600" />
                              </div>
                              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                                {selectedMetadata?.exam_type} {formatYearToEra(selectedMetadata?.year || 0)} {selectedMetadata?.subject_name || (selectedMetadata?.subject ? getSubjectName(selectedMetadata.subject) : "")}
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
                        </div>
                      ) : (
                        <>
                          {loadingMetadata ? (
                            <div className="flex items-center justify-center gap-2 p-4">
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              <p className="text-xs text-slate-500">問題データを取得中...</p>
                            </div>
                          ) : metadataList.length > 0 ? (
                            <div className="p-2.5">
                              <div className="mb-2 text-xs font-medium text-slate-700">
                                問題を選択してください ({metadataList.length}件)
                              </div>
                              <Accordion type="single" value={accordionValue} onValueChange={setAccordionValue} className="w-full">
                                {metadataList.map((metadata) => (
                                  <AccordionItem key={metadata.id} value={`metadata-${metadata.id}`}>
                                    <AccordionTrigger
                                      className="text-xs py-2 hover:no-underline"
                                      onClick={() => handleSelectMetadata(metadata)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                                          {metadata.exam_type} {formatYearToEra(metadata.year)} {metadata.subject_name || (metadata.subject ? getSubjectName(metadata.subject) : "")}
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-0 pb-2">
                                      <div className="text-xs text-slate-500">
                                        問題ID: {metadata.id}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                ))}
                              </Accordion>
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
                              {FIXED_SUBJECTS.map((subjectName, index) => (
                                <SelectItem key={index + 1} value={String(index + 1)}>
                                  {subjectName}
                                </SelectItem>
                              ))}
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
