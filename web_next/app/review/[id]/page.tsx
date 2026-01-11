"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react"
import type { ReviewResponse } from "@/types/api"

export default function ReviewResultPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params.id as string

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-8 py-12 max-w-5xl">
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-8 py-12 max-w-5xl">
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
  const overallReview = reviewJson.overall_review || {}
  const score = overallReview.score
  const strengths = reviewJson.strengths || []
  const weaknesses = reviewJson.weaknesses || []
  const importantPoints = reviewJson.important_points || []
  const futureConsiderations = reviewJson.future_considerations || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-8 py-12 max-w-5xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/review")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <h1 className="text-4xl font-bold mb-2">講評結果</h1>
          <p className="text-muted-foreground">
            Submission ID: {review.submission_id}
          </p>
        </div>

        {/* 総評 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>総評</CardTitle>
              {score !== undefined && (
                <Badge
                  variant={score >= 70 ? "default" : score >= 50 ? "secondary" : "destructive"}
                  className="text-lg px-4 py-1"
                >
                  {score}点
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {overallReview.comment ? (
              <div className="whitespace-pre-wrap text-sm">
                {overallReview.comment}
              </div>
            ) : (
              <p className="text-muted-foreground">コメントがありません</p>
            )}
          </CardContent>
        </Card>

        {/* 問題文と答案 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {review.question_text && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">問題文</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">
                  {review.question_text}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">あなたの答案</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm font-mono">
                {review.answer_text}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 長所 */}
        {strengths.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                長所
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {strengths.map((strength, idx) => (
                  <div key={idx} className="border-l-4 border-green-500 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{strength.category}</Badge>
                      {strength.paragraph_numbers && strength.paragraph_numbers.length > 0 && (
                        <Badge variant="secondary">
                          段落: {strength.paragraph_numbers.join(", ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{strength.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 改善点 */}
        {weaknesses.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                改善点
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weaknesses.map((weakness, idx) => (
                  <div key={idx} className="border-l-4 border-destructive pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{weakness.category}</Badge>
                      {weakness.paragraph_numbers && weakness.paragraph_numbers.length > 0 && (
                        <Badge variant="secondary">
                          段落: {weakness.paragraph_numbers.join(", ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mb-2">{weakness.description}</p>
                    {weakness.suggestion && (
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          改善提案:
                        </p>
                        <p className="text-sm">{weakness.suggestion}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 重要なポイント */}
        {importantPoints.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>重要なポイント</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {importantPoints.map((point, idx) => (
                  <AccordionItem key={idx} value={`point-${idx}`}>
                    <AccordionTrigger>
                      段落 {point.paragraph_number}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          十分に書けている点:
                        </p>
                        <p className="text-sm">{point.what_is_good}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          不足している点:
                        </p>
                        <p className="text-sm">{point.what_is_lacking}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          重要性:
                        </p>
                        <p className="text-sm">{point.why_important}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* 今後の考慮事項 */}
        {futureConsiderations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>今後の考慮事項</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {futureConsiderations.map((consideration, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-sm">{consideration}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 詳細な講評（Markdown） */}
        <Card>
          <CardHeader>
            <CardTitle>詳細な講評</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm">
              {review.review_markdown}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
