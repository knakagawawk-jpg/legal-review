import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export const dynamic = 'force-dynamic'

// PUT /api/note-sections/[id] - ノートセクションを更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }
    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/v1/note-sections/${sectionId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "セクションの更新に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Note section update error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// DELETE /api/note-sections/[id] - ノートセクションを削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sectionId = params.id
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/v1/note-sections/${sectionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "セクションの削除に失敗しました" },
        { status: response.status }
      )
    }

    return NextResponse.json({ message: "Note section deleted" })
  } catch (error: any) {
    console.error("Note section delete error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
