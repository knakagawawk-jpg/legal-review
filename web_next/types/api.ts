// FastAPIのスキーマに対応する型定義

export interface ReviewRequest {
  official_question_id?: number | null
  problem_id?: number | null
  subject?: number | null  // 科目ID（1-18）、既存問題の場合は不要
  subject_name?: string | null  // 科目名（subjectが指定されていない場合に使用）
  question_text?: string | null
  answer_text: string
  question_title?: string | null
  reference_text?: string | null
}

export interface ReviewResponse {
  review_id?: number | null
  submission_id: number
  review_markdown: string
  review_json: {
    evaluation?: {
      overall_review?: {
        score?: number
        comment?: string
      }
      strengths?: Array<{
        block_number?: number
        category: string
        description: string
        paragraph_numbers?: number[]
      }>
      weaknesses?: Array<{
        block_number?: number
        category: string
        description: string
        paragraph_numbers?: number[]
        suggestion?: string
      }>
      important_points?: Array<{
        block_number?: number
        paragraph_number: number
        what_is_good: string
        what_is_lacking: string
        why_important: string
      }>
      future_considerations?: Array<{
        block_number?: number
        content: string
      }> | string[] // 後方互換性のためstring[]も許可
    }
    // 後方互換性のため、直接プロパティにもアクセス可能にする
    overall_review?: {
      score?: number
      comment?: string
    }
    strengths?: Array<{
      block_number?: number
      category: string
      description: string
      paragraph_numbers?: number[]
    }>
    weaknesses?: Array<{
      block_number?: number
      category: string
      description: string
      paragraph_numbers?: number[]
      suggestion?: string
    }>
    important_points?: Array<{
      block_number?: number
      paragraph_number: number
      what_is_good: string
      what_is_lacking: string
      why_important: string
    }>
    future_considerations?: Array<{
      block_number?: number
      content: string
    }> | string[] // 後方互換性のためstring[]も許可
    subject?: string
  }
  answer_text: string
  question_text?: string | null
  subject?: number | null  // 科目ID（1-18）
  subject_name?: string | null  // 科目名（表示用）
  purpose?: string | null
  question_title?: string | null
  source_type?: "official" | "custom" | null
  reference_text?: string | null
  grading_impression_text?: string | null
}

// 短答式問題関連の型定義
export interface ShortAnswerProblem {
  id: number
  exam_type: string
  year: string
  subject: number  // 科目ID（1-18）
  subject_name: string  // 科目名（表示用）
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
  subject: number  // 科目ID（1-18）
  subject_name: string  // 科目名（表示用）
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
  subject: number | null
  question_text?: string | null
  answer_text: string
  created_at: string
  review?: {
    overall_review?: {
      score?: number
      comment?: string
    }
    strengths?: Array<{
      block_number?: number
      category: string
      description: string
      paragraph_numbers?: number[]
    }>
    weaknesses?: Array<{
      block_number?: number
      category: string
      description: string
      paragraph_numbers?: number[]
      suggestion?: string
    }>
  } | null
}

/** 管理者用：全ユーザー講評履歴1件 */
export interface AdminReviewHistoryItem {
  id: number
  review_id: number
  user_id: number
  user_email: string | null
  subject: number | null
  subject_name: string | null
  exam_type: string | null
  year: number | null
  score: number | null
  attempt_count: number
  question_title: string | null
  reference_text: string | null
  created_at: string
}

/** 管理者用：全ユーザー講評履歴一覧レスポンス */
export interface AdminReviewHistoryListResponse {
  items: AdminReviewHistoryItem[]
  total: number
}

export interface ShortAnswerHistory {
  session_id: number
  exam_type: string
  year?: string | null
  subject: number  // 科目ID（1-18）
  subject_name: string  // 科目名（表示用）
  started_at: string
  completed_at?: string | null
  total_problems: number
  correct_count: number
  accuracy: number
}

// ノート機能関連の型定義
export interface Notebook {
  id: number
  subject_id: number
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
  title?: string | null
  content?: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface NotebookDetail extends Notebook {
  sections: Array<NoteSection & { pages: NotePage[] }>
}

// フリーチャット用の型定義（threads/messagesベース）
export interface Thread {
  id: number
  user_id: number
  type: string
  title?: string | null
  created_at: string
  last_message_at?: string | null
  favorite: number  // 0=OFF, 1=ON
  pinned: boolean
  review_id?: number | null  // 講評チャットの場合のreview_id
}

export interface ThreadListResponse {
  threads: Thread[]
  total: number
}

export interface Message {
  id: number
  thread_id: number
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  model?: string | null
  prompt_version?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  cost_yen?: number | null
  request_id?: string | null
}

export interface MessageListResponse {
  messages: Message[]
  total: number
}

export interface LlmRequest {
  id: number
  user_id: number
  feature_type: string
  review_id?: number | null
  thread_id?: number | null
  session_id?: number | null
  model?: string | null
  prompt_version?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  input_cost_usd?: number | null  // 入力コスト（ドル）
  output_cost_usd?: number | null  // 出力コスト（ドル）
  total_cost_usd?: number | null  // 合計コスト（ドル）
  total_cost_yen?: number | null  // 合計コスト（円）
  request_id?: string | null
  latency_ms?: number | null
  created_at: string
}

export interface LlmRequestListResponse {
  items: LlmRequest[]
  total: number
}

// 管理者用の型定義
export interface AdminUser {
  id: number
  email: string
  name?: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
  last_login_at?: string | null
  plan_code?: string | null
  plan_name?: string | null
  review_count: number
  thread_count: number
  short_answer_session_count: number
  total_tokens: number
  total_cost_yen: number
}

export interface AdminSubscriptionPlan {
  id: number
  plan_code: string
  name: string
  description?: string | null
  is_active: boolean
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
}

/** 管理者用: ユーザー別トークン使用量1件 */
export interface AdminUserTokenUsageItem {
  id: number
  email: string
  name?: string | null
  plan_code?: string | null
  plan_name?: string | null
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_yen: number
  today_tokens: number
  this_month_tokens: number
  /** 機能別コスト（Barセグメント用）。key: feature_type, value: cost_yen */
  feature_cost_yen?: Record<string, number>
}

export interface AdminUserTokenUsageListResponse {
  items: AdminUserTokenUsageItem[]
  total: number
}

export interface AdminStats {
  total_users: number
  active_users: number
  admin_users: number
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_yen: number
  feature_stats: Record<string, {
    request_count: number
    total_tokens: number
    total_input_tokens: number
    total_output_tokens: number
    total_cost_yen: number
    avg_latency_ms?: number | null
  }>
  review_count: number
  thread_count: number
  short_answer_session_count: number
  today_tokens: number
  today_cost_yen: number
  this_month_tokens: number
  this_month_cost_yen: number
}