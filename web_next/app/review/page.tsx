"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, AlertCircle, Loader2, Copy, Check } from "lucide-react"
import type { ReviewRequest, ProblemMetadata, ProblemMetadataWithDetails } from "@/types/api"
import { formatYearToEra } from "@/lib/utils"
import { sortSubjectsByFixedOrder } from "@/lib/subjects"

type Step = 1 | 2
type Mode = "existing" | "new"

export default function ReviewPage() {
  const router = useRouter()
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
        const fetchedSubjects = data.subjects || []
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
        const fetchedYears = data.years || []
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

  // コピー機能
  const [copied, setCopied] = useState(false)
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* 固定ヘッダーバー */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-8 py-4 max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Juristutor-AI</h1>
              <p className="text-muted-foreground text-sm">
                過去問の答案をAIで講評します
              </p>
            </div>
            {mode === "existing" && (
              <div className="flex gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">試験種別</label>
                  <select
                    className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={examType}
                    onChange={(e) => {
                      setExamType(e.target.value)
                      setSelectedMetadata(null)
                      setSelectedDetails(null)
                    }}
                  >
                    <option value="">未選択</option>
                    <option value="司法試験">司法試験</option>
                    <option value="予備試験">予備試験</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">年度</label>
                  <select
                    className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={year || ""}
                    onChange={(e) => {
                      setYear(e.target.value ? parseInt(e.target.value) : null)
                      setSelectedMetadata(null)
                      setSelectedDetails(null)
                    }}
                  >
                    <option value="">未選択</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {formatYearToEra(y)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">科目</label>
                  <select
                    className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      setSelectedMetadata(null)
                      setSelectedDetails(null)
                    }}
                  >
                    <option value="">未選択</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 pt-32 pb-24 max-w-5xl">

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
          <Card>
            <CardHeader>
              <CardTitle>Step 1: 問題準備と答案入力</CardTitle>
              <CardDescription>既存の問題を選択するか、新規に入力してください。答案も入力できます。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* モード切替 */}
              <div className="flex gap-2">
                <Button
                  variant={mode === "existing" ? "default" : "outline"}
                  onClick={() => {
                    setMode("existing")
                    setSelectedMetadata(null)
                    setSelectedDetails(null)
                    setQuestionText("")
                  }}
                  className="flex-1"
                >
                  既存問題を選択
                </Button>
                <Button
                  variant={mode === "new" ? "default" : "outline"}
                  onClick={() => {
                    setMode("new")
                    setSelectedMetadata(null)
                    setSelectedDetails(null)
                    setQuestionText("")
                    setPurposeText("")
                  }}
                  className="flex-1"
                >
                  新規入力
                </Button>
              </div>

              {mode === "existing" ? (
                <div className="space-y-4">
                  {/* 選択された問題の表示（3つすべて選択されていて問題が1件の場合） */}
                  {examType && year && subject && selectedDetails && questionText && metadataList.length === 1 && (
                    <Card className="border-primary">
                      <CardContent className="pt-6">
                        <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue}>
                          <AccordionItem value="question">
                            <div className="flex items-center justify-between pr-4">
                              <div className="flex items-center gap-2">
                                <AccordionTrigger className="text-base font-semibold">
                                  {selectedMetadata?.exam_type} {formatYearToEra(selectedMetadata?.year || 0)} {selectedMetadata?.subject}
                                </AccordionTrigger>
                                <span className="text-xs text-muted-foreground">
                                  {accordionValue === "question" ? "非表示にする" : "問題文を表示する"}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(questionText)
                                }}
                              >
                                {copied ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                            <AccordionContent>
                              <div className="rounded-md border bg-muted/50 p-4 whitespace-pre-wrap text-sm max-h-[360px] overflow-y-auto">
                                {questionText}
                              </div>
                              {purposeText && (
                                <Accordion type="single" collapsible className="mt-4">
                                  <AccordionItem value="purpose">
                                    <AccordionTrigger>出題趣旨</AccordionTrigger>
                                    <AccordionContent className="whitespace-pre-wrap text-sm">
                                      {purposeText}
                                    </AccordionContent>
                                  </AccordionItem>
                                </Accordion>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">問題文</label>
                    <Textarea
                      placeholder="問題文を入力してください"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      className="min-h-[200px]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">出題趣旨（任意）</label>
                    <Textarea
                      placeholder="出題趣旨を入力してください（任意）"
                      value={purposeText}
                      onChange={(e) => setPurposeText(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* 答案入力欄 */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">答案</label>
                  <span className="text-sm text-muted-foreground">
                    {answerText.length} 文字
                  </span>
                </div>
                <Textarea
                  placeholder="答案を入力してください"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  className="h-[360px] font-mono text-sm resize-none overflow-y-auto"
                />
              </div>
            </CardContent>
          </Card>
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

        {/* 固定フッターバー（講評開始ボタン） */}
        {step === 1 && (
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t shadow-lg">
            <div className="container mx-auto px-8 py-4 max-w-5xl">
              <div className="flex justify-end">
                <Button
                  onClick={handleGenerate}
                  disabled={!canProceedToStep2() || loading}
                  className="min-w-[120px]"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    "講評開始"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
