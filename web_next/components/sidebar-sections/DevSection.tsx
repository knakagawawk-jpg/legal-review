"use client"

// 開発用機能のサイドバーセクション
// dev環境でのみ表示
export function DevSection() {
  // dev環境以外では表示しない
  const enableDevPage = process.env.NEXT_PUBLIC_ENABLE_DEV_PAGE === "true"
  if (!enableDevPage) {
    return null
  }

  return null // 現在は何も表示しない（将来実装予定）
}
