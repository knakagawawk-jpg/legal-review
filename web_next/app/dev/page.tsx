"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Loader2, Search, Eye, Trash2, Shield, ShieldOff, UserCheck, UserX } from "lucide-react"
import type { ReviewResponse, LlmRequestListResponse, AdminReviewHistoryItem, AdminReviewHistoryListResponse } from "@/types/api"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"
import { getSubjectName } from "@/lib/subjects"
import { withAuth } from "@/components/auth/with-auth"

type DevReviewData = {
  review_id?: number
  answer_text: string
  question_text: string
  purpose: string
  subject: string
  review_markdown: string
  review_json: any
}

function DevPage() {
  const router = useRouter()
  const { isOpen } = useSidebar()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isDevEnv, setIsDevEnv] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDatabaseUrl, setSelectedDatabaseUrl] = useState<string | null>(null)

  useEffect(() => {
    // dev環境かどうかをチェック
    const enableDevPage = process.env.NEXT_PUBLIC_ENABLE_DEV_PAGE === "true"
    setIsDevEnv(enableDevPage)
    
    // 管理者権限をチェック
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/users/me")
        if (res.ok) {
          const user = await res.json()
          setIsAdmin(user.is_admin === true)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error("Admin check error:", error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAdmin()
    
    // dev環境以外の場合はホームにリダイレクト
    if (!enableDevPage) {
      router.replace("/")
    }
  }, [router])

  // 環境チェック中は何も表示しない
  if (isDevEnv === null || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  // dev環境以外の場合は何も表示しない（リダイレクト処理中）
  if (!isDevEnv) {
    return null
  }

  // 管理者でない場合はアクセス拒否
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>アクセス拒否</AlertTitle>
          <AlertDescription>
            このページにアクセスするには管理者権限が必要です。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-b from-background to-muted/20 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
    >
      <div className="container mx-auto px-8 py-12 max-w-7xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <h1 className="text-4xl font-bold mb-2">⚙️ 管理者ページ</h1>
            <p className="text-muted-foreground text-lg">
              ユーザー管理、統計情報、システム監視を行います
            </p>
          </div>
          <DatabaseSelector 
            selectedDatabaseUrl={selectedDatabaseUrl}
            onDatabaseChange={setSelectedDatabaseUrl}
          />
        </div>

        {/* タブ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">📊 ダッシュボード</TabsTrigger>
            <TabsTrigger value="users">👥 ユーザー管理</TabsTrigger>
            <TabsTrigger value="stats">📈 統計情報</TabsTrigger>
            <TabsTrigger value="llm">🧾 LLMログ</TabsTrigger>
            <TabsTrigger value="dev">📋 講評データ</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard databaseUrl={selectedDatabaseUrl || undefined} />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsers databaseUrl={selectedDatabaseUrl || undefined} />
          </TabsContent>

          <TabsContent value="stats">
            <AdminStats databaseUrl={selectedDatabaseUrl || undefined} />
          </TabsContent>

          <TabsContent value="llm">
            <LlmRequestTable databaseUrl={selectedDatabaseUrl || undefined} />
          </TabsContent>

          <TabsContent value="dev">
            <DevTools databaseUrl={selectedDatabaseUrl || undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ReviewResultVerify({ databaseUrl, initialReviewId }: { databaseUrl?: string; initialReviewId?: number | null }) {
  const router = useRouter()
  const [data, setData] = useState<DevReviewData>({
    answer_text: "",
    question_text: "",
    purpose: "",
    subject: "",
    review_markdown: "",
    review_json: {},
    review_id: 99999,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputTab, setInputTab] = useState("answer")
  const [panelRatio, setPanelRatio] = useState(4)

  useEffect(() => {
    if (initialReviewId != null && initialReviewId > 0) {
      setData((prev) => ({ ...prev, review_id: initialReviewId }))
    }
  }, [initialReviewId])

  const handleLoadReview = async () => {
    if (!data.review_id) {
      setError("講評IDを入力してください")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // review_idベースで取得（管理者時は選択中のDBを使用）
      const url = databaseUrl
        ? `/api/reviews/${data.review_id}?database_url=${encodeURIComponent(databaseUrl)}`
        : `/api/reviews/${data.review_id}`
      const res = await fetch(url)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message =
          (typeof errorData.error === "string" ? errorData.error : null) ||
          (typeof errorData.detail === "string" ? errorData.detail : null) ||
          "講評の取得に失敗しました"
        throw new Error(message)
      }
      const reviewData: ReviewResponse = await res.json()
      setData({
        review_id: data.review_id,
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
      review_id: 99999,
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
                  value={data.review_id || ""}
                  onChange={(e) =>
                    setData({ ...data, review_id: parseInt(e.target.value) || undefined })
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
                <label className="text-sm font-medium mb-2 block">表示用Review ID</label>
                <Input
                  type="number"
                  min={1}
                  value={data.review_id || ""}
                  onChange={(e) =>
                    setData({ ...data, review_id: parseInt(e.target.value) || undefined })
                  }
                  placeholder="表示用のReview ID（チャット機能で使用）"
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
                      📝 講評ID: {data.review_id || "未設定"}
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
      {data.review_id && (
        <Card>
          <CardHeader>
            <CardTitle>💬 チャット機能の検証</CardTitle>
            <CardDescription>
              任意の入力でチャット機能を試すことができます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DevChatSection reviewId={data.review_id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DevChatSection({ reviewId }: { reviewId: number }) {
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
          review_id: reviewId,
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

function ReviewHistoryList({
  databaseUrl,
  onSelectReview,
}: {
  databaseUrl?: string
  onSelectReview: (reviewId: number) => void
}) {
  const [data, setData] = useState<AdminReviewHistoryListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const limit = 100

  useEffect(() => {
    loadHistory()
  }, [databaseUrl, offset])

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(limit))
      params.set("offset", String(offset))
      if (databaseUrl) params.append("database_url", databaseUrl)
      const res = await fetch(`/api/admin/review-history?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message =
          (typeof errorData.error === "string" ? errorData.error : null) ||
          (typeof errorData.detail === "string" ? errorData.detail : null) ||
          "講評履歴の取得に失敗しました"
        throw new Error(message)
      }
      const json: AdminReviewHistoryListResponse = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const canPrev = offset > 0
  const canNext = offset + items.length < total

  const formatDate = (s: string) => (s ? s.replace("T", " ").slice(0, 19) : "-")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📋 全ユーザー Review 履歴</CardTitle>
          <CardDescription>
            選択中のDBの講評履歴です。行の「講評結果検証で開く」で講評IDを渡して検証タブを開けます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>エラー</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!loading && data && (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>review_id</TableHead>
                      <TableHead>ユーザー</TableHead>
                      <TableHead>科目</TableHead>
                      <TableHead>試験種別</TableHead>
                      <TableHead>年度</TableHead>
                      <TableHead>作成日時</TableHead>
                      <TableHead className="w-[140px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item: AdminReviewHistoryItem) => (
                      <TableRow key={`${item.user_id}-${item.review_id}-${item.id}`}>
                        <TableCell className="font-mono">{item.review_id}</TableCell>
                        <TableCell className="text-sm">
                          {item.user_email ?? `user_${item.user_id}`}
                        </TableCell>
                        <TableCell>{item.subject_name ?? "-"}</TableCell>
                        <TableCell>{item.exam_type ?? "-"}</TableCell>
                        <TableCell>{item.year ?? "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(item.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectReview(item.review_id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            講評結果検証で開く
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {total > 0 ? `${offset + 1} - ${offset + items.length} / ${total}` : "0件"}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    disabled={!canPrev || loading}
                  >
                    前へ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOffset((o) => o + limit)}
                    disabled={!canNext || loading}
                  >
                    次へ
                  </Button>
                </div>
              </div>
            </>
          )}

          {!loading && data && items.length === 0 && (
            <Alert>
              <AlertDescription>講評履歴がありません。</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DatabaseSelector({ 
  selectedDatabaseUrl, 
  onDatabaseChange 
}: { 
  selectedDatabaseUrl: string | null
  onDatabaseChange: (url: string | null) => void 
}) {
  const [databases, setDatabases] = useState<Array<{ name: string; url: string; description: string }>>([])
  const [currentDatabaseUrl, setCurrentDatabaseUrl] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const res = await fetch("/api/admin/databases")
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.error("Failed to fetch databases:", errorData)
          return
        }
        const data = await res.json()
        console.log("Database info:", data)
        setDatabases(data.available_databases || [])
        setCurrentDatabaseUrl(data.current_database_url || "")
        // 初期値として現在のDBを選択
        if (!selectedDatabaseUrl) {
          onDatabaseChange(data.current_database_url || null)
        }
      } catch (error) {
        console.error("Failed to fetch databases:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchDatabases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (databases.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">🗄️ データベース選択</CardTitle>
          <CardDescription>
            表示するデータベースを選択してください（DEV環境のみ）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>
              データベース一覧の取得に失敗しました。バックエンドのログを確認してください。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // 現在のDBの環境名を取得
  const getCurrentDbName = () => {
    if (!currentDatabaseUrl) return "不明"
    const urlLower = currentDatabaseUrl.toLowerCase()
    if (urlLower.includes("dev.db") || urlLower.includes("/dev")) return "dev"
    if (urlLower.includes("beta.db") || urlLower.includes("/beta")) return "beta"
    if (urlLower.includes("production.db") || urlLower.includes("/production")) return "本番"
    return "不明"
  }

  const currentDbName = getCurrentDbName()
  const getSelectedDbName = (url: string | null) => {
    if (!url) return currentDbName
    const urlLower = url.toLowerCase()
    if (urlLower.includes("dev.db") || urlLower.includes("/dev")) return "dev"
    if (urlLower.includes("beta.db") || urlLower.includes("/beta")) return "beta"
    if (urlLower.includes("production.db") || urlLower.includes("/production")) return "本番"
    return "不明"
  }
  const selectedDbName = getSelectedDbName(selectedDatabaseUrl)

  // URLを正規化して比較する関数
  const normalizeUrl = (url: string) => {
    if (!url) return ""
    // sqlite:///./data/dev.db -> sqlite:////data/dev.db
    return url.replace("sqlite:///./", "sqlite:////")
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">🗄️ データベース選択</CardTitle>
        <CardDescription>
          表示するデータベースを選択してください（DEV環境のみ）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Select
              value={selectedDatabaseUrl || currentDatabaseUrl || ""}
              onValueChange={(value) => {
                // 現在のDBと同じ場合はnullを設定（デフォルトDBを使用）
                const normalizedValue = normalizeUrl(value)
                const normalizedCurrent = normalizeUrl(currentDatabaseUrl)
                if (normalizedValue === normalizedCurrent) {
                  onDatabaseChange(null)
                } else {
                  onDatabaseChange(value)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="データベースを選択" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => {
                  const isCurrent = normalizeUrl(db.url) === normalizeUrl(currentDatabaseUrl)
                  return (
                    <SelectItem key={db.url} value={db.url}>
                      {db.name} {isCurrent && "(現在)"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-sm">
            選択中: {selectedDbName}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function LlmRequestTable({ databaseUrl }: { databaseUrl?: string }) {
  const [filters, setFilters] = useState({
    feature_type: "",
    model: "",
    request_id: "",
    review_id: "",
    thread_id: "",
    session_id: "",
    user_id: "",
    created_from: "",
    created_to: "",
    limit: "50",
  })
  const [query, setQuery] = useState(filters)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<LlmRequestListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      params.set("offset", String(offset))
      if (!params.get("limit")) {
        params.set("limit", "50")
      }
      if (databaseUrl) {
        params.append("database_url", databaseUrl)
      }

      // 管理者用APIを使用
      const res = await fetch(`/api/admin/llm-requests?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || errorData.detail || "LLMログの取得に失敗しました")
      }
      const json: LlmRequestListResponse = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
      console.error("LLMログ取得エラー:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [query, offset, databaseUrl])

  const handleSearch = () => {
    setOffset(0)
    setQuery(filters)
  }

  const handleReset = () => {
    const initial = {
      feature_type: "",
      model: "",
      request_id: "",
      review_id: "",
      thread_id: "",
      session_id: "",
      user_id: "",
      created_from: "",
      created_to: "",
      limit: "50",
    }
    setFilters(initial)
    setQuery(initial)
    setOffset(0)
  }

  const total = data?.total ?? 0
  const items = data?.items ?? []
  const canPrev = offset > 0
  const canNext = offset + items.length < total

  const formatTokens = (input?: number | null, output?: number | null) =>
    `${input ?? "-"} / ${output ?? "-"}`

  const formatCost = (cost?: number | null) => (cost != null ? `${cost.toFixed(2)}円` : "-")
  
  const formatCostUsd = (cost?: number | null) => {
    if (cost == null) return "-"
    return `$${cost.toFixed(4)}`
  }
  
  const formatCostYen = (cost?: number | null) => {
    if (cost == null) return "-"
    return `${cost.toFixed(2)}円`
  }

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
            <CardTitle>🧾 LLMログ一覧（全ユーザー）</CardTitle>
            <CardDescription>全ユーザーのLLM呼び出しログを確認できます</CardDescription>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">種別</label>
              <Select
                value={filters.feature_type || "all"}
                onValueChange={(value) => setFilters({ ...filters, feature_type: value === "all" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="すべて" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="review">review</SelectItem>
                  <SelectItem value="review_chat">review_chat</SelectItem>
                  <SelectItem value="free_chat">free_chat</SelectItem>
                  <SelectItem value="recent_review">recent_review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">モデル</label>
              <Input
                value={filters.model}
                onChange={(e) => setFilters({ ...filters, model: e.target.value })}
                placeholder="claude-haiku..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Request ID</label>
              <Input
                value={filters.request_id}
                onChange={(e) => setFilters({ ...filters, request_id: e.target.value })}
                placeholder="message id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Review ID</label>
              <Input
                type="number"
                value={filters.review_id}
                onChange={(e) => setFilters({ ...filters, review_id: e.target.value })}
                placeholder="review_id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Thread ID</label>
              <Input
                type="number"
                value={filters.thread_id}
                onChange={(e) => setFilters({ ...filters, thread_id: e.target.value })}
                placeholder="thread_id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Session ID</label>
              <Input
                type="number"
                value={filters.session_id}
                onChange={(e) => setFilters({ ...filters, session_id: e.target.value })}
                placeholder="session_id"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">User ID</label>
              <Input
                type="number"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                placeholder="user_id（全ユーザーは空欄）"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">開始日時</label>
              <Input
                type="datetime-local"
                value={filters.created_from}
                onChange={(e) => setFilters({ ...filters, created_from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">終了日時</label>
              <Input
                type="datetime-local"
                value={filters.created_to}
                onChange={(e) => setFilters({ ...filters, created_to: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">件数</label>
              <Select
                value={filters.limit}
                onValueChange={(value) => setFilters({ ...filters, limit: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="50" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "検索"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              リセット
            </Button>
            <Button variant="ghost" onClick={loadData} disabled={loading}>
              再読み込み
            </Button>
            <div className="ml-auto text-sm text-muted-foreground self-center">
              {total.toLocaleString()} 件
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>モデル</TableHead>
                  <TableHead>tokens(in/out)</TableHead>
                  <TableHead>入力コスト（$）</TableHead>
                  <TableHead>出力コスト（$）</TableHead>
                  <TableHead>合計コスト（$）</TableHead>
                  <TableHead>合計コスト（円）</TableHead>
                  <TableHead>request_id</TableHead>
                  <TableHead>review_id</TableHead>
                  <TableHead>thread_id</TableHead>
                  <TableHead>session_id</TableHead>
                  <TableHead>latency_ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={15}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {row.created_at ? new Date(row.created_at).toLocaleString("ja-JP") : "-"}
                      </TableCell>
                      <TableCell>{row.user_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.feature_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.model || "-"}</TableCell>
                      <TableCell>{formatTokens(row.input_tokens, row.output_tokens)}</TableCell>
                      <TableCell>{formatCostUsd(row.input_cost_usd)}</TableCell>
                      <TableCell>{formatCostUsd(row.output_cost_usd)}</TableCell>
                      <TableCell>{formatCostUsd(row.total_cost_usd)}</TableCell>
                      <TableCell>{formatCostYen(row.total_cost_yen)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.request_id || "-"}</TableCell>
                      <TableCell>{row.review_id ?? "-"}</TableCell>
                      <TableCell>{row.thread_id ?? "-"}</TableCell>
                      <TableCell>{row.session_id ?? "-"}</TableCell>
                      <TableCell>{row.latency_ms ?? "-"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {total > 0 && `${offset + 1} - ${offset + items.length} / ${total}`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - Number(query.limit || "50")))}
                disabled={!canPrev || loading}
              >
                前へ
              </Button>
              <Button
                variant="outline"
                onClick={() => setOffset(offset + Number(query.limit || "50"))}
                disabled={!canNext || loading}
              >
                次へ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// 管理者用コンポーネント
// ============================================================================

function AdminDashboard({ databaseUrl }: { databaseUrl?: string }) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [databaseUrl])

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = databaseUrl 
        ? `/api/admin/stats?database_url=${encodeURIComponent(databaseUrl)}`
        : "/api/admin/stats"
      const res = await fetch(url)
      if (!res.ok) throw new Error("統計情報の取得に失敗しました")
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>エラー</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* KPIカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総ユーザー数</CardDescription>
            <CardTitle className="text-3xl">{stats.total_users?.toLocaleString() || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              アクティブ: {stats.active_users || 0} / 管理者: {stats.admin_users || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総トークン数</CardDescription>
            <CardTitle className="text-3xl">{(stats.total_tokens || 0).toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              入力: {(stats.total_input_tokens || 0).toLocaleString()} / 出力: {(stats.total_output_tokens || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>総コスト</CardDescription>
            <CardTitle className="text-3xl">¥{stats.total_cost_yen?.toFixed(2) || "0.00"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              今日: ¥{stats.today_cost_yen?.toFixed(2) || "0.00"} / 今月: ¥{stats.this_month_cost_yen?.toFixed(2) || "0.00"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>アクセス数</CardDescription>
            <CardTitle className="text-3xl">{(stats.review_count || 0) + (stats.thread_count || 0) + (stats.short_answer_session_count || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              講評: {stats.review_count || 0} / チャット: {stats.thread_count || 0} / 短答: {stats.short_answer_session_count || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 機能別統計 */}
      <Card>
        <CardHeader>
          <CardTitle>機能別統計</CardTitle>
          <CardDescription>機能ごとの使用量とコスト</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.feature_stats && Object.entries(stats.feature_stats).map(([feature, data]: [string, any]) => (
              <div key={feature} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary">{feature}</Badge>
                  <span className="text-sm font-semibold">¥{data.total_cost_yen?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">リクエスト数:</span> {data.request_count?.toLocaleString() || 0}
                  </div>
                  <div>
                    <span className="text-muted-foreground">トークン数:</span> {(data.total_tokens || 0).toLocaleString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">平均レイテンシ:</span> {data.avg_latency_ms ? `${data.avg_latency_ms.toFixed(0)}ms` : "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminUsers({ databaseUrl }: { databaseUrl?: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | null>(null)
  const [skip, setSkip] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 50

  useEffect(() => {
    loadUsers()
  }, [skip, search, isActiveFilter, databaseUrl])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append("skip", String(skip))
      params.append("limit", String(limit))
      if (search) params.append("search", search)
      if (isActiveFilter !== null) params.append("is_active", String(isActiveFilter))

      // データベースURLが指定されている場合は追加
      if (databaseUrl) {
        params.append("database_url", databaseUrl)
      }
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) throw new Error("ユーザー一覧の取得に失敗しました")
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setSkip(0)
    loadUsers()
  }

  const handleUpdateUser = async (userId: number, updates: { is_active?: boolean; is_admin?: boolean }) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "ユーザー情報の更新に失敗しました")
      }
      // 更新後、一覧を再読み込み
      await loadUsers()
    } catch (err: any) {
      alert(err.message || "エラーが発生しました")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>全{total}件のユーザー</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 検索・フィルタ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="メールアドレス・名前で検索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select
              value={isActiveFilter === null ? "all" : String(isActiveFilter)}
              onValueChange={(value) => setIsActiveFilter(value === "all" ? null : value === "true")}
            >
              <SelectTrigger>
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="true">アクティブのみ</SelectItem>
                <SelectItem value="false">非アクティブのみ</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "検索"}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ユーザーテーブル */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>作成日</TableHead>
                  <TableHead>最終ログイン</TableHead>
                  <TableHead>講評数</TableHead>
                  <TableHead>トークン数</TableHead>
                  <TableHead>コスト</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      ユーザーが見つかりませんでした
                    </TableCell>
                  </TableRow>
                )}
                {!loading && users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {user.is_active ? (
                          <Badge variant="default">アクティブ</Badge>
                        ) : (
                          <Badge variant="secondary">非アクティブ</Badge>
                        )}
                        {user.is_admin && <Badge variant="outline">管理者</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("ja-JP") : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString("ja-JP") : "-"}
                    </TableCell>
                    <TableCell>{user.review_count || 0}</TableCell>
                    <TableCell>{(user.total_tokens || 0).toLocaleString()}</TableCell>
                    <TableCell>¥{(user.total_cost_yen || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.is_admin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`${user.email}の管理者権限を剥奪しますか？`)) {
                                handleUpdateUser(user.id, { is_admin: false })
                              }
                            }}
                            title="管理者権限を剥奪"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`${user.email}に管理者権限を付与しますか？`)) {
                                handleUpdateUser(user.id, { is_admin: true })
                              }
                            }}
                            title="管理者権限を付与"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        {user.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`${user.email}を無効化しますか？`)) {
                                handleUpdateUser(user.id, { is_active: false })
                              }
                            }}
                            title="ユーザーを無効化"
                          >
                            <UserX className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`${user.email}を有効化しますか？`)) {
                                handleUpdateUser(user.id, { is_active: true })
                              }
                            }}
                            title="ユーザーを有効化"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ページネーション */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {total > 0 && `${skip + 1} - ${Math.min(skip + limit, total)} / ${total}`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSkip(Math.max(0, skip - limit))}
                disabled={skip === 0 || loading}
              >
                前へ
              </Button>
              <Button
                variant="outline"
                onClick={() => setSkip(skip + limit)}
                disabled={skip + limit >= total || loading}
              >
                次へ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminStats({ databaseUrl }: { databaseUrl?: string }) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStats()
  }, [databaseUrl])

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = databaseUrl 
        ? `/api/admin/stats?database_url=${encodeURIComponent(databaseUrl)}`
        : "/api/admin/stats"
      const res = await fetch(url)
      if (!res.ok) throw new Error("統計情報の取得に失敗しました")
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message || "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>エラー</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>詳細統計情報</CardTitle>
          <CardDescription>システム全体の統計データ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ユーザー統計 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">ユーザー統計</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">総ユーザー数</div>
                <div className="text-2xl font-bold">{stats.total_users?.toLocaleString() || 0}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">アクティブユーザー</div>
                <div className="text-2xl font-bold">{stats.active_users?.toLocaleString() || 0}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">管理者ユーザー</div>
                <div className="text-2xl font-bold">{stats.admin_users?.toLocaleString() || 0}</div>
              </div>
            </div>
          </div>

          {/* トークン・コスト統計 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">トークン・コスト統計</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">総トークン数</div>
                <div className="text-2xl font-bold">{(stats.total_tokens || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  入力: {(stats.total_input_tokens || 0).toLocaleString()} / 出力: {(stats.total_output_tokens || 0).toLocaleString()}
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">総コスト</div>
                <div className="text-2xl font-bold">¥{stats.total_cost_yen?.toFixed(2) || "0.00"}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  今日: ¥{stats.today_cost_yen?.toFixed(2) || "0.00"} / 今月: ¥{stats.this_month_cost_yen?.toFixed(2) || "0.00"}
                </div>
              </div>
            </div>
          </div>

          {/* アクセス統計 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">アクセス統計</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">講評生成数</div>
                <div className="text-2xl font-bold">{(stats.review_count || 0).toLocaleString()}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">チャットセッション数</div>
                <div className="text-2xl font-bold">{(stats.thread_count || 0).toLocaleString()}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">短答式セッション数</div>
                <div className="text-2xl font-bold">{(stats.short_answer_session_count || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* 機能別統計 */}
          {stats.feature_stats && Object.keys(stats.feature_stats).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">機能別統計</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>機能</TableHead>
                      <TableHead>リクエスト数</TableHead>
                      <TableHead>総トークン数</TableHead>
                      <TableHead>入力トークン</TableHead>
                      <TableHead>出力トークン</TableHead>
                      <TableHead>総コスト</TableHead>
                      <TableHead>平均レイテンシ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(stats.feature_stats).map(([feature, data]: [string, any]) => (
                      <TableRow key={feature}>
                        <TableCell>
                          <Badge variant="secondary">{feature}</Badge>
                        </TableCell>
                        <TableCell>{(data.request_count || 0).toLocaleString()}</TableCell>
                        <TableCell>{(data.total_tokens || 0).toLocaleString()}</TableCell>
                        <TableCell>{(data.total_input_tokens || 0).toLocaleString()}</TableCell>
                        <TableCell>{(data.total_output_tokens || 0).toLocaleString()}</TableCell>
                        <TableCell>¥{(data.total_cost_yen || 0).toFixed(2)}</TableCell>
                        <TableCell>{data.avg_latency_ms ? `${data.avg_latency_ms.toFixed(0)}ms` : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DevTools({ databaseUrl }: { databaseUrl?: string }) {
  const [activeSubTab, setActiveSubTab] = useState("verify")
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null)

  const handleSelectReview = (reviewId: number) => {
    setSelectedReviewId(reviewId)
    setActiveSubTab("verify")
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="verify">📊 講評結果検証</TabsTrigger>
          <TabsTrigger value="list">📋 全ユーザーReview履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="verify">
          <ReviewResultVerify databaseUrl={databaseUrl} initialReviewId={selectedReviewId} />
        </TabsContent>

        <TabsContent value="list">
          <ReviewHistoryList databaseUrl={databaseUrl} onSelectReview={handleSelectReview} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default withAuth(DevPage, { requireAuth: true })
