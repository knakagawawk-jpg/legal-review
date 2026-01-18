import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（認証処理のため）
export const dynamic = 'force-dynamic'

// GET /api/notebooks/[id] - ノートブック詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notebookId = params.id
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/notebooks/${notebookId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "ノートブックの取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Notebook fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// PUT /api/notebooks/[id] - ノートブックを更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notebookId = params.id
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }
    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/v1/notebooks/${notebookId}`, {
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
        { error: errorData.detail || "ノートブックの更新に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Notebook update error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// DELETE /api/notebooks/[id] - ノートブックを削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notebookId = params.id
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/notebooks/${notebookId}`, {
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
        { error: errorData.detail || "ノートブックの削除に失敗しました" },
        { status: response.status }
      )
    }

    return NextResponse.json({ message: "Notebook deleted" })
  } catch (error: any) {
    console.error("Notebook delete error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
