"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Info, ChevronDown, ExternalLink } from "lucide-react"
import { saveConsent, hasRequiredConsent, hasFunctionalConsent, hasPrivacyConsent } from "@/lib/cookie-consent"

interface CookieConsentBannerProps {
  onConsent: (required: boolean, functional: boolean) => void
  showOnlyRequired?: boolean // ログイン時など、必須のみ表示する場合
}

export function CookieConsentBanner({ onConsent, showOnlyRequired = false }: CookieConsentBannerProps) {
  const [required, setRequired] = useState(true) // 必須はデフォルトON
  const [functional, setFunctional] = useState(false) // 機能はデフォルトOFF
  const [privacy, setPrivacy] = useState(false) // プライバシーポリシーはデフォルトOFF
  const [showDetails, setShowDetails] = useState(false) // 外部送信先の詳細表示
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 既存の同意状態を読み込む
    const existingRequired = hasRequiredConsent()
    const existingFunctional = hasFunctionalConsent()
    const existingPrivacy = hasPrivacyConsent()
    setRequired(existingRequired || true) // 既存がない場合はtrue
    setFunctional(existingFunctional || false) // 既存がない場合はfalse
    setPrivacy(existingPrivacy || false) // 既存がない場合はfalse
  }, [])

  const handleAccept = () => {
    if (!required || !privacy) {
      // 必須Cookieまたはプライバシーポリシーに同意していない場合はエラー
      return
    }
    saveConsent(required, functional, privacy)
    onConsent(required, functional)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Cookie・ローカルストレージの使用について</CardTitle>
          <CardDescription>
            本サービスでは、サービス提供のためCookieおよびローカルストレージを使用しています。
            ご利用いただくには、必須Cookieの使用に同意していただく必要があります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* プライバシーポリシーへの同意 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="privacy-consent" className="text-base font-semibold cursor-pointer">
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
                id="privacy-consent"
                checked={privacy}
                onCheckedChange={setPrivacy}
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                プライバシーポリシーへの同意は必須です。同意しない場合、サービスを利用することができません。
              </AlertDescription>
            </Alert>
          </div>

          {/* 外部送信先の詳細情報 */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-sm">外部送信先の詳細情報</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
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

          {/* 必須Cookie */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="required-consent" className="text-base font-semibold cursor-pointer">
                  必須Cookie
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  認証情報の保存など、サービス利用に不可欠なCookieです。
                </p>
              </div>
              <Switch
                id="required-consent"
                checked={required}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    // 必須はOFFにできない
                    return
                  }
                  setRequired(checked)
                }}
                disabled={true} // 必須は常にON（視覚的にON状態を表示）
              />
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                必須Cookieはサービス利用に不可欠なため、OFFにすることはできません。
                必須Cookieに同意しない場合、ログインおよびサービスを利用することができません。
              </AlertDescription>
            </Alert>
          </div>

          {/* 機能Cookie */}
          {!showOnlyRequired && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="functional-consent" className="text-base font-semibold cursor-pointer">
                    機能Cookie
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    サイドバーの開閉状態、スクロール位置、入力内容の一時保存など、
                    より快適にサービスを利用するためのCookieです。
                  </p>
                </div>
                <Switch
                  id="functional-consent"
                  checked={functional}
                  onCheckedChange={setFunctional}
                />
              </div>
              <div className="text-xs text-muted-foreground pl-1">
                <p className="font-semibold mb-1">機能Cookieで保存される情報：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>サイドバーの開閉状態</li>
                  <li>パネルの幅設定</li>
                  <li>スクロール位置</li>
                  <li>入力中の答案テキスト</li>
                  <li>最近アクセスしたページ履歴</li>
                </ul>
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              onClick={handleAccept}
              disabled={!required || !privacy}
              className="min-w-[120px]"
            >
              同意する
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 space-y-1">
            <p>
              同意内容は1年間有効です。設定ページからいつでも変更・撤回できます。
            </p>
            <p>
              <Link href="/privacy-policy" className="text-indigo-600 hover:underline">
                プライバシーポリシー・Cookieポリシー
              </Link>
              を確認してください。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
