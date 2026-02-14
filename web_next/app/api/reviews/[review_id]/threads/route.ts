import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

// GET /api/reviews/[review_id]/threads - 同一答案に紐づくスレッド一覧
export async function GET(
  request: NextRequest,
  { params }: { params: { review_id: string } }
) {
  try {
    const review_id = params.review_id
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(
      `${BACKEND_URL}/v1/reviews/${encodeURIComponent(review_id)}/threads`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "スレッド一覧の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Review threads list error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// POST /api/reviews/[review_id]/threads - 新規スレッド作成（新規タブ用）
export async function POST(
  request: NextRequest,
  { params }: { params: { review_id: string } }
) {
  try {
    const review_id = params.review_id
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(
      `${BACKEND_URL}/v1/reviews/${encodeURIComponent(review_id)}/threads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "スレッドの作成に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error("Review thread create error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
