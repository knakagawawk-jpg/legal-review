import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

// 動的ルートとしてマーク（認証処理のため）
export const dynamic = 'force-dynamic'

// POST /api/auth/google - Google認証
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: "トークンが提供されていません" },
        { status: 400 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.detail || "認証に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // バックエンドから返されたJWTトークン（またはGoogle IDトークン）をクッキーに設定
    const authToken = data.access_token || token
    const cookieStore = await cookies()
    
    // クッキーにトークンを設定（30日間有効）
    cookieStore.set("auth_token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30日
      path: "/",
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Auth error:", error)
    return NextResponse.json(
      { error: error.message || "予期しないエラーが発生しました" },
      { status: 500 }
    )
  }
}
