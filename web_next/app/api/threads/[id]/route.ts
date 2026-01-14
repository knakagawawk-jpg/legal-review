import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// GET /api/threads/[id] - スレッド詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const threadId = params.id

    const response = await fetch(`${BACKEND_URL}/v1/threads/${threadId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "スレッドの取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Thread get error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
