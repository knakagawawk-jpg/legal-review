"use client"

import { useParams, useSearchParams } from "next/navigation"
import { ReviewResultView } from "@/components/review-result-view"

export default function ReviewResultPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const reviewId = params.id as string
  const threadIdFromUrl = searchParams.get("thread_id")

  return (
    <ReviewResultView
      reviewId={reviewId}
      threadIdFromUrl={threadIdFromUrl}
      backHref="/review"
      backLabel="講評生成ページに戻る"
      enableMultiThreadChat={false}
    />
  )
}
