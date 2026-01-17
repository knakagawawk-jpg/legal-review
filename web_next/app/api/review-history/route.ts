import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

// GET /api/review-history - 講評履歴を取得
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const subject = searchParams.get("subject")
    const examType = searchParams.get("exam_type")

    let url = `${BACKEND_URL}/v1/users/me/review-history`
    const params = new URLSearchParams()
    if (subject) params.append("subject", subject)
    if (examType) params.append("exam_type", examType)
    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "講評履歴の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Review history fetch error:", error)
    return NextResponse.json(
      { error: "講評履歴の取得に失敗しました" },
      { status: 500 }
    )
  }
}
