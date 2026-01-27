"use client"

import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { Scale, FileText } from "lucide-react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
  const { isOpen } = useSidebar()

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 transition-all duration-300"
      style={{
        marginLeft: isOpen ? '208px' : '0',
      }}
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
            <h1 className="text-2xl font-bold text-slate-800">プライバシーポリシー・Cookieポリシー</h1>
            <p className="text-sm text-slate-500">最終更新日: 2025年1月27日</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">1. はじめに</h2>
            <p className="text-slate-700 leading-relaxed">
              Juristutor-AI（以下「当サービス」）は、ユーザーの個人情報の保護を重要視しており、
              個人情報保護法および関連法令を遵守し、適切な取り扱いを行います。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">2. 収集する情報</h2>
            <h3 className="text-lg font-medium text-slate-700 mb-2">2.1 認証情報</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
              <li>Googleアカウント情報（メールアドレス、名前、プロフィール画像）</li>
              <li>認証トークン（JWT）</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-700 mb-2 mt-4">2.2 利用状況情報</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
              <li>IPアドレス</li>
              <li>User-Agent（ブラウザ情報）</li>
              <li>リファラー（参照元URL）</li>
              <li>アクセス日時</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">3. Cookie・ローカルストレージの使用</h2>
            <h3 className="text-lg font-medium text-slate-700 mb-2">3.1 必須Cookie</h3>
            <p className="text-slate-700 leading-relaxed mb-2">
              サービス利用に不可欠なCookieです。これらに同意しない場合、サービスを利用できません。
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
              <li><strong>auth_token</strong>: 認証トークン（JWT）の保存</li>
              <li><strong>auth_user</strong>: ユーザー情報のキャッシュ</li>
              <li><strong>auth_remember_me</strong>: ログイン状態の記憶設定</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-700 mb-2 mt-4">3.2 機能Cookie</h3>
            <p className="text-slate-700 leading-relaxed mb-2">
              より快適にサービスを利用するためのCookieです。これらは任意で、同意しない場合でも基本的なサービスは利用できます。
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
              <li><strong>sidebar_is_open</strong>: サイドバーの開閉状態</li>
              <li><strong>review_panel_ratio</strong>: パネルの幅設定</li>
              <li><strong>review_answer_text</strong>: 入力中の答案テキスト（一時保存）</li>
              <li><strong>study-memo-scroll</strong>: スクロール位置</li>
              <li><strong>study-topic-scroll</strong>: スクロール位置</li>
              <li><strong>recent_subject_pages</strong>: 最近アクセスした科目ページ履歴</li>
              <li><strong>recent_note_pages</strong>: 最近アクセスしたノートページ履歴</li>
              <li><strong>last_main_tab</strong>: 最後に選択したタブ</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">4. 外部への情報提供</h2>
            <h3 className="text-lg font-medium text-slate-700 mb-2">4.1 Google Identity Services</h3>
            <p className="text-slate-700 leading-relaxed mb-2">
              当サービスは、Googleログイン機能を提供するため、Google LLC（以下「Google」）のサービスを利用しています。
            </p>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium text-slate-800">送信先:</p>
              <p className="text-sm text-slate-700">Google LLC</p>

              <p className="text-sm font-medium text-slate-800 mt-3">送信される情報:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 ml-4">
                <li>Google IDトークン</li>
                <li>IPアドレス</li>
                <li>User-Agent（ブラウザ情報）</li>
                <li>リファラー（参照元URL）</li>
              </ul>

              <p className="text-sm font-medium text-slate-800 mt-3">利用目的:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 ml-4">
                <li>Googleログイン機能の提供</li>
                <li>認証・本人確認</li>
                <li>不正アクセス防止</li>
              </ul>

              <p className="text-sm text-slate-600 mt-3">
                Googleのプライバシーポリシーについては、
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Google プライバシーポリシー
                </a>
                をご確認ください。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">5. 情報の利用目的</h2>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
              <li>サービスの提供・運営</li>
              <li>ユーザー認証・本人確認</li>
              <li>不正アクセス防止・セキュリティ対策</li>
              <li>サービス改善・機能開発</li>
              <li>お問い合わせ対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">6. 情報の保存期間</h2>
            <p className="text-slate-700 leading-relaxed">
              個人情報は、利用目的の達成に必要な期間、または法令に基づく保存期間中、適切に管理・保存されます。
              Cookieの保存期間については、各Cookieの説明を参照してください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">7. 情報の管理・保護</h2>
            <p className="text-slate-700 leading-relaxed">
              当サービスは、個人情報の漏洩、滅失、毀損の防止その他個人情報の安全管理のため、
              適切な技術的・組織的安全管理措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">8. 同意の撤回</h2>
            <p className="text-slate-700 leading-relaxed">
              Cookie同意は、設定ページからいつでも撤回できます。
              ただし、必須Cookieの同意を撤回した場合、サービスを利用できなくなります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">9. お問い合わせ</h2>
            <p className="text-slate-700 leading-relaxed">
              個人情報の取り扱いに関するお問い合わせは、設定ページからご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">10. ポリシーの変更</h2>
            <p className="text-slate-700 leading-relaxed">
              本ポリシーは、法令の変更やサービスの内容変更に伴い、予告なく変更される場合があります。
              変更後のポリシーは、本ページに掲載した時点で効力を生じるものとします。
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
