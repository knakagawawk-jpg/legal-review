"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { MessageSquare, Clock } from "lucide-react"
import type { Thread } from "@/types/api"

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return ""
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "今日"
  if (diffDays === 1) return "昨日"
  if (diffDays < 7) return `${diffDays}日前`
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
}

export function FreeChatSection() {
  const pathname = usePathname()
  const [threads, setThreads] = useState<Thread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)

  useEffect(() => {
    setLoadingThreads(true)
    fetch("/api/threads?limit=10&type=free_chat")
      .then((res) => res.json())
      .then((data) => {
        if (data.threads) {
          setThreads(data.threads)
        }
      })
      .catch((err) => {
        console.error("Failed to fetch threads:", err)
      })
      .finally(() => {
        setLoadingThreads(false)
      })
  }, [])

  return (
    <div className="mt-4 pt-4 border-t border-blue-100/40">
      <div className="px-2 mb-2 flex items-center gap-2">
        <Clock className="h-3 w-3 text-blue-400/70" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">履歴</p>
      </div>
      {loadingThreads ? (
        <div className="px-2 py-2 text-xs text-slate-400">読み込み中...</div>
      ) : threads.length === 0 ? (
        <div className="px-2 py-2 text-xs text-slate-400">履歴がありません</div>
      ) : (
        <div className="space-y-0.5">
          {threads.map((thread) => {
            const isActive = pathname === `/free-chat/${thread.id}`
            const displayTitle = thread.title || "新しいチャット"
            const dateText = formatDate(thread.last_message_at || thread.created_at)

            return (
              <Link key={thread.id} href={`/free-chat/${thread.id}`}>
                <div
                  className={cn(
                    "group flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer",
                    isActive
                      ? "bg-white/80 shadow-sm ring-1 ring-blue-100/50 text-slate-800"
                      : "hover:bg-white/60 text-slate-600 hover:text-slate-800",
                  )}
                >
                  <MessageSquare
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayTitle}</p>
                    {dateText && <p className="text-[10px] text-slate-400 mt-0.5">{dateText}</p>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
