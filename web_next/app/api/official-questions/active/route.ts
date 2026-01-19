import { NextRequest, NextResponse } from "next/server"

// ローカル開発（npm run dev）では backend ホスト名が解決できないため localhost をデフォルトにする。
// Docker Compose（web-dev/web）では BACKEND_INTERNAL_URL が設定される想定。
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "http://backend:8000")

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shiken_type = searchParams.get("shiken_type")
    const nendo = searchParams.get("nendo")
    const subject_id = searchParams.get("subject_id")

    if (!shiken_type || !nendo || !subject_id) {
      return NextResponse.json(
        { error: "shiken_type, nendo, subject_id が必要です" },
        { status: 400 },
      )
    }

    const url = new URL(`${BACKEND_URL}/v1/official-questions/active`)
    url.searchParams.set("shiken_type", shiken_type)
    url.searchParams.set("nendo", nendo)
    url.searchParams.set("subject_id", subject_id)

    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json({ error: errorData.detail || "公式問題の取得に失敗しました" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

