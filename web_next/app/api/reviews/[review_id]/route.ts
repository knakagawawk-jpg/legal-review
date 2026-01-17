import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

// GET /api/reviews/[review_id] - review_idで講評を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { review_id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const reviewId = params.review_id

    if (!reviewId) {
      return NextResponse.json(
        { error: "review_idが必要です" },
        { status: 400 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/reviews/${reviewId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "講評の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Review fetch error:", error)
    return NextResponse.json(
      { error: "講評の取得に失敗しました" },
      { status: 500 }
    )
  }
}
