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
    evaluation?: {
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
    // 後方互換性のため、直接プロパティにもアクセス可能にする
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
    subject?: string
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

// 短答式問題関連の型定義
export interface ShortAnswerProblem {
  id: number
  exam_type: string
  year: string
  subject: string
  question_number: number
  question_text: string
  choice_1: string
  choice_2: string
  choice_3: string
  choice_4?: string | null
  correct_answer: string
  correctness_pattern: string
  source_pdf?: string | null
  created_at: string
  updated_at: string
}

export interface ShortAnswerSession {
  id: number
  exam_type: string
  year?: string | null
  subject: string
  is_random: boolean
  problem_ids: number[]
  started_at: string
  completed_at?: string | null
}

export interface ShortAnswerAnswer {
  id: number
  session_id: number
  problem_id: number
  selected_answer?: string | null
  is_correct?: boolean | null
  answered_at: string
}

// 過去の記録関連の型定義
export interface SubmissionHistory {
  id: number
  subject: string
  question_text?: string | null
  answer_text: string
  created_at: string
  review?: {
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
  } | null
}

export interface ShortAnswerHistory {
  session_id: number
  exam_type: string
  year?: string | null
  subject: string
  started_at: string
  completed_at?: string | null
  total_problems: number
  correct_count: number
  accuracy: number
}

// ノート機能関連の型定義
export interface Notebook {
  id: number
  title: string
  description?: string | null
  color?: string | null
  created_at: string
  updated_at: string
}

export interface NoteSection {
  id: number
  notebook_id: number
  title: string
  display_order: number
  created_at: string
  updated_at: string
  pages?: NotePage[]
}

export interface NotePage {
  id: number
  section_id: number
  title: string
  content?: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface NotebookDetail extends Notebook {
  sections: Array<NoteSection & { pages: NotePage[] }>
}
