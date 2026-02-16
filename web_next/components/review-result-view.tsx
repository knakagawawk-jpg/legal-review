"use client"

/**
 * 答案結果表示の共通コンポーネント。
 * review/[id]（講評生成ページ）、your-page/review/[review_id]、dev/review/[review_id]（管理者・LLM確認）で利用。
 * 親から backHref / backLabel / databaseUrl / reviewPathPrefix / enableMultiThreadChat を渡すことで表示を切り替える。
 */
export type { ReviewResultViewProps } from "@/app/your-page/review/[review_id]/page"
export { ReviewResultView } from "@/app/your-page/review/[review_id]/page"
