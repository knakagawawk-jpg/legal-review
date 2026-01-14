"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, AlertCircle, X } from "lucide-react"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          prompt: () => void
          renderButton: (element: HTMLElement, config: any) => void
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
        console.error("GOOGLE_CLIENT_ID is not set")
        return
      }

      // Google Identity Services を初期化
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
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
      }
    }
  }, [isGoogleLoaded, isAuthenticated, login, clearError])

  const handleLogin = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  if (isAuthenticated) {
    return null
  }

  const displayError = loginError || error

  return (
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
      ) : (
        <Button onClick={handleLogin} variant="outline" size="sm">
          Googleでログイン
        </Button>
      )}
    </div>
  )
}
