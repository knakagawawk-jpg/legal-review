import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（request.urlを使用するため）
export const dynamic = 'force-dynamic'

// GET /api/users/me/short-answer-sessions - 自分の短答式セッション一覧を取得（認証オプション）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "50"
    const offset = searchParams.get("offset") || "0"

    const params = new URLSearchParams()
    params.append("limit", limit)
    params.append("offset", offset)

    const url = `${BACKEND_URL}/v1/users/me/short-answer-sessions?${params.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      // 認証エラー（401）の場合は空のリストを返す
      if (response.status === 401) {
        return NextResponse.json([])
      }
      return NextResponse.json(
        { error: errorData.detail || "セッション一覧の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Short answer sessions fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
