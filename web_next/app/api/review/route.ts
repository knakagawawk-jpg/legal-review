import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
// 講評生成のタイムアウト（デフォルト: 10分 = 600000ms）
// 注意: この値はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
// 講評生成は2段階処理（JSON化→評価）のため、長い答案では時間がかかります。
const REVIEW_TIMEOUT_MS = parseInt(process.env.REVIEW_TIMEOUT_MS || "600000", 10)

// Next.js App Routerの最大実行時間を10分に設定
// 注意: この値はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
export const maxDuration = 600 // 10分（秒単位）

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
      // タイムアウト（環境変数 REVIEW_TIMEOUT_MS で設定可能、デフォルト: 600秒 = 10分）
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
      const timeoutMinutes = Math.floor(REVIEW_TIMEOUT_MS / 60000)
      return NextResponse.json(
        { 
          error: `講評の生成に時間がかかりすぎています（${timeoutMinutes}分以上）。ネットワークやAPIの応答が遅い可能性があります。しばらく待ってから再度お試しください。または、答案の長さを短くして再試行してください。`
        },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
