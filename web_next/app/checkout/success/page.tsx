import Link from "next/link"

type SearchParams = {
  from?: string
  type?: string
}

function resolveReturnPath(from?: string): string {
  if (from === "dashboard") return "/your-page/dashboard"
  if (from === "settings") return "/your-page/settings"
  return "/review"
}

function resolveTypeLabel(type?: string): string {
  if (type === "ticket") return "レビュー追加チケット"
  return "プラン購入"
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const returnPath = resolveReturnPath(params.from)
  const typeLabel = resolveTypeLabel(params.type)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">決済が完了しました</h1>
        <p className="mt-3 text-sm text-slate-700">
          {typeLabel}の決済が正常に完了しました。反映まで数秒かかる場合があります。
        </p>
        <div className="mt-6">
          <Link
            href={returnPath}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            元の画面に戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
