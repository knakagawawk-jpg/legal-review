"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Loader2, Search, Eye, Trash2 } from "lucide-react"
import type { ReviewResponse, SubmissionHistory } from "@/types/api"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { getSubjectName } from "@/lib/subjects"

type DevReviewData = {
  submission_id?: number
  answer_text: string
  question_text: string
  purpose: string
  subject: string
  review_markdown: string
  review_json: any
}

export default function DevPage() {
  const router = useRouter()
  const { isOpen } = useSidebar()
  const [activeTab, setActiveTab] = useState("verify")

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      <div className="container mx-auto px-8 py-12 max-w-7xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">🔧 開発用ページ</h1>
          <p className="text-muted-foreground text-lg">
            各種ページの検証とデバッグを行います
          </p>
        </div>

        {/* タブ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="verify">📊 講評結果検証</TabsTrigger>
            <TabsTrigger value="list">📋 過去の講評一覧</TabsTrigger>
          </TabsList>

          <TabsContent value="verify">
            <ReviewResultVerify />
          </TabsContent>

          <TabsContent value="list">
            <SubmissionList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ReviewResultVerify() {
  const router = useRouter()
  const [data, setData] = useState<DevReviewData>({
    answer_text: "",
    question_text: "",
    purpose: "",
    subject: "",
    review_markdown: "",
    review_json: {},
    submission_id: 99999,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputTab, setInputTab] = useState("answer")
  const [panelRatio, setPanelRatio] = useState(4)

  const handleLoadReview = async () => {
    if (!data.submission_id) {
      setError("講評IDを入力してください")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/review/${data.submission_id}`)
      if (!res.ok) throw new Error("講評の取得に失敗しました")

      const reviewData: ReviewResponse = await res.json()
      setData({
        submission_id: data.submission_id,
        answer_text: reviewData.answer_text || "",
        question_text: reviewData.question_text || "",
        purpose: reviewData.purpose || "",
        // 設計思想: subject（数値）を優先し、表示時に文字列に変換
        // subject_nameは後方互換性のためのフォールバック
        subject: reviewData.subject != null 
          ? getSubjectName(reviewData.subject) 
          : (reviewData.subject_name || ""),
        review_markdown: reviewData.review_markdown || "",
        review_json: reviewData.review_json || {},
      })
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setData({
      answer_text: "",
      question_text: "",
      purpose: "",
      subject: "",
      review_markdown: "",
      review_json: {},
      submission_id: 99999,
    })
    setError(null)
  }

  const leftRatio = panelRatio
  const rightRatio = 10 - panelRatio

  return (
    <div className="space-y-6">
      {/* 入力データセクション */}
      <Card>
        <CardHeader>
          <CardTitle>📝 入力データ</CardTitle>
          <CardDescription>
            既存の講評IDを読み込むか、任意のデータを入力してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 講評ID読み込み */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">講評ID（既存の講評を表示する場合）</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={data.submission_id || ""}
                  onChange={(e) =>
                    setData({ ...data, submission_id: parseInt(e.target.value) || undefined })
                  }
                  placeholder="講評ID"
                />
                <Button onClick={handleLoadReview} disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "既存講評を読み込む"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleClear} className="w-full">
                データをクリア
              </Button>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* データ入力タブ */}
          <Tabs value={inputTab} onValueChange={setInputTab}>
            <TabsList>
              <TabsTrigger value="answer">📝 答案</TabsTrigger>
              <TabsTrigger value="question">📄 問題文</TabsTrigger>
              <TabsTrigger value="review">📊 講評結果</TabsTrigger>
              <TabsTrigger value="other">ℹ️ その他</TabsTrigger>
            </TabsList>

            <TabsContent value="answer" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">答案テキスト</label>
                <Textarea
                  value={data.answer_text}
                  onChange={(e) => setData({ ...data, answer_text: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="任意の答案テキストを入力できます"
                />
              </div>
            </TabsContent>

            <TabsContent value="question" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">問題文</label>
                <Textarea
                  value={data.question_text}
                  onChange={(e) => setData({ ...data, question_text: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="任意の問題文を入力できます"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">出題趣旨</label>
                <Textarea
                  value={data.purpose}
                  onChange={(e) => setData({ ...data, purpose: e.target.value })}
                  className="min-h-[150px] font-mono text-sm"
                  placeholder="任意の出題趣旨を入力できます"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">科目</label>
                <Input
                  value={data.subject}
                  onChange={(e) => setData({ ...data, subject: e.target.value })}
                  placeholder="任意の科目を入力できます"
                />
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">講評結果（Markdown形式）</label>
                <Textarea
                  value={data.review_markdown}
                  onChange={(e) => setData({ ...data, review_markdown: e.target.value })}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="任意の講評結果（Markdown形式）を入力できます"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">講評結果（JSON形式）</label>
                <Textarea
                  value={JSON.stringify(data.review_json, null, 2)}
                  onChange={(e) => {
                    try {
                      setData({ ...data, review_json: JSON.parse(e.target.value) })
                    } catch {
                      // JSON解析エラーは無視
                    }
                  }}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="任意の講評結果（JSON形式）を入力できます"
                />
              </div>
            </TabsContent>

            <TabsContent value="other" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">表示用Submission ID</label>
                <Input
                  type="number"
                  min={1}
                  value={data.submission_id || ""}
                  onChange={(e) =>
                    setData({ ...data, submission_id: parseInt(e.target.value) || undefined })
                  }
                  placeholder="表示用のSubmission ID（チャット機能で使用）"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* パネル表示割合調整 */}
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-md mx-auto">
            <label className="text-sm font-medium mb-2 block text-center">
              左右パネルの表示割合: {panelRatio} / {10 - panelRatio}
            </label>
            <input
              type="range"
              min={1}
              max={9}
              value={panelRatio}
              onChange={(e) => setPanelRatio(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* 講評結果表示 */}
      <div className="grid gap-6" style={{ gridTemplateColumns: `${leftRatio}fr ${rightRatio}fr` }}>
        {/* 左パネル: 答案と問題文 */}
        <div className="space-y-4">
          <Tabs defaultValue="answer" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="answer">📝 答案</TabsTrigger>
              <TabsTrigger value="question">📄 問題文</TabsTrigger>
            </TabsList>

            <TabsContent value="answer">
              <Card>
                <CardHeader>
                  <CardTitle>📝 提出答案</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg min-h-[600px]">
                    {data.answer_text || "（答案がありません）"}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="question">
              <Card>
                <CardHeader>
                  <CardTitle>📄 問題文</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg min-h-[400px]">
                    {data.question_text || "（問題文がありません）"}
                  </div>
                  {data.purpose && (
                    <div>
                      <h4 className="font-semibold mb-2">🎯 出題趣旨</h4>
                      <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg min-h-[200px]">
                        {data.purpose}
                      </div>
                    </div>
                  )}
                  {data.subject && (
                    <Alert>
                      <AlertDescription>
                        <strong>科目:</strong> {data.subject}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右パネル: 講評、問題文、詳細情報 */}
        <div className="space-y-4">
          <Tabs defaultValue="review" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="review">📊 講評</TabsTrigger>
              <TabsTrigger value="question">📄 問題文</TabsTrigger>
            </TabsList>

            <TabsContent value="review">
              <Card>
                <CardHeader>
                  <CardTitle>📊 講評結果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.review_markdown ? (
                    <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: data.review_markdown
                            .replace(/\n/g, "<br />")
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\*(.*?)\*/g, "<em>$1</em>"),
                        }}
                      />
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        講評結果がありません。上記のタブから入力してください。
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <AlertDescription>
                      📝 提出ID: {data.submission_id || "未設定"}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="question">
              <Card>
                <CardHeader>
                  <CardTitle>📄 問題文</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.question_text ? (
                    <>
                      <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg min-h-[400px]">
                        {data.question_text}
                      </div>
                      {data.purpose && (
                        <div>
                          <h4 className="font-semibold mb-2">🎯 出題趣旨</h4>
                          <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg min-h-[200px]">
                            {data.purpose}
                          </div>
                        </div>
                      )}
                      {data.subject && (
                        <Alert>
                          <AlertDescription>
                            <strong>科目:</strong> {data.subject}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        問題文がありません。上記のタブから入力してください。
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 詳細情報（JSON） */}
          {Object.keys(data.review_json).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📋 詳細情報（JSON）</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(data.review_json, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* チャット機能の検証 */}
      {data.submission_id && (
        <Card>
          <CardHeader>
            <CardTitle>💬 チャット機能の検証</CardTitle>
            <CardDescription>
              任意の入力でチャット機能を試すことができます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DevChatSection submissionId={data.submission_id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DevChatSection({ submissionId }: { submissionId: number }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    []
  )
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput("")
    setLoading(true)
    setError(null)

    const newMessages = [...messages, { role: "user" as const, content: userMessage }]
    setMessages(newMessages)

    try {
      const apiChatHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const res = await fetch("/api/review/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          question: userMessage,
          chat_history: apiChatHistory.length > 0 ? apiChatHistory : undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "チャットの送信に失敗しました")
      }

      const data = await res.json()
      setMessages([...newMessages, { role: "assistant", content: data.answer }])
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
      setMessages([...newMessages, { role: "assistant", content: `エラー: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* チャット履歴 */}
      {messages.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-muted/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 入力欄 */}
      <div className="flex gap-2">
        <Input
          placeholder="質問を入力してください（例: この答案の改善点をもっと詳しく教えてください）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={!input.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "送信"}
        </Button>
        {messages.length > 0 && (
          <Button variant="outline" onClick={handleClear}>
            履歴クリア
          </Button>
        )}
      </div>
    </div>
  )
}

function SubmissionList() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadSubmissions()
  }, [])

  const loadSubmissions = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/dev/submissions?limit=100")
      if (!res.ok) throw new Error("投稿一覧の取得に失敗しました")

      const data = await res.json()
      setSubmissions(data || [])
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const filteredSubmissions = submissions.filter(
    (sub) => !searchTerm || sub.subject.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleView = (submissionId: number) => {
    router.push(`/review/${submissionId}`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📋 過去の講評一覧（最新100件）</CardTitle>
          <CardDescription>開発用：全投稿一覧を取得（認証不要）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 検索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="検索（科目で検索）"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* エラー表示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ローディング */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {/* 投稿一覧 */}
          {!loading && filteredSubmissions.length === 0 && (
            <Alert>
              <AlertDescription>
                {searchTerm ? `「${searchTerm}」に一致する講評が見つかりませんでした。` : "講評がありません。"}
              </AlertDescription>
            </Alert>
          )}

          {!loading && filteredSubmissions.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                全{filteredSubmissions.length}件の講評
                {searchTerm && `（検索結果: ${filteredSubmissions.length}件）`}
              </div>
              {filteredSubmissions.slice(0, 50).map((sub) => (
                <Card key={sub.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {sub.review ? (
                            <Badge variant="default">✅</Badge>
                          ) : (
                            <Badge variant="secondary">⚠️</Badge>
                          )}
                          <span className="font-semibold">ID: {sub.id}</span>
                          <Badge variant="outline">{sub.subject}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {sub.created_at.substring(0, 10)}
                          </span>
                        </div>
                        {sub.question_text && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {sub.question_text.length > 100
                              ? `${sub.question_text.substring(0, 100)}...`
                              : sub.question_text}
                          </p>
                        )}
                      </div>
                      <Button onClick={() => handleView(sub.id)} variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        表示
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredSubmissions.length > 50 && (
                <Alert>
                  <AlertDescription>
                    他にも {filteredSubmissions.length - 50} 件の講評があります。検索で絞り込んでください。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
