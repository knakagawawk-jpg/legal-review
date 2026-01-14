"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

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
  const { login, isLoading, isAuthenticated } = useAuth()
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

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
            try {
              await login(response.credential)
            } catch (error: any) {
              console.error("Login failed:", error)
              alert(error.message || "ログインに失敗しました")
            } finally {
              setIsLoggingIn(false)
            }
          },
        })
      }
    }
  }, [isGoogleLoaded, isAuthenticated, login])

  const handleLogin = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  if (isAuthenticated) {
    return null
  }

  if (!isGoogleLoaded || isLoggingIn) {
    return (
      <Button disabled variant="outline" size="sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        読み込み中...
      </Button>
    )
  }

  return (
    <Button onClick={handleLogin} variant="outline" size="sm">
      Googleでログイン
    </Button>
  )
}
