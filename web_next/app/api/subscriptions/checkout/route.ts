import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    const authHeader = request.headers.get("authorization") || (token ? `Bearer ${token}` : null)

    if (!authHeader) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/v1/subscriptions/checkout`, {
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
        { error: errorData.detail || "プラン購入の開始に失敗しました" },
        { status: response.status }
      )
    }

    return NextResponse.json(await response.json())
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
