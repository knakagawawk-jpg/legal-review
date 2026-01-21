import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

// POST /api/recent-review-problems/problems/[id]/save
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const problemId = params.id
    const response = await fetch(
      `${BACKEND_URL}/v1/recent-review-problems/problems/${encodeURIComponent(problemId)}/save`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        cache: "no-store",
      }
    )

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ error: data.detail || data.error || "保存に失敗しました" }, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Recent review problem save error:", error)
    return NextResponse.json({ error: error.message || "予期しないエラーが発生しました" }, { status: 500 })
  }
}

