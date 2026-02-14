"use client"

import { useParams, useSearchParams } from "next/navigation"
import { ReviewResultView } from "@/app/your-page/review/[review_id]/page"
import { withAuth } from "@/components/auth/with-auth"

function DevReviewPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const reviewId = params.review_id as string
  const threadIdFromUrl = searchParams.get("thread_id")
  const databaseUrl = searchParams.get("database_url")

  return (
    <ReviewResultView
      reviewId={reviewId}
      threadIdFromUrl={threadIdFromUrl}
      databaseUrl={databaseUrl}
      backHref="/dev"
      backLabel="管理者ページに戻る"
      reviewPathPrefix="/dev/review"
    />
  )
}

export default withAuth(DevReviewPageInner, { requireAuth: true })
