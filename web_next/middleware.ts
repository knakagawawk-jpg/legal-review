import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Next.js Middleware
 * 認証が必要なページへのアクセスを制御
 */

// 認証が必要なパス
const protectedPaths = [
  "/your-page",
  "/your-page/dashboard",
  "/your-page/notes",
  "/your-page/past-questions",
  "/your-page/subjects",
  "/dev",
]

// 認証が不要なパス（認証ページなど）
const publicPaths = [
  "/",
  "/review",
  "/free-chat",
  "/short-answer",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 保護されたパスかチェック
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path))
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"))

  // 保護されたパスへのアクセス
  if (isProtectedPath) {
    // 認証トークンの確認
    const token = request.cookies.get("auth_token")?.value || 
                  request.headers.get("authorization")?.replace("Bearer ", "")

    if (!token) {
      // トークンがない場合はリダイレクト（クライアント側で処理）
      // ここではリダイレクトせず、クライアント側のwithAuthで処理
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 以下のパスにマッチ:
     * - /api (API routes)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - その他のすべてのパス
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
