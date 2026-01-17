import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// 動的ルートとしてマーク（認証処理のため）
export const dynamic = 'force-dynamic'

// POST /api/auth/logout - ログアウト
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    // クッキーからトークンを削除
    cookieStore.delete("auth_token")
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: error.message || "ログアウトに失敗しました" },
      { status: 500 }
    )
  }
}
