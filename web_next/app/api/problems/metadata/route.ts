import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// GET /api/problems/metadata - 問題メタデータ一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const examType = searchParams.get("exam_type")
    const year = searchParams.get("year")
    const subject = searchParams.get("subject")

    // クエリパラメータを構築
    const params = new URLSearchParams()
    if (examType) params.append("exam_type", examType)
    if (year) params.append("year", year)
    if (subject) params.append("subject", subject)

    const url = `${BACKEND_URL}/v1/problems/metadata${params.toString() ? `?${params.toString()}` : ""}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "問題データの取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Problem metadata fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
