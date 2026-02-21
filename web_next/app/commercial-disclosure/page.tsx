"use client"

import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { Scale, FileText } from "lucide-react"
import Link from "next/link"

export default function CommercialDisclosurePage() {
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
        {/* ページタイトル */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">商取引に関する開示</h1>
          </div>
        </div>

        {/* 特定商取引法に基づく表記 */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <p className="text-slate-600 text-sm mb-6">
            特定商取引法に基づき、以下のとおり表記いたします。個人事業主のため、事業者名・住所・電話番号はご請求があれば遅滞なく開示します。
          </p>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-700 mb-1">事業者名</dt>
              <dd className="text-slate-600 pl-2">ご請求があれば遅滞なく開示します。</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">事業所所在地</dt>
              <dd className="text-slate-600 pl-2">ご請求があれば遅滞なく開示します。</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">電話番号</dt>
              <dd className="text-slate-600 pl-2">ご請求があれば遅滞なく開示します。</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">メールアドレス（お問い合わせは24時間受付）</dt>
              <dd className="text-slate-600 pl-2">
                <a href="mailto:note.shihoushiken@gmail.com" className="text-indigo-600 hover:underline">
                  note.shihoushiken@gmail.com
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">代表者（事業主）</dt>
              <dd className="text-slate-600 pl-2">弁護士太郎</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">追加手数料</dt>
              <dd className="text-slate-600 pl-2">なし</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">返品・返金・キャンセル</dt>
              <dd className="text-slate-600 pl-2">
                <span className="block mb-2">・サービスに不良があり、契約の目的が達成できない場合：返金いたします。</span>
                <span className="block">・上記以外の返金・キャンセル：原則お受けしておりませんが、ご事情に応じて個別にご相談に応じます。お問い合わせは上記メールアドレスまで。</span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">役務の提供時期</dt>
              <dd className="text-slate-600 pl-2">決済完了後、速やかにご利用いただけます。（配達・発送を伴う物販は行っておりません。）</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">お支払い方法</dt>
              <dd className="text-slate-600 pl-2">クレジットカードのみ</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">お支払い時期</dt>
              <dd className="text-slate-600 pl-2">クレジットカード決済は即時</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-700 mb-1">販売価格</dt>
              <dd className="text-slate-600 pl-2">
                <span className="block">基本プラン 月額3,980円（税込4,378円）</span>
                <span className="block">プロプラン 月額7,200円（税込7,920円）</span>
                <span className="block mt-1 text-slate-500">その他プラン・サービスは当サイトのサービスページに表示しています。</span>
              </dd>
            </div>
          </dl>
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
