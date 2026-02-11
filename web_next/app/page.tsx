"use client"

import Link from "next/link"
import { Scale, User, MessageSquare, FileText, Trophy, Sparkles } from "lucide-react"
import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

const menuItems = [
  {
    title: "Your Page",
    description: "あなたの学習を一括管理",
    href: "/your-page",
    icon: User,
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    iconBg: "bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400",
    borderColor: "border-amber-300/60",
    glowColor: "shadow-amber-300/50",
    hoverBg: "hover:bg-amber-50/50",
  },
  {
    title: "講評生成",
    description: "あなたの答案をAIが分析・講評",
    href: "/review",
    icon: FileText,
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    iconBg: "bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400",
    borderColor: "border-blue-300/60",
    glowColor: "shadow-blue-300/50",
    hoverBg: "hover:bg-blue-50/50",
  },
  {
    title: "フリーチャット",
    description: "学習の疑問を何でもAIに質問",
    href: "/free-chat",
    icon: MessageSquare,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    iconBg: "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400",
    borderColor: "border-emerald-300/60",
    glowColor: "shadow-emerald-300/50",
    hoverBg: "hover:bg-emerald-50/50",
  },
  {
    title: "短答チャレンジ",
    description: "AIに質問しながら短答学習",
    href: "/short-answer",
    icon: Trophy,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    iconBg: "bg-gradient-to-br from-violet-400 via-purple-400 to-fuchsia-400",
    borderColor: "border-violet-300/60",
    glowColor: "shadow-violet-300/50",
    hoverBg: "hover:bg-violet-50/50",
  },
]

export default function HomePage() {
  const { mainContentStyle } = useSidebar()
  
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center px-4 sm:px-6 pt-20 sm:pt-24 pb-8 sm:pb-12 transition-all duration-300"
      style={mainContentStyle}
    >
      {/* サイドバーを開くボタン */}
      <div className="fixed top-4 left-4 z-50">
        <SidebarToggle />
      </div>
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-amber-100/20 via-emerald-100/20 to-cyan-100/20 rounded-full blur-3xl" />
      </div>

      {/* Logo Section */}
      <div className="relative flex flex-col items-center mb-20 -mt-8">
        <div className="relative h-24 w-24 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-3xl shadow-2xl shadow-blue-400/40 flex items-center justify-center mb-6 ring-1 ring-white/20">
          <Scale className="h-12 w-12 text-white" strokeWidth={1.5} />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent tracking-tight">
          Juristutor-AI
        </h1>
        <p className="text-sm text-slate-400 font-medium mt-3 tracking-wide">AI-Powered Legal Learning Platform</p>
      </div>

      {/* Menu Grid */}
      <div className="relative grid grid-cols-2 gap-4 sm:gap-6 w-full max-w-xl">
        {menuItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={`group relative bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-5 sm:p-8 border ${item.borderColor} shadow-lg ${item.glowColor} transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl ${item.hoverBg}`}
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient} rounded-t-3xl opacity-40 group-hover:opacity-100 transition-opacity duration-300`}
            />

            <div
              className={`h-14 w-14 ${item.iconBg} rounded-2xl shadow-lg flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ring-2 ring-white/50`}
            >
              <item.icon className="h-7 w-7 text-white" strokeWidth={1.5} />
            </div>

            <h2 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-slate-900 transition-colors">
              {item.title}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>

            {/* Arrow indicator */}
            <div className="absolute bottom-6 right-6 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">
              <svg
                className="h-4 w-4 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-20 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-200" />
          <span className="text-xs text-slate-400 font-medium">v0.1.0 Beta</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-200" />
        </div>
        <p className="text-xs text-slate-400 text-center max-w-md mt-2">
          あくまでも司法試験受験勉強を補助するツールであり
          <br />
          法的なアドバイスを行うサービスではありません。
        </p>
      </div>
    </div>
  )
}
