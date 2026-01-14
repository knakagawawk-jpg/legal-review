import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（no-store fetchを使用するため）
export const dynamic = 'force-dynamic'

// GET /api/problems/subjects - 科目一覧を取得
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/problems/subjects`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "科目データの取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // デバッグ: レスポンスデータをログに出力
    console.log("Subjects API response:", {
      status: response.status,
      subjects: data.subjects,
      count: data.subjects?.length || 0,
    })
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Subjects fetch error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
