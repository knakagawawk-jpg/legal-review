import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
const REVIEW_TIMEOUT_MS = parseInt(process.env.REVIEW_TIMEOUT_MS || "240000", 10)

// POST /api/review - 講評を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // FastAPIの /v1/review にリクエストを転送
    const response = await fetch(`${BACKEND_URL}/v1/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // タイムアウト（環境変数 REVIEW_TIMEOUT_MS で設定可能、デフォルト: 240秒）
      signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
      // キャッシュ無効（常に最新のデータを取得）
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "講評の生成に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Review generation error:", error)
    
    // タイムアウトエラーの処理
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "講評の生成がタイムアウトしました。時間を置いて再度お試しください。" },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
