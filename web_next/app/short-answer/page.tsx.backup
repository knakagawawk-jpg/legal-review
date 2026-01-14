"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, AlertCircle, Loader2 } from "lucide-react"
import type { ShortAnswerProblem, ShortAnswerSession } from "@/types/api"
import { formatYearToEra } from "@/lib/utils"

type ProblemState = {
  problems: ShortAnswerProblem[]
  currentIndex: number
  answers: Record<number, string>
  showAnswer: boolean
  sessionId: number | null
}

export default function ShortAnswerPage() {
  const router = useRouter()
  const [examType, setExamType] = useState<string>("")
  const [year, setYear] = useState<string>("")
  const [subject, setSubject] = useState<string>("")
  const [isRandom, setIsRandom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 問題選択状態
  const [problemState, setProblemState] = useState<ProblemState | null>(null)

  // 利用可能な年度と科目（簡易実装、必要に応じてAPI追加）
  const availableYears = ["R7", "R6", "R5", "H30", "H29"] // 実際はAPIから取得
  const availableSubjects: string[] = [] // 実際はAPIから取得

  const handleStartSession = async () => {
    if (isRandom) {
      if (!subject) {
        setError("ランダム選択を使用する場合は科目を選択してください")
        return
      }
    } else {
      if (!examType || !year || !subject) {
        setError("試験種別、年度、科目をすべて選択してください")
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      // 問題を取得
      const params = new URLSearchParams()
      if (!isRandom) {
        if (examType) params.append("exam_type", examType)
        if (year) params.append("year", year)
      }
      if (subject) params.append("subject", subject)

      const problemsRes = await fetch(`/api/short-answer/problems?${params.toString()}`)
      if (!problemsRes.ok) throw new Error("問題の取得に失敗しました")
      const problemsData = await problemsRes.json()
      const problems = problemsData.problems || []

      if (problems.length === 0) {
        setError("問題が見つかりませんでした")
        return
      }

      // ランダムモードの場合はランダムに問題を選択
      let selectedProblems = problems
      if (isRandom && problems.length > 5) {
        // 最大5問までランダムに選択
        const shuffled = [...problems].sort(() => Math.random() - 0.5)
        selectedProblems = shuffled.slice(0, 5)
      }

      // セッションを作成
      const sessionRes = await fetch("/api/short-answer/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: isRandom ? "" : examType,
          year: isRandom ? null : year,
          subject: subject,
          is_random: isRandom,
          problem_ids: selectedProblems.map((p: ShortAnswerProblem) => p.id),
        }),
      })

      if (!sessionRes.ok) throw new Error("セッションの作成に失敗しました")
      const session: ShortAnswerSession = await sessionRes.json()

      setProblemState({
        problems: selectedProblems,
        currentIndex: 0,
        answers: {},
        showAnswer: false,
        sessionId: session.id,
      })
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAnswer = (problemId: number, answer: string) => {
    if (!problemState) return
    setProblemState({
      ...problemState,
      answers: { ...problemState.answers, [problemId]: answer },
    })
  }

  const handleShowAnswer = async () => {
    if (!problemState) return

    const currentProblem = problemState.problems[problemState.currentIndex]
    const selectedAnswer = problemState.answers[currentProblem.id] || ""

    // 回答を送信
    if (problemState.sessionId) {
      try {
        await fetch("/api/short-answer/answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: problemState.sessionId,
            problem_id: currentProblem.id,
            selected_answer: selectedAnswer,
          }),
        })
      } catch (err) {
        console.error("回答の送信に失敗:", err)
      }
    }

    setProblemState({ ...problemState, showAnswer: true })
  }

  const handleNavigate = (direction: "prev" | "next") => {
    if (!problemState) return
    const newIndex =
      direction === "prev"
        ? problemState.currentIndex - 1
        : problemState.currentIndex + 1

    if (newIndex >= 0 && newIndex < problemState.problems.length) {
      setProblemState({
        ...problemState,
        currentIndex: newIndex,
        showAnswer: false,
      })
    }
  }

  const handleBackToSelection = () => {
    setProblemState(null)
    setError(null)
  }

  if (problemState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-8 py-12 max-w-5xl">
          <ProblemDisplay
            problemState={problemState}
            onSelectAnswer={handleSelectAnswer}
            onShowAnswer={handleShowAnswer}
            onNavigate={handleNavigate}
            onBackToSelection={handleBackToSelection}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-8 py-12 max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">📝 短答式試験</h1>
          <p className="text-muted-foreground text-lg">
            短答式問題を解いて正誤を確認します
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 問題選択 */}
        <Card>
          <CardHeader>
            <CardTitle>問題を選択</CardTitle>
            <CardDescription>試験種別、年度、科目を選択して問題を開始してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* フィルター */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">試験種別</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  disabled={isRandom}
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
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={isRandom}
                >
                  <option value="">すべて</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">科目</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">すべて</option>
                  {availableSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ランダム選択オプション */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="random"
                checked={isRandom}
                onChange={(e) => setIsRandom(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="random" className="text-sm">
                科目のみ選択して全試験・年度からランダムに問題を選ぶ
              </label>
            </div>

            {/* 開始ボタン */}
            <div className="flex justify-end">
              <Button onClick={handleStartSession} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  "問題を開始"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ProblemDisplay({
  problemState,
  onSelectAnswer,
  onShowAnswer,
  onNavigate,
  onBackToSelection,
}: {
  problemState: ProblemState
  onSelectAnswer: (problemId: number, answer: string) => void
  onShowAnswer: () => void
  onNavigate: (direction: "prev" | "next") => void
  onBackToSelection: () => void
}) {
  const currentProblem = problemState.problems[problemState.currentIndex]
  const totalProblems = problemState.problems.length
  const progress = ((problemState.currentIndex + 1) / totalProblems) * 100
  const selectedAnswer = problemState.answers[currentProblem.id] || ""
  const isCorrect = selectedAnswer === currentProblem.correct_answer

  const choices = [
    currentProblem.choice_1,
    currentProblem.choice_2,
    currentProblem.choice_3,
    currentProblem.choice_4,
  ].filter((c): c is string => c !== null && c !== undefined)

  if (problemState.showAnswer) {
    return (
      <div className="space-y-6">
        {/* ヘッダー */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {currentProblem.exam_type} {currentProblem.year} 第{currentProblem.question_number}問
                </h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {problemState.currentIndex + 1}/{totalProblems}
                </div>
                <div className="text-sm text-muted-foreground">進捗</div>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* 正誤表示 */}
        <Card className={isCorrect ? "border-green-500" : "border-red-500"}>
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">{isCorrect ? "✅" : "❌"}</div>
            <h3 className="text-2xl font-bold mb-2">
              {isCorrect ? "正解" : "不正解"}
            </h3>
          </CardContent>
        </Card>

        {/* 選択肢と正誤マーク */}
        <Card>
          <CardHeader>
            <CardTitle>選択肢</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {choices.map((choice, idx) => {
              const choiceNum = String(idx + 1)
              const isSelected = selectedAnswer === choiceNum
              const isCorrectChoice = currentProblem.correct_answer.split(",").includes(choiceNum)
              const mark = currentProblem.correctness_pattern[idx] || ""

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    isSelected && isCorrectChoice
                      ? "bg-green-100 border-green-500"
                      : isSelected
                      ? "bg-red-100 border-red-500"
                      : isCorrectChoice
                      ? "bg-green-50 border-green-300"
                      : "bg-muted"
                  }`}
                >
                  <div className="font-semibold">
                    {mark} {idx + 1}. {choice}
                  </div>
                  {isSelected && (
                    <div className="text-sm text-muted-foreground mt-1">
                      ← あなたの選択
                    </div>
                  )}
                  {!isSelected && isCorrectChoice && (
                    <div className="text-sm text-muted-foreground mt-1">
                      ← 正解
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* ナビゲーション */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => onNavigate("prev")}
            disabled={problemState.currentIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <Button variant="outline" onClick={onBackToSelection}>
            問題一覧に戻る
          </Button>
          <Button
            onClick={() => onNavigate("next")}
            disabled={problemState.currentIndex === totalProblems - 1}
          >
            次へ
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {currentProblem.exam_type} {currentProblem.year} 第{currentProblem.question_number}問
              </h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {problemState.currentIndex + 1}/{totalProblems}
              </div>
              <div className="text-sm text-muted-foreground">進捗</div>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* 問題文 */}
      <Card>
        <CardHeader>
          <CardTitle>📄 問題文</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-lg">
            {currentProblem.question_text}
          </div>
        </CardContent>
      </Card>

      {/* 選択肢 */}
      <Card>
        <CardHeader>
          <CardTitle>🔘 選択肢</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {choices.map((choice, idx) => {
            const choiceNum = String(idx + 1)
            const isSelected = selectedAnswer === choiceNum

            return (
              <Button
                key={idx}
                variant={isSelected ? "default" : "outline"}
                className="w-full justify-start h-auto py-4 text-left"
                onClick={() => onSelectAnswer(currentProblem.id, choiceNum)}
              >
                <span className="font-semibold mr-2">{idx + 1}.</span>
                <span>{choice}</span>
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {/* 回答を見るボタン */}
      <div className="flex justify-center">
        <Button onClick={onShowAnswer} size="lg" disabled={!selectedAnswer}>
          回答を見る
        </Button>
      </div>
    </div>
  )
}
