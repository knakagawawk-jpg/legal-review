import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（認証が必要なため）
export const dynamic = 'force-dynamic'

// GET /api/users/me - 現在のユーザー情報を取得
export async function GET(request: NextRequest) {
  try {
    // クッキーからトークンを取得（優先）
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    
    // Authorizationヘッダーからトークンを取得（フォールバック）
    const authHeader = request.headers.get("authorization")
    const headerToken = authHeader?.replace("Bearer ", "")
    
    // クッキーまたはヘッダーからトークンを取得
    const token = cookieToken || headerToken
    
    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/users/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "ユーザー情報の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("User info error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}

// PUT /api/users/me - ユーザー情報を更新
export async function PUT(request: NextRequest) {
  try {
    // クッキーからトークンを取得（優先）
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    
    // Authorizationヘッダーからトークンを取得（フォールバック）
    const authHeader = request.headers.get("authorization")
    const headerToken = authHeader?.replace("Bearer ", "")
    
    // クッキーまたはヘッダーからトークンを取得
    const token = cookieToken || headerToken
    
    if (!token) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const body = await request.json()

    const response = await fetch(`${BACKEND_URL}/v1/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "ユーザー情報の更新に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("User update error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
