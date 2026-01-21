import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

// GET /api/recent-review-problems/sessions?study_date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studyDate = searchParams.get("study_date")
    const url = studyDate
      ? `${BACKEND_URL}/v1/recent-review-problems/sessions?study_date=${encodeURIComponent(studyDate)}`
      : `${BACKEND_URL}/v1/recent-review-problems/sessions`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ error: data.detail || data.error || "取得に失敗しました" }, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Recent review sessions GET error:", error)
    return NextResponse.json({ error: error.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

// POST /api/recent-review-problems/sessions  { source_session_id?: number }
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const response = await fetch(`${BACKEND_URL}/v1/recent-review-problems/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ error: data.detail || data.error || "生成に失敗しました" }, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Recent review sessions POST error:", error)
    return NextResponse.json({ error: error.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

