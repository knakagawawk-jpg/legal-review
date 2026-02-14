"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { JuristutorLoading } from "@/components/loading"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CheckCircle2, AlertCircle, Loader2, User, Settings, Scale, Cookie, Info, ExternalLink, ChevronDown } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { useAuth } from "@/contexts/auth-context"
import { withAuth } from "@/components/auth/with-auth"
import { apiClient } from "@/lib/api-client"
import { getConsent, saveConsent, revokeConsent, hasRequiredConsent, hasFunctionalConsent, hasPrivacyConsent } from "@/lib/cookie-consent"

function SettingsPage() {
  const { mainContentStyle } = useSidebar()
  const { user, isLoading: authLoading, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // フォーム状態
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [isActive, setIsActive] = useState(true)

  // Cookie同意状態
  const [cookieRequired, setCookieRequired] = useState(true)
  const [cookieFunctional, setCookieFunctional] = useState(false)
  const [cookiePrivacy, setCookiePrivacy] = useState(false)
  const [cookieConsentLoaded, setCookieConsentLoaded] = useState(false)
  const [showExternalDetails, setShowExternalDetails] = useState(false) // 外部送信先の詳細表示
  const [planCode, setPlanCode] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<null | "basic" | "high" | "ticket">(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [fmDmEligible, setFmDmEligible] = useState(false)

  const FM_DM_LINK = "https://juristutor-ai.com/signup/fm-dm-first-month"

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

  useEffect(() => {
    const url = new URL(window.location.href)
    const via = url.searchParams.get("via")
    const fromFmDmPath = window.location.pathname === "/signup/fm-dm-first-month"
    const eligible = via === "fm-dm" || fromFmDmPath
    setFmDmEligible(eligible)
    if (eligible) {
      localStorage.setItem("fm_dm_eligible", "1")
    } else if (localStorage.getItem("fm_dm_eligible") === "1") {
      setFmDmEligible(true)
    }
  }, [])

  useEffect(() => {
    const loadPlan = async () => {
      if (!authLoading && user) {
        setPlanLoading(true)
        try {
          const data = await apiClient.get<{ plan_code: string | null }>("/api/users/me/plan-limits")
          setPlanCode(data.plan_code ?? null)
        } catch {
          setPlanCode(null)
        } finally {
          setPlanLoading(false)
        }
      }
    }
    loadPlan()
  }, [authLoading, user])

  // Cookie同意状態を取得
  useEffect(() => {
    const consent = getConsent()
    if (consent) {
      setCookieRequired(consent.required)
      setCookieFunctional(consent.functional)
      setCookiePrivacy(consent.privacy || false)
    } else {
      // 同意がない場合はデフォルト値
      setCookieRequired(true)
      setCookieFunctional(false)
      setCookiePrivacy(false)
    }
    setCookieConsentLoaded(true)
  }, [])

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

  // Cookie同意の保存
  const handleCookieConsentSave = () => {
    if (!cookieRequired) {
      setError("必須CookieはOFFにできません")
      return
    }
    if (!cookiePrivacy) {
      setError("プライバシーポリシーへの同意は必須です")
      return
    }
    saveConsent(cookieRequired, cookieFunctional, cookiePrivacy)
    setSuccess("Cookie同意設定を更新しました")
    setTimeout(() => {
      setSuccess(null)
    }, 3000)
  }

  // Cookie同意の撤回
  const handleCookieConsentRevoke = () => {
    if (confirm("Cookie同意を撤回すると、一部の機能が利用できなくなります。よろしいですか？")) {
      revokeConsent()
      setCookieRequired(false)
      setCookieFunctional(false)
      setCookiePrivacy(false)
      setSuccess("Cookie同意を撤回しました")
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    }
  }

  // フォームの変更を検知
  const hasChanges = name !== (user?.name || "") || email !== (user?.email || "")
  const hasCookieChanges = cookieRequired !== hasRequiredConsent() || cookieFunctional !== hasFunctionalConsent() || cookiePrivacy !== hasPrivacyConsent()
  const canBuyTicket = planCode === "basic_plan" || planCode === "first_month_fm_dm" || planCode === "high_plan"

  const getPlanLabel = () => {
    if (!planCode) return "No Subscription"
    if (planCode === "basic_plan") return "Basic Plan"
    if (planCode === "first_month_fm_dm") return "Basic Plan (for 1st Month)"
    if (planCode === "high_plan") return "High Plan"
    return planCode
  }

  const startSubscriptionCheckout = async (selectedPlanCode: "basic_plan" | "high_plan" | "first_month_fm_dm") => {
    setError(null)
    setCheckoutLoading(selectedPlanCode === "basic_plan" ? "basic" : "high")
    try {
      const payload = {
        plan_code: selectedPlanCode,
        success_url: `${window.location.origin}/checkout/success?from=settings&type=subscription`,
        cancel_url: `${window.location.origin}/checkout/cancel?from=settings&type=subscription`,
        via_fm_dm_link: fmDmEligible,
      }
      const res = await apiClient.post<{ checkout_url: string }>("/api/subscriptions/checkout", payload)
      window.location.href = res.checkout_url
    } catch (err: any) {
      setError(err?.error || "プラン購入の開始に失敗しました")
    } finally {
      setCheckoutLoading(null)
    }
  }

  const startTicketCheckout = async () => {
    setError(null)
    setCheckoutLoading("ticket")
    try {
      const res = await apiClient.post<{ checkout_url: string }>("/api/review-tickets/checkout", {
        quantity: 1,
        success_url: `${window.location.origin}/checkout/success?from=settings&type=ticket`,
        cancel_url: `${window.location.origin}/checkout/cancel?from=settings&type=ticket`,
      })
      window.location.href = res.checkout_url
    } catch (err: any) {
      setError(err?.error || "チケット購入の開始に失敗しました")
    } finally {
      setCheckoutLoading(null)
    }
  }

  const cancelSubscriptionAtPeriodEnd = async () => {
    if (!confirm("次回更新を停止します。現在の期間終了までは利用可能です。よろしいですか？")) {
      return
    }
    setError(null)
    setSuccess(null)
    setCancelLoading(true)
    try {
      const res = await apiClient.post<{ message: string; expires_at?: string | null }>("/api/users/me/subscription/cancel", {})
      setSuccess(res.message || "次回更新を停止しました。")
    } catch (err: any) {
      setError(err?.error || "解約処理に失敗しました")
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div 
      className="flex min-h-screen flex-col bg-slate-50 transition-all duration-300"
      style={mainContentStyle}
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
            <p className="text-sm text-slate-500">アカウント情報とCookie設定を管理します</p>
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

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              プロフィール
            </TabsTrigger>
            <TabsTrigger value="cookies" className="flex items-center gap-2">
              <Cookie className="h-4 w-4" />
              Cookie設定
            </TabsTrigger>
          </TabsList>

          {/* プロフィールタブ */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            {loading ? (
              <JuristutorLoading message="設定を取得しています" fullScreen={false} className="py-12" />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-indigo-600" />
                      <CardTitle>登録情報</CardTitle>
                    </div>
                    <CardDescription>
                      あなたの基本情報を確認・編集できます
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

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-indigo-600" />
                      <CardTitle>Manage Your Plan</CardTitle>
                    </div>
                    <CardDescription>
                      Your Plan: {planLoading ? "Loading..." : getPlanLabel()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => startSubscriptionCheckout("basic_plan")}
                        disabled={checkoutLoading !== null}
                      >
                        {checkoutLoading === "basic" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Basic Plan (3,980円 税抜き)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => startSubscriptionCheckout("high_plan")}
                        disabled={checkoutLoading !== null}
                      >
                        {checkoutLoading === "high" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        High Plan (7,200円 税抜き)
                      </Button>
                      {fmDmEligible && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => startSubscriptionCheckout("first_month_fm_dm")}
                          disabled={checkoutLoading !== null}
                        >
                          Basic Plan (for 1st Month): <span className="line-through mx-1">3,980円</span> 1,000円
                        </Button>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={startTicketCheckout}
                          disabled={checkoutLoading !== null || !canBuyTicket}
                        >
                          {checkoutLoading === "ticket" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          追加チケット購入（900円 税抜き / +レビュー2回）
                        </Button>
                      </div>
                      {!canBuyTicket && (
                        <p className="text-sm text-amber-700 mt-2">
                          プラン未登録のユーザーはチケットを購入できません
                        </p>
                      )}
                      {planCode && (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelSubscriptionAtPeriodEnd}
                            disabled={cancelLoading}
                          >
                            {cancelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Planを解約（次回更新停止）
                          </Button>
                          <p className="text-xs text-slate-500 mt-2">
                            途中解約しても返金はありません。期間終了までは利用できます。
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      PlanB限定リンク: <Link href={FM_DM_LINK} className="underline" target="_blank">{FM_DM_LINK}</Link>
                    </p>
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
          </TabsContent>

          {/* Cookie設定タブ */}
          <TabsContent value="cookies" className="space-y-6 mt-6">
            {cookieConsentLoaded ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Cookie className="h-5 w-5 text-indigo-600" />
                    <CardTitle>Cookie・ローカルストレージの同意</CardTitle>
                  </div>
                  <CardDescription>
                    Cookieおよびローカルストレージの使用に関する同意設定を管理します
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* プライバシーポリシーへの同意 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="cookie-privacy" className="text-base font-semibold">
                          プライバシーポリシーへの同意
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          <Link href="/privacy-policy" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                            プライバシーポリシー・Cookieポリシー
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          を確認し、同意してください。
                        </p>
                      </div>
                      <Switch
                        id="cookie-privacy"
                        checked={cookiePrivacy}
                        onCheckedChange={setCookiePrivacy}
                      />
                    </div>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        プライバシーポリシーへの同意は必須です。同意しない場合、サービスを利用することができません。
                      </AlertDescription>
                    </Alert>
                  </div>

                  {/* 必須Cookie */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="cookie-required" className="text-base font-semibold">
                          必須Cookie
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          認証情報の保存など、サービス利用に不可欠なCookieです。
                        </p>
                      </div>
                      <Switch
                        id="cookie-required"
                        checked={cookieRequired}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            setError("必須CookieはOFFにできません")
                            return
                          }
                          setCookieRequired(checked)
                        }}
                        disabled={true}
                      />
                    </div>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        必須Cookieはサービス利用に不可欠なため、OFFにすることはできません。
                      </AlertDescription>
                    </Alert>
                  </div>

                  {/* 機能Cookie */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="cookie-functional" className="text-base font-semibold">
                          機能Cookie
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          サイドバーの開閉状態、スクロール位置、入力内容の一時保存など、
                          より快適にサービスを利用するためのCookieです。
                        </p>
                      </div>
                      <Switch
                        id="cookie-functional"
                        checked={cookieFunctional}
                        onCheckedChange={setCookieFunctional}
                      />
                    </div>
                  </div>

                  {/* 外部送信先の詳細情報 */}
                  <div className="pt-2 border-t">
                    <Collapsible open={showExternalDetails} onOpenChange={setShowExternalDetails}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                          <span className="text-sm">外部送信先の詳細情報</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${showExternalDetails ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-2">
                        <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-200">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 mb-1">送信先:</p>
                            <p className="text-sm text-slate-700">Google LLC</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 mb-1">送信される情報:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 ml-2">
                              <li>Google IDトークン</li>
                              <li>IPアドレス</li>
                              <li>User-Agent（ブラウザ情報）</li>
                              <li>リファラー（参照元URL）</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 mb-1">利用目的:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 ml-2">
                              <li>Googleログイン機能の提供</li>
                              <li>認証・本人確認</li>
                              <li>不正アクセス防止</li>
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600">
                              Googleのプライバシーポリシーについては、
                              <a 
                                href="https://policies.google.com/privacy" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline inline-flex items-center gap-1 ml-1"
                              >
                                Google プライバシーポリシー
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              をご確認ください。
                            </p>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* アクション */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCookieConsentRevoke}
                      className="text-destructive hover:text-destructive"
                    >
                      同意を撤回
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCookieConsentSave}
                      disabled={!hasCookieChanges}
                      className="min-w-[120px]"
                    >
                      変更を保存
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default withAuth(SettingsPage, { requireAuth: true })
