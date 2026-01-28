"use client"

import { SidebarToggle, useSidebar } from "@/components/sidebar"
import { Scale, FileText, Shield, AlertTriangle, ExternalLink, Cookie, Bot, Globe, Users, Clock, Lock, Mail, Building, Info } from "lucide-react"
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
            <h1 className="text-2xl font-bold text-slate-800">Juristutor-AI プライバシーポリシー・Cookieポリシー</h1>
            <p className="text-sm text-slate-500">最終更新日: 2025年1月28日</p>
          </div>
        </div>

        {/* 導入文 */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-slate-700 leading-relaxed">
            Juristutor-AI（以下「当サービス」）は、当社における個人情報及びCookie等の取扱いについて、以下のとおりプライバシーポリシー・Cookieポリシー（以下「本ポリシー」といいます。）を定めます。
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          {/* 1. 定義 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">1. 定義</h2>
            </div>
            <div className="space-y-4 text-slate-700">
              <div className="pl-4 border-l-2 border-indigo-200">
                <p className="font-medium text-slate-800">「個人情報」</p>
                <p className="text-sm leading-relaxed">
                  個人情報の保護に関する法律（平成十五年法律第五十七号、以下「法」といいます。）第2条第1項にいう「個人情報」を指し、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日その他の記述等により特定の個人を識別できるもの又は個人識別符号が含まれるものを指します。
                </p>
              </div>
              <div className="pl-4 border-l-2 border-indigo-200">
                <p className="font-medium text-slate-800">「個人データ」</p>
                <p className="text-sm leading-relaxed">
                  法第16条第3項にいう「個人データ」を指し、個人情報データベース等を構成する個人情報を指します。
                </p>
              </div>
              <div className="pl-4 border-l-2 border-indigo-200">
                <p className="font-medium text-slate-800">「保有個人データ」</p>
                <p className="text-sm leading-relaxed">
                  法第16条第4項にいう「保有個人データ」を指し、当社が、開示、内容の訂正、追加又は削除、利用の停止、消去及び第三者への提供の停止を行うことのできる権限を有する個人データであって、その存否が明らかになることにより公益その他の利益が害されるものとして政令で定めるもの又は一年以内の政令で定める期間以内に消去することとなるもの以外のものをいいます。
                </p>
              </div>
            </div>
          </section>

          {/* 2. 取得する情報・目的 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">2. 取得する情報・目的</h2>
            </div>
            <p className="text-slate-700 mb-4">当サービスは、以下に定める目的で、ユーザーから以下の情報を取得します。</p>

            <div className="space-y-6">
              {/* 2.1 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">2.1</span>
                  アカウント・認証情報
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>Googleアカウント情報（メールアドレス、名前、プロフィール画像）</li>
                  <li>認証トークン（JWT 等）</li>
                </ul>
              </div>

              {/* 2.2 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">2.2</span>
                  ユーザーが投稿・入力する情報
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>答案本文、チャット入力、学習メモ、学習記録、その他当サービス上でユーザーが入力・送信するテキスト等</li>
                </ul>

                {/* 注意ボックス */}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">注意（個人情報の入力禁止）</p>
                      <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                        答案・チャット等の入力欄に、氏名、住所、電話番号、メールアドレス、勤務先・所属先、その他の個人情報を入力しないようユーザーに求めます。ユーザーがこれらを入力した場合、当サービスは当該情報を取得することがあります（取得した場合は本ポリシーに従い取り扱います）。なお、ユーザーが本項に違反して個人情報を入力した場合、当該入力に起因して生じた損害について、当サービスは一切の責任を負いません。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2.3 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">2.3</span>
                  利用状況・ログ情報
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>IPアドレス</li>
                  <li>User-Agent（ブラウザ情報）</li>
                  <li>リファラー（参照元URL）</li>
                  <li>アクセス日時</li>
                  <li>操作ログ（ページ遷移、機能の利用状況、エラー情報等）</li>
                  <li>LLM利用に関する情報（例：リクエスト回数、推定トークン数、会話継続長、機能別利用頻度 等）</li>
                </ul>
              </div>

              {/* 2.4 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">2.4</span>
                  利用目的
                </h3>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>当サービスの提供・運営</li>
                  <li>ユーザー認証・本人確認</li>
                  <li>不正アクセス防止・セキュリティ対策</li>
                  <li>サービス改善・機能開発</li>
                  <li>統計データの作成及び分析</li>
                  <li>本サービスの本人への宣伝広告</li>
                  <li>本サービスの更新情報その他本サービスに関連するサービス等のユーザーへの案内</li>
                  <li>お問い合わせ対応その他重要な連絡</li>
                  <li>利用規約違反等への対応</li>
                  <li>その他上記目的に関連する目的</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Cookie・ローカルストレージ等の利用 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cookie className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">3. Cookie・ローカルストレージ等の利用</h2>
            </div>
            <p className="text-slate-700 mb-4">
              当サービスは、利便性向上・認証等のため、以下の通りCookie及びユーザーのローカルストレージ等を利用します。Cookie等の利用に関する同意は、当サービスの設定画面等からいつでも変更・撤回できます。ただし、必須Cookieを無効化した場合、当サービスの提供ができないことがあります。
            </p>

            <div className="space-y-6">
              {/* 3.1 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">3.1</span>
                  必須Cookie
                </h3>
                <p className="text-slate-700 mb-3 text-sm">
                  サービス利用に不可欠なCookieです。これらに同意しない場合、サービスを利用できません。
                </p>

                {/* テーブル */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-3 py-2 text-left font-medium text-slate-700">クッキー等の名称</th>
                        <th className="border border-slate-300 px-3 py-2 text-left font-medium text-slate-700">送信先</th>
                        <th className="border border-slate-300 px-3 py-2 text-left font-medium text-slate-700">取得する情報</th>
                        <th className="border border-slate-300 px-3 py-2 text-left font-medium text-slate-700">利用目的</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 px-3 py-2 text-slate-700">Google認証トークン</td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-700">Google LLC</td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-700">
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>IPアドレス</li>
                            <li>Google ID トークン</li>
                            <li>端末固有のユニークID</li>
                            <li>通信に伴い送信され得る情報（IPアドレス、User-Agent、リファラー等）</li>
                          </ul>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-slate-700">
                          ログイン機能の提供、認証・本人確認、不正アクセス防止
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-slate-600 mt-3">
                  ※グーグル合同会社のプライバシーポリシーについては、以下のページをご参照ください。
                </p>
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline mt-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Google LLCのプライバシーポリシー
                </a>
              </div>

              {/* 3.2 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">3.2</span>
                  機能Cookie／ローカルストレージ
                </h3>
                <p className="text-slate-700 mb-3 text-sm">
                  快適性向上のための保存領域です。同意しない場合でも基本機能は利用できます。
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4 text-sm">
                  <li>サイドバーの開閉状態、パネル幅、入力中のテキスト（一時保存）等本サービス表示に関する諸情報</li>
                  <li>その他ユーザーによる当サービスの利用状態の一時保存</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4. AI機能（LLM）の提供に関する委託 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">4. AI機能（LLM）の提供に関する委託</h2>
            </div>

            <div className="space-y-4 text-slate-700">
              <div className="pl-4 border-l-2 border-slate-200">
                <p className="font-medium text-slate-800 text-sm">4.1</p>
                <p className="text-sm leading-relaxed">
                  当サービスは、答案レビューや学習支援チャット等のAI機能提供のため、当サービスが適切と判断するLLM提供事業者（以下「LLM事業者」）のAPI等を利用しています。LLM事業者のサービス内容、品質、可用性等について、当サービスは一切の保証を行いません。
                </p>
              </div>
              <div className="pl-4 border-l-2 border-slate-200">
                <p className="font-medium text-slate-800 text-sm">4.2</p>
                <p className="text-sm leading-relaxed mb-2">
                  上記の場合、ユーザーの入力内容（答案・チャット・ノート等のテキスト）をLLM事業者に送信して処理させることがあります。
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-4">
                  <li><span className="font-medium">送信される情報：</span>AI機能に入力されたテキスト（答案、チャット等）</li>
                  <li><span className="font-medium">送信しない情報：</span>ユーザーの氏名・メールアドレス等、ユーザー入力以外の当サービスが保有するユーザーの個人データ</li>
                  <li><span className="font-medium">利用目的：</span>AI機能の提供</li>
                </ul>
              </div>
            </div>

            {/* 重要ボックス */}
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">重要：個人情報をユーザー入力に含めないでください</p>
                  <p className="text-sm text-red-700 mt-1 leading-relaxed">
                    ユーザーの入力したデータの一部は、ユーザーの当サービス利用（講評、チャット、復習問題生成等のAPI連携サービス）により、LLM事業者に送信されます。ユーザー入力にユーザー及び第三者の個人情報を含めないよう注意してください。なお、LLM事業者への送信は特定のユーザーidとは結びつかない形で送信するため、ユーザーの登録情報がLLM事業者に送られることはありませんのでご安心ください。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. 外国にある第三者への提供に関する同意 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">5. 外国にある第三者への提供に関する同意</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">
              当サービスは、LLM事業者等が外国に所在する場合、当該LLM事業者等に対し、AI機能提供に必要な範囲で、ユーザー入力テキスト等の取扱いを委託（提供）することがあります。
            </p>
            <p className="text-slate-700 leading-relaxed mt-2">
              なお当サービスは、性能・安全性・継続性等の観点から、LLM事業者を変更する可能性があります。
            </p>
          </section>

          {/* 6. 個人データの第三者提供及び取扱いの委託 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">6. 個人データの第三者提供及び取扱いの委託</h2>
            </div>

            <div className="space-y-6">
              {/* 6.1 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">6.1</span>
                  第三者提供
                </h3>
                <p className="text-slate-700 mb-3 text-sm">
                  当社は、次に掲げる場合を除き、利用者等本人の同意がない限り、個人データを第三者に提供しません。
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4 text-sm">
                  <li>法令に基づく場合</li>
                  <li>人の生命、身体又は財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                  <li>公衆衛生の向上又は児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                  <li>国の機関若しくは地方公共団体又はその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                </ul>
              </div>

              {/* 6.2 */}
              <div>
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">6.2</span>
                  取扱いの委託
                </h3>
                <p className="text-slate-700 text-sm leading-relaxed">
                  当サービスは、利用目的の達成に必要な範囲内において、個人データの全部又は一部の取扱いを委託する場合があります。この場合、当社は、委託先としての適格性を十分審査するとともに、契約にあたって守秘義務に関する事項等を定め、委託先に対する必要かつ適切な監督を行います。
                </p>
              </div>
            </div>
          </section>

          {/* 7. 保存期間 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">7. 保存期間</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">
              当サービスは、利用目的の達成に必要な期間、または法令上必要な期間、情報を保存します。
            </p>
          </section>

          {/* 8. 安全管理措置 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">8. 安全管理措置</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">
              当サービスは、個人情報・個人データの漏えい、滅失、毀損の防止その他安全管理のため、適切な技術的・組織的措置を講じます。
            </p>
          </section>

          {/* 9. 委託先の監督 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">9. 委託先の監督</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-2">
              当サービスは、ホスティング、認証、AI機能等、当サービス運営に必要な範囲で、個人情報・個人データの取扱いを外部事業者へ委託することがあります。
            </p>
            <p className="text-slate-700 leading-relaxed">
              この場合、当サービスは委託先を適切に選定し、契約等により安全管理を担保し、必要かつ適切な監督を行います。
            </p>
          </section>

          {/* 10. 開示等の請求・お問い合わせ */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">10. 開示等の請求・お問い合わせ</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-3">
              ユーザーは、法令に基づき、当サービスが保有する保有個人データの開示、訂正、利用停止等を求めることができます。ただし、法その他の法令により、当サービスが開示等の義務を負わない場合には、この限りではありません。なお、これらの請求につきましては、実費をもとに合理的な範囲で手数料をいただく場合があります。
            </p>
            <div className="bg-slate-50 rounded-lg p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-slate-600" />
              <div>
                <p className="text-sm text-slate-600">お問い合わせ窓口</p>
                <a href="mailto:note.shihoushiken@gmail.com" className="text-indigo-600 hover:underline font-medium">
                  note.shihoushiken@gmail.com
                </a>
              </div>
            </div>
          </section>

          {/* 11. ポリシーの変更 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">11. ポリシーの変更</h2>
            </div>
            <p className="text-slate-700 leading-relaxed mb-2">
              当サービスは、法令改正、機能追加、委託先変更等に伴い、本ポリシーを変更することがあります。変更後の内容は、本ページに掲載した時点で効力を生じます。
            </p>
            <p className="text-slate-700 leading-relaxed">
              重要な変更（越境提供の範囲拡大等）については、合理的な方法で周知します。
            </p>
          </section>

          {/* 12. 事業者情報 */}
          <section className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-slate-800 m-0">12. 事業者情報</h2>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 w-24">サービス名</span>
                <span className="text-slate-800 font-medium">Juristutor-AI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 w-24">代表者</span>
                <span className="text-slate-800 font-medium">弁護士太郎</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 w-24">連絡先</span>
                <a href="mailto:note.shihoushiken@gmail.com" className="text-indigo-600 hover:underline">
                  note.shihoushiken@gmail.com
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
