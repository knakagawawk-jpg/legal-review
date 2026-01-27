import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://localhost:8000"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const params = new URLSearchParams()
    
    const passthroughKeys = ["database_url"]
    for (const key of passthroughKeys) {
      const value = searchParams.get(key)
      if (value) params.append(key, value)
    }

    let url = `${BACKEND_URL}/v1/admin/stats`
    if (params.toString()) {
      url += `?${params.toString()}`
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || "統計情報の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Admin stats fetch error:", error)
    return NextResponse.json(
      { error: "統計情報の取得に失敗しました" },
      { status: 500 }
    )
  }
}
