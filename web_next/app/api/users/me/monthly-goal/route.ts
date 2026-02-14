// GET /api/users/me/monthly-goal?yyyymm=202502 - 指定月の目標を取得
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://backend:8000"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    const authHeader = request.headers.get("authorization")
    const headerToken = authHeader?.replace("Bearer ", "")
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const yyyymm = searchParams.get("yyyymm")
    if (!yyyymm) {
      return NextResponse.json(
        { error: "yyyymm（対象月、例: 202502）が必須です" },
        { status: 400 }
      )
    }

    const response = await fetch(
      `${BACKEND_URL}/v1/users/me/monthly-goal?yyyymm=${encodeURIComponent(yyyymm)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: (errorData as { detail?: string }).detail || "目標の取得に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "予期しないエラーが発生しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/users/me/monthly-goal - 指定月の目標を更新（upsert）
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get("auth_token")?.value
    const authHeader = request.headers.get("authorization")
    const headerToken = authHeader?.replace("Bearer ", "")
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await request.json()
    const { yyyymm, target_study_minutes, target_short_answer_count, target_review_count } = body as {
      yyyymm?: number
      target_study_minutes?: number | null
      target_short_answer_count?: number | null
      target_review_count?: number | null
    }
    if (yyyymm == null || yyyymm === "") {
      return NextResponse.json(
        { error: "yyyymm（対象月、例: 202502）が必須です" },
        { status: 400 }
      )
    }

    const response = await fetch(`${BACKEND_URL}/v1/users/me/monthly-goal`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        yyyymm: Number(yyyymm),
        target_study_minutes: target_study_minutes ?? null,
        target_short_answer_count: target_short_answer_count ?? null,
        target_review_count: target_review_count ?? null,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: (errorData as { detail?: string }).detail || "目標の保存に失敗しました" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "予期しないエラーが発生しました"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
