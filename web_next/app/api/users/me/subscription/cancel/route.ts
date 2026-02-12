import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value || request.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/v1/users/me/subscription/cancel`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "解約に失敗しました" },
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
