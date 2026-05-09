export type SpaceType = 'ai_engineer' | 'product_manager' | 'japanese_exam' | 'custom'

export interface JobSpace {
  space_id: string
  name: string
  type: SpaceType
  theme: string
  created_at: string
  updated_at: string
}

export interface SpaceProfile {
  space_id: string
  resume_text: string
  jd_text: string
  target_company: string
  target_role: string
  notes: string
  updated_at: string
}

export interface SpaceDetail {
  space: JobSpace
  profile: SpaceProfile
}

export interface InterviewSession {
  session_id: string
  space_id: string
  title: string
  mode: 'interview_agent' | 'reading_workspace'
  status: 'queued' | 'running' | 'waiting_user_review' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface InterviewReview {
  review_id: string
  space_id: string
  session_id: string
  original_answer: string
  suggested_answer: string
  critique: string
  token_usage: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected' | 'regenerated'
  created_at: string
}

export interface InterviewQuestion {
  question: string
  focus: string
  answer_hint: string
}

export interface InterviewSkill {
  skill_id: string
  name: string
  description: string
  instruction: string
  source: string
  created_at: string
  updated_at: string
}

export interface GenerateInterviewQuestionsResponse {
  questions: InterviewQuestion[]
  provider: 'llm' | 'local_fallback' | string
  message: string
}

export interface ParsedResumeResponse {
  filename: string
  content: string
}

export interface ExternalAgentRun {
  run_id: string
  space_id: string
  session_id: string
  provider: 'codex_cli' | 'claude_code'
  repo_path: string
  prompt: string
  status: 'queued' | 'running' | 'waiting_user_review' | 'completed' | 'failed'
  output_summary: string
  error_message: string
  created_at: string
  updated_at: string
}

export interface SentenceExplanation {
  sentence: string
  grammar_note: string
  context_note: string
  vocabulary_note: string
}

export interface ReadingProgress {
  space_id: string
  article_id: string
  article_title: string
  completed_count: number
  total_count: number
  difficult_sentences: string[]
  updated_at: string
}
