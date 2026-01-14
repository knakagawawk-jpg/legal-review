"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function YourPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/your-page/dashboard")
      } else {
        // 未認証の場合はホームページにリダイレクト
        router.push("/")
      }
    }
  }, [isLoading, isAuthenticated, router])

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

  return null
}
