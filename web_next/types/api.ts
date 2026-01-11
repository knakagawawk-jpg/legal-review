// FastAPIのスキーマに対応する型定義

export interface ReviewRequest {
  problem_id?: number | null
  problem_metadata_id?: number | null
  problem_details_id?: number | null
  subject: string
  question_text?: string | null
  answer_text: string
}

export interface ReviewResponse {
  submission_id: number
  review_markdown: string
  review_json: {
    overall_review?: {
      score?: number
      comment?: string
    }
    strengths?: Array<{
      category: string
      description: string
      paragraph_numbers?: number[]
    }>
    weaknesses?: Array<{
      category: string
      description: string
      paragraph_numbers?: number[]
      suggestion?: string
    }>
    important_points?: Array<{
      paragraph_number: number
      what_is_good: string
      what_is_lacking: string
      why_important: string
    }>
    future_considerations?: string[]
  }
  answer_text: string
  question_text?: string | null
  subject?: string | null
  purpose?: string | null
}

export interface ProblemMetadata {
  id: number
  exam_type: string
  year: number
  subject: string
}

export interface ProblemDetails {
  id: number
  question_number: number
  question_text: string
  purpose?: string | null
}

export interface ProblemMetadataWithDetails {
  metadata: ProblemMetadata
  details: ProblemDetails[]
}
