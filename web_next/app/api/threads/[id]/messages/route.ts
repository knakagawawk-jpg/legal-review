import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// GET /api/threads/[id]/messages - メッセージ一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const threadId = params.id
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "200"
    const offset = searchParams.get("offset") || "0"

    const url = `${BACKEND_URL}/v1/threads/${threadId}/messages?limit=${limit}&offset=${offset}`
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "メッセージ一覧の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Messages list error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// POST /api/threads/[id]/messages - メッセージを送信
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const threadId = params.id
    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "メッセージの送信に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Message create error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
