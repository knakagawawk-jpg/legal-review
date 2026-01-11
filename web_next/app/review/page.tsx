"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, AlertCircle, Loader2, Copy, Check } from "lucide-react"
import type { ReviewRequest, ProblemMetadata, ProblemMetadataWithDetails } from "@/types/api"
import { formatYearToEra } from "@/lib/utils"
import { sortSubjectsByFixedOrder } from "@/lib/subjects"

type Step = 1 | 2 | 3
type Mode = "existing" | "new"

export default function ReviewPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<Mode>("existing")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationPhase, setGenerationPhase] = useState<string>("")

  // Step 1: 問題選択
  const [examType, setExamType] = useState<string>("")
  const [year, setYear] = useState<number | null>(null)
  const [subject, setSubject] = useState<string>("")
  const [selectedMetadata, setSelectedMetadata] = useState<ProblemMetadata | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<ProblemMetadataWithDetails | null>(null)
  const [questionText, setQuestionText] = useState<string>("")
  const [purposeText, setPurposeText] = useState<string>("")

  // Step 2: 答案入力
  const [answerText, setAnswerText] = useState<string>("")

  // データ取得
  const [subjects, setSubjects] = useState<string[]>([])
  const [years, setYears] = useState<number[]>([])
  const [metadataList, setMetadataList] = useState<ProblemMetadata[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [loadingYears, setLoadingYears] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)

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
          setMetadataList(data.metadata_list || [])
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
    if (mode === "existing") {
      return selectedDetails !== null && questionText !== ""
    } else {
      return questionText.trim() !== ""
    }
  }

  const canProceedToStep3 = () => {
    return answerText.trim().length >= 100 // 最低100文字
  }

  const canGenerate = () => {
    return canProceedToStep2() && canProceedToStep3() && !loading
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
      <div className="container mx-auto px-8 py-12 max-w-5xl">
        {/* ヘッダー */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2">📝 答案講評生成</h1>
          <p className="text-muted-foreground text-lg">
            法律試験の答案をAIで講評します
          </p>
        </div>

        {/* ステップインジケーター */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step > s
                          ? "bg-green-500 text-white"
                          : step === s
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                    </div>
                    <span className="mt-2 text-sm font-medium">
                      {s === 1 ? "問題準備" : s === 2 ? "答案入力" : "生成"}
                    </span>
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step > s ? "bg-green-500" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <Progress value={(step / 3) * 100} className="h-2" />
          </CardContent>
        </Card>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: 問題準備 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: 問題準備</CardTitle>
              <CardDescription>既存の問題を選択するか、新規に入力してください</CardDescription>
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
                  {/* フィルター */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">試験種別</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={examType}
                        onChange={(e) => {
                          setExamType(e.target.value)
                          setSelectedMetadata(null)
                          setSelectedDetails(null)
                        }}
                      >
                        <option value="">すべて</option>
                        <option value="司法試験">司法試験</option>
                        <option value="予備試験">予備試験</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">年度</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={year || ""}
                        onChange={(e) => {
                          setYear(e.target.value ? parseInt(e.target.value) : null)
                          setSelectedMetadata(null)
                          setSelectedDetails(null)
                        }}
                      >
                        <option value="">すべて</option>
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {formatYearToEra(y)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">科目</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value)
                          setSelectedMetadata(null)
                          setSelectedDetails(null)
                        }}
                      >
                        <option value="">すべて</option>
                        {subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 選択済みバッジ */}
                  {(examType || year || subject) && (
                    <div className="flex flex-wrap gap-2">
                      {examType && (
                        <Badge variant="secondary">
                          試験種別: {examType}
                        </Badge>
                      )}
                      {year && (
                        <Badge variant="secondary">年度: {formatYearToEra(year)}</Badge>
                      )}
                      {subject && (
                        <Badge variant="secondary">科目: {subject}</Badge>
                      )}
                    </div>
                  )}

                  {/* 問題リスト */}
                  {loadingMetadata ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : metadataList.length > 0 ? (
                    <div className="space-y-2">
                      {metadataList.map((meta) => (
                        <Card
                          key={meta.id}
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedMetadata?.id === meta.id ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => handleSelectMetadata(meta)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold">
                                  {meta.exam_type} {formatYearToEra(meta.year)} {meta.subject}
                                </div>
                              </div>
                              {selectedMetadata?.id === meta.id && (
                                <CheckCircle2 className="w-5 h-5 text-primary" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (examType || year || subject) ? (
                    <p className="text-muted-foreground text-center py-4">
                      該当する問題が見つかりませんでした
                    </p>
                  ) : null}

                  {/* 選択された問題の表示 */}
                  {selectedDetails && questionText && (
                    <Card className="border-primary">
                      <CardHeader>
                        <CardTitle className="text-lg">選択された問題</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">問題文</label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(questionText)}
                            >
                              {copied ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <div className="rounded-md border bg-muted/50 p-4 whitespace-pre-wrap text-sm">
                            {questionText}
                          </div>
                        </div>
                        {purposeText && (
                          <Accordion type="single" collapsible>
                            <AccordionItem value="purpose">
                              <AccordionTrigger>出題趣旨</AccordionTrigger>
                              <AccordionContent className="whitespace-pre-wrap text-sm">
                                {purposeText}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
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

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2()}
                >
                  次へ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: 答案入力 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: 答案入力</CardTitle>
              <CardDescription>あなたの答案を入力してください</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">答案</label>
                  <span className="text-sm text-muted-foreground">
                    {answerText.length} 文字
                    {answerText.length < 100 && (
                      <span className="text-destructive ml-2">
                        （推奨: 100文字以上）
                      </span>
                    )}
                  </span>
                </div>
                <Textarea
                  placeholder="答案を入力してください"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  戻る
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3()}
                >
                  次へ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: 生成 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: 講評生成</CardTitle>
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
                    {!canProceedToStep2() && "問題を選択または入力してください"}
                    {canProceedToStep2() && !canProceedToStep3() && "答案を入力してください（推奨: 100文字以上）"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)} disabled={loading}>
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
      </div>
    </div>
  )
}
