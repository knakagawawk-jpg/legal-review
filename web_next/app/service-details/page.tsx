"use client"

import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { Scale, FileText, Zap, MessageSquare, BookOpen, Sparkles } from "lucide-react"
import Link from "next/link"

export default function ServiceDetailsPage() {
  const { mainContentStyle } = useSidebar()

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 transition-all duration-300"
      style={mainContentStyle}
    >
      <header className="shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between px-3">
          <div className="flex items-center gap-2 ml-2">
            <SidebarToggle />
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500">
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-slate-800">Juristutor-AI</h1>
          </div>
        </div>
      </header>

      <main className="flex flex-col mx-auto w-full max-w-4xl p-6 gap-6">
        {/* ヒーロー */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg">
            <Scale className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Juristutor-AI</h1>
          <p className="text-slate-600 max-w-md">
            AIで論文演習を加速する、司法試験学習サポート
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
          <p className="text-sm font-medium text-indigo-800">Coming Soon</p>
          <p className="text-lg font-semibold text-indigo-700 mt-1">2/23(月祝) 公開予定</p>
        </div>

        {/* プラン一覧 */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* 基本プラン */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3">
              <h2 className="text-base font-bold text-white">基本プラン</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-2xl font-bold text-slate-800">3,980<span className="text-base font-normal text-slate-600">円</span></p>
                <p className="text-xs text-slate-500">税込み 4,378円</p>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                  月8回の論文講評
                </li>
                <li className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500 shrink-0" />
                  24時間チャット相談
                </li>
                <li className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
                  個別復習問題生成
                </li>
              </ul>
              <p className="text-xs text-slate-600 leading-relaxed">
                格別にお得な値段で、最新LLMを組み込んだAIの助けを借りた質の高い演習を！
              </p>
            </div>
          </section>

          {/* プロプラン */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
              <h2 className="text-base font-bold text-white">プロプラン</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-2xl font-bold text-slate-800">7,200<span className="text-base font-normal text-slate-600">円</span></p>
                <p className="text-xs text-slate-500">税込み 7,920円</p>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  月20回の圧倒的演習量
                </li>
              </ul>
              <p className="text-xs text-slate-600 leading-relaxed">
                本気で論文対策を行いたいあなたへ。AIとの徹底的な検討を日々の勉強に組み込み、あなたの弱点をどんどん解消！
              </p>
            </div>
          </section>
        </div>

        {/* 注意事項 */}
        <div className="bg-slate-100 rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-600">
            *プラン毎にLLM使用量の制限がございます。
          </p>
        </div>

        {/* トップへ */}
        <div className="flex justify-center pt-4">
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2"
          >
            トップへ戻る
          </Link>
        </div>
      </main>
    </div>
  )
}
