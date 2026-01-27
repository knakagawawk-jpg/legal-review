import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（request.urlを使用するため）
export const dynamic = 'force-dynamic'

// GET /api/dev/submissions - 開発用：全投稿一覧を取得（認証必須、dev環境のみ）
export async function GET(request: NextRequest) {
  // dev環境以外ではアクセス不可
  const enableDevPage = process.env.NEXT_PUBLIC_ENABLE_DEV_PAGE === "true"
  if (!enableDevPage) {
    return NextResponse.json(
      { error: "開発者用ページはdev環境でのみ利用可能です" },
      { status: 403 }
    )
  }

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "100"
    const offset = searchParams.get("offset") || "0"

    const params = new URLSearchParams()
    params.append("limit", limit)
    params.append("offset", offset)

    const url = `${BACKEND_URL}/v1/dev/submissions?${params.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "投稿一覧の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Dev submissions fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
