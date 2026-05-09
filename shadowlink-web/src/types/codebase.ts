export type CodebaseProfileStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface CodebaseProfile {
  repo_id: string
  name: string
  repo_path: string
  status: CodebaseProfileStatus
  last_indexed_at?: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export interface CodebaseTechnicalDoc {
  repo_id: string
  overview: string
  tech_stack: string[]
  architecture_summary: string
  module_map: string[]
  key_flows: string[]
  important_files: string[]
  interview_talking_points: string[]
  risks_and_todos: string[]
  followup_questions: string[]
  raw_markdown: string
  updated_at: string
}

export interface CodebaseProfileDetail {
  profile: CodebaseProfile
  doc: CodebaseTechnicalDoc | null
}
