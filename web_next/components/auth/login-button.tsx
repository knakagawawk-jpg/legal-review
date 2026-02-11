"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, AlertCircle, X } from "lucide-react"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { hasRequiredConsent, hasPrivacyConsent } from "@/lib/cookie-consent"

/** Google One Tap prompt() の通知コールバック型 */
interface PromptMomentNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () =>
    | "browser_not_supported"
    | "invalid_client"
    | "missing_client_id"
    | "opt_out_or_no_session"
    | "secure_http_required"
    | "suppressed_by_user"
    | "unregistered_origin"
    | "unknown_reason"
  isSkippedMoment: () => boolean
  getSkippedReason: () =>
    | "auto_cancel"
    | "user_cancel"
    | "tap_outside"
    | "issuing_failed"
  isDismissedMoment: () => boolean
  getDismissedReason: () =>
    | "credential_returned"
    | "cancel_called"
    | "flow_restarted"
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            use_fedcm_for_prompt?: boolean
            callback: (response: { credential: string }) => void
          }) => void
          prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void
          renderButton: (element: HTMLElement, config: {
            type?: "standard" | "icon"
            theme?: "outline" | "filled_blue" | "filled_black"
            size?: "large" | "medium" | "small"
            text?: "signin_with" | "signup_with" | "continue_with" | "signin"
            shape?: "rectangular" | "pill" | "circle" | "square"
            logo_alignment?: "left" | "center"
            width?: number
            locale?: string
          }) => void
        }
      }
    }
  }
}

export function LoginButton() {
  const { login, isLoading, isAuthenticated, error, clearError } = useAuth()
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showConsentBanner, setShowConsentBanner] = useState(false)
  const [showGoogleButton, setShowGoogleButton] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)

  // クライアント側でのみマウントされたことを確認（Hydrationエラーを防ぐ）
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Google Identity Services スクリプトを読み込む
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      setIsGoogleLoaded(true)
    }
    document.body.appendChild(script)

    return () => {
      // クリーンアップ
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  useEffect(() => {
    if (isGoogleLoaded && !isAuthenticated) {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      if (!clientId) {
        console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set")
        return
      }

      // 現在のオリジンを確認（デバッグ用）
      const currentOrigin = window.location.origin
      const currentHost = window.location.host
      const currentProtocol = window.location.protocol
      console.log("=== Google Auth Debug Info ===")
      console.log("Current origin:", currentOrigin)
      console.log("Current host:", currentHost)
      console.log("Current protocol:", currentProtocol)
      console.log("Full URL:", window.location.href)
      console.log("Client ID:", clientId)
      console.log("Note: Make sure", currentOrigin, "is added to 'Authorized JavaScript origins' in Google Cloud Console")
      console.log("=============================")

      // Google Identity Services を初期化
      if (window.google?.accounts?.id) {
        try {
          // エラーハンドリングを追加
          const originalConsoleError = console.error
          console.error = (...args: any[]) => {
            if (args.some(arg => typeof arg === 'string' && arg.includes('origin is not allowed'))) {
              console.error("=== Google Auth Configuration Error ===")
              console.error("Error:", args)
              console.error("Client ID:", clientId)
              console.error("Origin:", currentOrigin)
              console.error("Please verify in Google Cloud Console:")
              console.error("1. OAuth 2.0 Client ID:", clientId)
              console.error("2. Authorized JavaScript origins includes:", currentOrigin)
              console.error("3. Settings are saved and propagated (may take 5-10 minutes)")
              console.error("========================================")
              setLoginError(
                `Google認証の設定エラー: オリジン ${currentOrigin} がクライアントID ${clientId} で許可されていません。Google Cloud Consoleの設定を確認してください。`
              )
            }
            originalConsoleError.apply(console, args)
          }

          window.google.accounts.id.initialize({
            client_id: clientId,
            // FedCM設定を無効化（localhostでの動作を安定させるため）
            // 参考: https://developers.google.com/identity/gsi/web/guides/fedcm-migration
            // FedCMは新しい標準だが、localhost環境では不安定な場合があるため無効化
            use_fedcm_for_prompt: false,
            callback: async (response) => {
              console.log("Google callback received")
              setIsLoggingIn(true)
              setLoginError(null)
              clearError()
              try {
                await login(response.credential)
              } catch (error: any) {
                console.error("Login failed:", error)
                setLoginError(error.message || "ログインに失敗しました")
              } finally {
                setIsLoggingIn(false)
              }
            },
          })
          console.log("Google Identity Services initialized successfully")
          
          // コンソールエラーハンドラーを元に戻す
          setTimeout(() => {
            console.error = originalConsoleError
          }, 5000)
        } catch (error: any) {
          console.error("Failed to initialize Google Identity Services:", error)
          setLoginError("Google Identity Servicesの初期化に失敗しました: " + error.message)
        }
      } else {
        console.error("window.google.accounts.id is not available")
        setLoginError("Google Identity Services APIが利用できません")
      }
    }
  }, [isGoogleLoaded, isAuthenticated, login, clearError])

  const handleLogin = () => {
    console.log("Login button clicked")
    
    // 必須Cookieとプライバシーポリシーへの同意をチェック
    if (!hasRequiredConsent() || !hasPrivacyConsent()) {
      setShowConsentBanner(true)
      return
    }
    
    console.log("isGoogleLoaded:", isGoogleLoaded)
    console.log("window.google:", window.google)
    console.log("window.google?.accounts?.id:", window.google?.accounts?.id)
    
    if (!isGoogleLoaded) {
      console.error("Google Identity Services is not loaded yet")
      setLoginError("Google Identity Servicesが読み込まれていません。ページを再読み込みしてください。")
      return
    }
    
    if (!window.google?.accounts?.id) {
      console.error("Google Identity Services API is not available")
      setLoginError("Google Identity Services APIが利用できません。")
      return
    }
    
    // フォールバックボタンが既に表示されている場合はpromptを再試行しない
    // （ユーザーはGoogleボタンを直接クリックする）
    if (showGoogleButton) {
      return
    }
    
    try {
      // prompt() に通知コールバックを渡し、抑制を検知する
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason()
          console.warn("One Tap prompt was not displayed. Reason:", reason)
          
          if (reason === "suppressed_by_user" || reason === "opt_out_or_no_session") {
            // クールダウン中またはセッションなし → フォールバックボタンを表示
            console.log("Showing fallback Google Sign-In button")
            setShowGoogleButton(true)
          } else if (reason === "browser_not_supported") {
            setLoginError("お使いのブラウザではGoogle One Tapがサポートされていません。")
            setShowGoogleButton(true)
          } else if (reason === "unregistered_origin" || reason === "invalid_client") {
            setLoginError("Google認証の設定に問題があります。管理者にお問い合わせください。")
          } else {
            // その他の理由でも念のためフォールバックボタンを表示
            setShowGoogleButton(true)
          }
        } else if (notification.isSkippedMoment()) {
          const reason = notification.getSkippedReason()
          console.warn("One Tap prompt was skipped. Reason:", reason)
          // ユーザーがキャンセルした場合もフォールバックボタンを表示
          if (reason === "user_cancel" || reason === "tap_outside") {
            setShowGoogleButton(true)
          }
        }
        // isDisplayMoment() / isDismissedMoment() の場合は正常動作なので何もしない
      })
      console.log("Prompt called successfully with notification listener")
    } catch (error: any) {
      console.error("Error calling prompt:", error)
      setLoginError(error.message || "ログインプロンプトの表示に失敗しました")
      // エラー時もフォールバックボタンを表示
      setShowGoogleButton(true)
    }
  }

  const handleConsent = (required: boolean, functional: boolean) => {
    setShowConsentBanner(false)
    // 同意後、再度ログイン処理を実行
    if (required) {
      // 少し遅延させてからログインプロンプトを表示
      setTimeout(() => {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.prompt()
        }
      }, 100)
    }
  }

  // フォールバック: Google公式ボタンをレンダリング
  // One Tapが抑制された場合にポップアップ方式のGoogleボタンを表示する
  // renderButton はクールダウンの影響を受けないため、常に動作する
  useEffect(() => {
    if (showGoogleButton && googleButtonRef.current && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: "ja",
        })
        console.log("Google fallback button rendered successfully")
      } catch (error) {
        console.error("Failed to render Google fallback button:", error)
      }
    }
  }, [showGoogleButton, isGoogleLoaded])

  // サーバー側レンダリング時は何も表示しない（Hydrationエラーを防ぐ）
  if (!mounted || isLoading) {
    return null
  }

  if (isAuthenticated) {
    return null
  }

  const displayError = loginError || error

  return (
    <>
      {showConsentBanner && (
        <CookieConsentBanner
          onConsent={handleConsent}
          showOnlyRequired={true}
        />
      )}
      <div className="flex flex-col gap-2">
        {displayError && (
          <Alert variant="destructive" className="py-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div className="flex-1">
                  <AlertTitle className="text-sm">ログインエラー</AlertTitle>
                  <AlertDescription className="text-xs mt-1">
                    {displayError}
                  </AlertDescription>
                </div>
              </div>
              <button
                onClick={() => {
                  setLoginError(null)
                  clearError()
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}

        {!isGoogleLoaded || isLoggingIn || isLoading ? (
          <Button disabled variant="outline" size="sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isLoggingIn ? "ログイン中..." : "読み込み中..."}
          </Button>
        ) : showGoogleButton ? (
          // フォールバック: Google公式サインインボタン（One Tapが使えない場合）
          <div className="flex flex-col items-center gap-1.5">
            <div ref={googleButtonRef} />
            <p className="text-xs text-muted-foreground">
              上のボタンでログインしてください
            </p>
          </div>
        ) : (
          <Button onClick={handleLogin} variant="outline" size="sm">
            Googleでログイン
          </Button>
        )}
      </div>
    </>
  )
}
