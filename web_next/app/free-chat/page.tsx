"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

export default function FreeChatPage() {
  const router = useRouter()
  const { isOpen } = useSidebar()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 新しいスレッドを作成してリダイレクト
    const createNewThread = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "free_chat",
            title: null 
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || errorData.detail || "スレッドの作成に失敗しました")
        }

        const data = await response.json()
        router.push(`/free-chat/${data.id}`)
      } catch (error: any) {
        console.error("Error creating thread:", error)
        setError(error.message || "スレッドの作成中にエラーが発生しました")
        setLoading(false)
      }
    }

    createNewThread()
  }, [router])

  return (
    <div className={cn("min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center transition-all duration-300", isOpen && "ml-52")}>
      <div className="text-center space-y-4">
        {loading && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-lg text-muted-foreground">新しいチャットを作成中...</p>
          </>
        )}
        {error && (
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
