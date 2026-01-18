import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export const dynamic = "force-dynamic"

// DELETE /api/study-tags/:id - タグ候補を削除
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/v1/study-tags/${encodeURIComponent(params.id)}`, {
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
        { error: errorData.detail || "タグ候補の削除に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({ message: "deleted" }))
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Study tag delete error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

