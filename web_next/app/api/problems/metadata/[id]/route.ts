import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// GET /api/problems/metadata/[id] - 問題メタデータと詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const metadataId = params.id

    const response = await fetch(`${BACKEND_URL}/v1/problems/metadata/${metadataId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error", error: "問題データの取得に失敗しました" }))
      console.error("Problem metadata detail API error:", {
        status: response.status,
        statusText: response.statusText,
        metadataId,
        error: errorData
      })
      return NextResponse.json(
        { error: errorData.error || errorData.detail || `問題データの取得に失敗しました (HTTP ${response.status})` },
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
