// GET /api/users/me/plan-limits - プラン制限と使用量を取得
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（認証が必要なため）
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // クッキーからトークンを取得（優先）
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    
    // Authorizationヘッダーからトークンを取得（フォールバック）
    const authHeader = request.headers.get("authorization")
    const headerToken = authHeader?.replace("Bearer ", "")
    
    // クッキーまたはヘッダーからトークンを取得
    const token = cookieToken || headerToken
    
    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/users/me/plan-limits`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text()
      let errorDetail: string
      try {
        const errorData = text ? JSON.parse(text) : {}
        const d = errorData.detail ?? errorData.error
        if (typeof d === "string") errorDetail = d
        else if (Array.isArray(d) && d.length) errorDetail = d[0]?.msg ?? String(d[0])
        else errorDetail = "プラン制限情報の取得に失敗しました"
      } catch {
        errorDetail = text || "プラン制限情報の取得に失敗しました"
      }
      console.error("[plan-limits] Backend error:", response.status, errorDetail)
      return NextResponse.json(
        { error: typeof errorDetail === "string" ? errorDetail : "プラン制限情報の取得に失敗しました" },
        { status: response.status }
      )
    }

    const text = await response.text()
    try {
      const data = text ? JSON.parse(text) : {}
      return NextResponse.json(data)
    } catch (e) {
      console.error("[plan-limits] Backend response JSON parse error:", e)
      return NextResponse.json(
        { error: "レスポンスの解析に失敗しました" },
        { status: 502 }
      )
    }
  } catch (error: any) {
    console.error("[plan-limits] Request error:", error?.message ?? error)
    const message = error?.message || (typeof error === "string" ? error : "予期しないエラーが発生しました")
    return NextResponse.json(
      { error: message.includes("fetch") ? "バックエンドに接続できません。環境変数 BACKEND_INTERNAL_URL を確認してください。" : message },
      { status: 500 }
    )
  }
}
