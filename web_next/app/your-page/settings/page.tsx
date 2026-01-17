"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, AlertCircle, Loader2, User, Settings, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"

function SettingsPage() {
  const { isOpen } = useSidebar()
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // フォーム状態
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isActive, setIsActive] = useState(true)

  // ユーザー情報を取得
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!authLoading && user) {
        setLoading(true)
        try {
          const data = await apiClient.get<{
            id: number
            email: string
            name: string
            is_active: boolean
          }>("/api/users/me")
          
          setName(data.name || "")
          setEmail(data.email || "")
          setIsActive(data.is_active ?? true)
        } catch (err: any) {
          setError(err.error || "ユーザー情報の取得に失敗しました")
        } finally {
          setLoading(false)
        }
      }
    }
    fetchUserInfo()
  }, [authLoading, user])

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      await apiClient.put("/api/users/me", {
        name: name.trim(),
        email: email.trim(),
      })

      // ユーザー情報を再取得
      await refreshUser()

      setSuccess("プロフィールを更新しました")
      
      // 成功メッセージを3秒後に消す
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err: any) {
      setError(err.error || "プロフィールの更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // フォームの変更を検知
  const hasChanges = name !== (user?.name || "") || email !== (user?.email || "")

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
        </div>
      </header>

      <main className="flex flex-col mx-auto w-full max-w-4xl p-6 gap-6">
        {/* ページタイトル */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <Settings className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">設定</h2>
            <p className="text-sm text-slate-500">アカウント情報とプロフィールを管理します</p>
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

        {/* 成功表示 */}
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-emerald-800">成功</AlertTitle>
            <AlertDescription className="text-emerald-700">{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* プロフィール設定 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-600" />
                  <CardTitle>プロフィール</CardTitle>
                </div>
                <CardDescription>
                  あなたの基本情報を編集できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="名前を入力"
                    required
                    className="max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="メールアドレスを入力"
                    required
                    className="max-w-md"
                  />
                  <p className="text-xs text-slate-500">
                    Googleアカウントでログインしている場合、メールアドレスは変更できません
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isActive">アカウント状態</Label>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium",
                      isActive 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-slate-100 text-slate-600"
                    )}>
                      {isActive ? "有効" : "無効"}
                    </div>
                    <p className="text-xs text-slate-500">
                      {isActive ? "アカウントは有効です" : "アカウントは無効化されています"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* アクション */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={!hasChanges || saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "変更を保存"
                )}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export default withAuth(SettingsPage, { requireAuth: true })
