"use client"

import { useState, createContext, useContext, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FileText, BookOpen, MessageCircle, ScrollText, Wrench, Menu, ChevronLeft, Scale, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarContentSection } from "./sidebar-sections"
import { LoginButton } from "./auth/login-button"
import { UserMenu } from "./auth/user-menu"
import { useAuth } from "@/contexts/auth-context"
import { hasFunctionalConsent } from "@/lib/cookie-consent"
import { useIsMobile } from "@/hooks/use-mobile"

// サイドバーの状態を共有するContext
type SidebarContextType = {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  /** メインコンテンツ用marginLeft（モバイルでは常に0、デスクトップではサイドバー開閉に連動） */
  mainContentStyle: React.CSSProperties
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    // Contextが提供されていない場合は、デフォルトの動作（常に閉じている）を返す
    return { isOpen: false, setIsOpen: () => { }, mainContentStyle: { marginLeft: 0 } }
  }
  return context
}

// 基本ナビゲーション項目
const baseNavigation = [
  {
    name: "Your Page",
    href: "/your-page",
    icon: ScrollText,
    description: "過去の記録とノート",
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "講評生成",
    href: "/review",
    icon: FileText,
    description: "答案をAIがレビュー",
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "フリーチャット",
    href: "/free-chat",
    icon: MessageCircle,
    description: "最新LLMに質問できる",
    color: "from-emerald-500 to-teal-500",
  },
  {
    name: "短答チャレンジ",
    href: "/short-answer",
    icon: BookOpen,
    description: "開発中",
    color: "from-violet-500 to-purple-500",
  },
]

// dev環境のみのナビゲーション項目
const devNavigation = [
  {
    name: "開発用",
    href: "/dev",
    icon: Wrench,
    description: "開発・デバッグ用",
    color: "from-slate-500 to-zinc-500",
  },
]

// 環境に応じたナビゲーションを取得
function getNavigation() {
  const enableDevPage = process.env.NEXT_PUBLIC_ENABLE_DEV_PAGE === "true"
  if (enableDevPage) {
    return [...baseNavigation, ...devNavigation]
  }
  return baseNavigation
}

// サイドバーの状態を管理するProviderコンポーネント
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // 初期値は常に true に統一（SSR/クライアントで一致させ、ハイドレーション不整合を防ぐ）
  // 閉じたときに「開く」ボタンが消える不具合は、ここがクライアントで localStorage 由来の
  // false になりサーバーと食い違うことが原因で起きていた
  const [isOpen, setIsOpen] = useState(true)

  // マウント後に localStorage から状態を復元（クライアントのみ）
  useEffect(() => {
    if (typeof window === "undefined") return
    if (hasFunctionalConsent()) {
      const saved = localStorage.getItem("sidebar_is_open")
      if (saved !== null) {
        setIsOpen(saved === "true")
      }
      // 初回は useState(true) のまま
    }
  }, [])

  // サイドバーの状態が変更されたときにlocalStorageに保存
  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open)
    if (typeof window !== 'undefined') {
      try {
        // 機能Cookieの同意をチェック
        if (hasFunctionalConsent()) {
          localStorage.setItem('sidebar_is_open', open ? 'true' : 'false')
        } else {
          // 同意がない場合は保存しない（警告は出さない - UX向上のための機能なので）
        }
      } catch (error) {
        console.error('Failed to save sidebar state:', error)
      }
    }
  }

  const isMobile = useIsMobile()
  const mainContentStyle: React.CSSProperties = {
    marginLeft: isMobile ? 0 : (isOpen ? 208 : 0),
  }

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen: handleSetIsOpen, mainContentStyle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { isOpen, setIsOpen } = useSidebar()
  const { user } = useAuth()
  const baseNav = getNavigation()
  
  // 管理者用ナビゲーション（管理者権限がある場合のみ表示）
  const adminNavigation = user?.is_admin ? [
    {
      name: "管理者ページ",
      href: "/dev",
      icon: Settings,
      description: "ユーザー管理・統計",
      color: "from-red-500 to-rose-500",
    },
  ] : []
  
  // 管理者の場合は devNavigation の /dev を除外（adminNavigation の管理者ページで置き換え）
  const navigation = user?.is_admin 
    ? baseNav.filter(item => item.href !== "/dev")
    : baseNav

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-52 bg-gradient-to-b from-blue-50/80 via-slate-50 to-white border-r border-slate-200/60 z-40 transition-transform duration-300 ease-out shadow-xl shadow-slate-200/50",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="px-3 py-3 border-b border-blue-100/60 bg-gradient-to-r from-blue-100/80 to-cyan-50/60">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-sm">
                  <Scale className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-700 tracking-tight">Juristutor</h1>
                  <p className="text-[9px] text-blue-500/70 font-medium">AI法律学習アシスタント</p>
                </div>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-blue-200/40 transition-colors"
                aria-label="サイドバーを閉じる"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-3 overflow-hidden bg-gradient-to-b from-blue-50/30 to-transparent flex flex-col">
            {/* 上部: 共通メニュー */}
            <div className="flex-shrink-0">
              <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">メニュー</p>
              <div className="space-y-0.5">
                {[...navigation, ...adminNavigation].map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
                  const Icon = item.icon

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200",
                          isActive ? "bg-white/80 shadow-sm ring-1 ring-blue-100/50" : "hover:bg-white/60",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br shadow-sm transition-transform duration-200",
                            item.color,
                            isActive ? "scale-105" : "group-hover:scale-105",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={cn(
                              "text-xs font-medium truncate transition-colors",
                              isActive ? "text-slate-800" : "text-slate-600 group-hover:text-slate-800",
                            )}
                          >
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">{item.description}</span>
                        </div>
                        {isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* 下部: 機能ごとの独自領域 */}
            <div className="flex-1 mt-4 min-h-0 overflow-y-auto">
              <SidebarContentSection />
            </div>
          </nav>

          {/* フッター */}
          <div className="p-3 border-t border-blue-100/40 bg-blue-50/20">
            <AuthSection />
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-[10px] text-slate-400">Juristutor v1.0</p>
              <Link href="/your-page/settings">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="設定">
                  <Settings className="h-3 w-3 text-slate-400" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// 認証セクション
function AuthSection() {
  const { isAuthenticated, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)

  // クライアント側でのみマウントされたことを確認（Hydrationエラーを防ぐ）
  useEffect(() => {
    setMounted(true)
  }, [])

  // サーバー側レンダリング時は何も表示しない（Hydrationエラーを防ぐ）
  if (!mounted || isLoading) {
    return null
  }

  return (
    <div className="flex items-center justify-center">
      {isAuthenticated ? <UserMenu /> : <LoginButton />}
    </div>
  )
}

// サイドバーを開くボタンコンポーネント（ヘッダーなどで使用）
export function SidebarToggle() {
  const { isOpen, setIsOpen } = useSidebar()

  if (isOpen) return null

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
      aria-label="メニューを開く"
    >
      <Menu className="h-4 w-4 text-slate-700" />
    </button>
  )
}
