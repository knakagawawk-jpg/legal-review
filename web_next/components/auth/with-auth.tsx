"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"
import { authStorage } from "@/lib/auth-storage"

interface WithAuthOptions {
  redirectTo?: string
  requireAuth?: boolean
}

/**
 * 認証が必要なページを保護するHOC
 * @param Component 保護するコンポーネント
 * @param options オプション設定
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { redirectTo = "/", requireAuth = true } = options

  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    // クライアント側でのみマウントされたことを確認（Hydrationエラーを防ぐ）
    useEffect(() => {
      setMounted(true)
    }, [])

    useEffect(() => {
      // 認証チェック: マウント済み、ローディング完了、認証が必要、かつ未認証の場合のみリダイレクト
      if (mounted && !isLoading && requireAuth && !isAuthenticated) {
        // ストレージから直接トークンを確認（認証コンテキストの更新を待つため）
        const hasToken = authStorage.getToken()
        if (!hasToken) {
          router.push(redirectTo)
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, isLoading, isAuthenticated, router])

    // サーバー側レンダリング時は何も表示しない（Hydrationエラーを防ぐ）
    if (!mounted) {
      return null
    }

    // ローディング中
    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-600" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-800">認証情報を確認中...</p>
              <p className="text-sm text-slate-500">しばらくお待ちください</p>
            </div>
          </div>
        </div>
      )
    }

    // 認証が必要だが未認証の場合
    if (requireAuth && !isAuthenticated) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-800">認証が必要です</p>
              <p className="text-sm text-slate-500">ログインページにリダイレクトしています...</p>
            </div>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}
