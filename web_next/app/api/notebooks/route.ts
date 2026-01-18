import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（認証処理のため）
export const dynamic = 'force-dynamic'

// GET /api/notebooks - ノートブック一覧を取得
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { search } = new URL(request.url)

    const response = await fetch(`${BACKEND_URL}/v1/notebooks${search}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      // 認証エラー（401）の場合は空のリストを返す
      if (response.status === 401) {
        return NextResponse.json([])
      }
      return NextResponse.json(
        { error: errorData.detail || "ノートブック一覧の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Notebooks fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// POST /api/notebooks - ノートブックを作成
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/v1/notebooks`, {
      method: "POST",
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
        { error: errorData.detail || "ノートブックの作成に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Notebook creation error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
