import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"
// 講評生成のタイムアウト（デフォルト: 10分 = 600000ms）
// 注意: この値はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
// 講評生成は2段階処理（JSON化→評価）のため、長い答案では時間がかかります。
const REVIEW_TIMEOUT_MS = parseInt(process.env.REVIEW_TIMEOUT_MS || "600000", 10)

// Next.js App Routerの最大実行時間を10分に設定
// 注意: この値はユーザーが明示的に指定したものです。AIが勝手に変更しないでください。
export const maxDuration = 600 // 10分（秒単位）

// cookiesを参照するため動的ルート扱い
export const dynamic = "force-dynamic"

// POST /api/review - 講評を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    const authHeader = request.headers.get("authorization") || (token ? `Bearer ${token}` : null)

    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // FastAPIの /v1/review にリクエストを転送
    const response = await fetch(`${BACKEND_URL}/v1/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
      // タイムアウト（環境変数 REVIEW_TIMEOUT_MS で設定可能、デフォルト: 600秒 = 10分）
      signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS),
      // キャッシュ無効（常に最新のデータを取得）
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      const errorMessage = errorData.detail || "講評の生成に失敗しました"
      
      // API側のタイムアウトエラーを検出（FastAPIから返されるエラーメッセージに"timeout"が含まれる場合）
      if (response.status === 500 && errorMessage.toLowerCase().includes("timeout")) {
        return NextResponse.json(
          { 
            error: `API側でタイムアウトが発生しました。Anthropic APIの応答が遅い可能性があります。しばらく待ってから再度お試しください。エラー詳細: ${errorMessage}`
          },
          { status: 504 }
        )
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Review generation error:", error)
    
    // タイムアウトエラーの処理（クライアント側のタイムアウト）
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      const timeoutMinutes = Math.floor(REVIEW_TIMEOUT_MS / 60000)
      return NextResponse.json(
        { 
          error: `クライアント側のタイムアウトが発生しました（${timeoutMinutes}分以上経過）。FastAPIバックエンドへの接続がタイムアウトしました。ネットワークの問題やバックエンドの応答が遅い可能性があります。しばらく待ってから再度お試しください。`
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
