"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FileText, BookOpen, MessageCircle, ScrollText, Wrench } from "lucide-react"

const navigation = [
  {
    name: "講評生成",
    href: "/review",
    icon: FileText,
    description: "答案の講評を生成",
  },
  {
    name: "短答式試験",
    href: "/short-answer",
    icon: BookOpen,
    description: "短答式問題を解く",
  },
  {
    name: "Your Page",
    href: "/your-page",
    icon: ScrollText,
    description: "過去の記録とノート",
  },
  {
    name: "フリーチャット",
    href: "/free-chat",
    icon: MessageCircle,
    description: "LLMと自由にチャット",
  },
  {
    name: "開発用",
    href: "/dev",
    icon: Wrench,
    description: "開発・デバッグ用ページ",
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full flex-col">
        {/* ロゴ・タイトル */}
        <div className="border-b p-6">
          <div className="flex items-center gap-2">
            <div className="text-2xl">⚖️</div>
            <div>
              <h1 className="text-xl font-bold text-primary">答案講評</h1>
              <p className="text-xs text-muted-foreground">法律答案の自動講評システム</p>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 space-y-1 p-4">
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            🧭 ナビゲーション
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            const Icon = item.icon

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className={cn(
                      "text-xs",
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {item.description}
                    </span>
                  </div>
                </Button>
              </Link>
            )
          })}
        </nav>

        {/* フッター（必要に応じて） */}
        <div className="border-t p-4">
          <p className="text-xs text-center text-muted-foreground">
            答案講評システム v1.0
          </p>
        </div>
      </div>
    </aside>
  )
}
