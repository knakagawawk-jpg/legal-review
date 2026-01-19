import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shiken_type = searchParams.get("shiken_type")

    const url = new URL(`${BACKEND_URL}/v1/official-questions/years`)
    if (shiken_type) url.searchParams.set("shiken_type", shiken_type)

    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json({ error: errorData.detail || "年度の取得に失敗しました" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

