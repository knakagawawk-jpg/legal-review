import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

// POST /api/reviews/[review_id]/thread - 講評チャット用スレッドを取得/作成
export async function POST(
  request: NextRequest,
  { params }: { params: { review_id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const reviewId = params.review_id
    const response = await fetch(`${BACKEND_URL}/v1/reviews/${encodeURIComponent(reviewId)}/thread`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "スレッドの取得/作成に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Review chat thread error:", error)
    return NextResponse.json({ error: error.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

