import type { ApiResult } from '@/types'
import type { ExternalAgentRun, GenerateInterviewQuestionsResponse, InterviewReview, InterviewSession, InterviewSkill, ParsedResumeResponse, ReadingProgress, SentenceExplanation, SpaceDetail, SpaceProfile, SpaceType } from '@/types/interview'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/v1/interview${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const body: ApiResult<T> = await response.json()
  if (!body.success) {
    throw new Error(body.message)
  }
  return body.data as T
}

export const interviewApi = {
  listSpaces(): Promise<SpaceDetail[]> {
    return request<SpaceDetail[]>('/spaces')
  },

  createSpace(name: string, type: SpaceType, theme: string): Promise<SpaceDetail> {
    return request<SpaceDetail>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, type, theme }),
    })
  },

  updateProfile(spaceId: string, profile: Omit<SpaceProfile, 'space_id' | 'updated_at'>): Promise<SpaceProfile> {
    return request<SpaceProfile>(`/spaces/${spaceId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    })
  },

  listSkills(): Promise<InterviewSkill[]> {
    return request<InterviewSkill[]>('/skills')
  },

  createSkill(skill: Pick<InterviewSkill, 'name' | 'description' | 'instruction'>): Promise<InterviewSkill> {
    return request<InterviewSkill>('/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
    })
  },

  updateSkill(skillId: string, skill: Pick<InterviewSkill, 'name' | 'description' | 'instruction'>): Promise<InterviewSkill> {
    return request<InterviewSkill>(`/skills/${skillId}`, {
      method: 'PUT',
      body: JSON.stringify(skill),
    })
  },

  deleteSkill(skillId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/skills/${skillId}`, { method: 'DELETE' })
  },

  async uploadSkill(file: File): Promise<InterviewSkill> {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/v1/interview/skills/upload', { method: 'POST', body: form })
    if (!response.ok) throw new Error(await response.text())
    const body: ApiResult<{ skill: InterviewSkill }> = await response.json()
    if (!body.success) throw new Error(body.message)
    return body.data?.skill as InterviewSkill
  },

  async parseResume(spaceId: string, file: File): Promise<ParsedResumeResponse> {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`/v1/interview/spaces/${spaceId}/profile/resume/parse`, {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      throw new Error(await response.text())
    }
    const body: ApiResult<ParsedResumeResponse> = await response.json()
    if (!body.success) {
      throw new Error(body.message)
    }
    return body.data as ParsedResumeResponse
  },

  generateQuestions(
    spaceId: string,
    count = 5,
    difficulty = 'mixed',
    interviewerSkill = 'technical_interviewer',
    llmConfig?: unknown,
    codebaseRepoId?: string,
  ): Promise<GenerateInterviewQuestionsResponse> {
    return request<GenerateInterviewQuestionsResponse>(`/spaces/${spaceId}/interview/questions`, {
      method: 'POST',
      body: JSON.stringify({ count, difficulty, interviewer_skill: interviewerSkill, llm_config: llmConfig, codebase_repo_id: codebaseRepoId || null }),
    })
  },

  listSessions(spaceId: string): Promise<InterviewSession[]> {
    return request<InterviewSession[]>(`/spaces/${spaceId}/sessions`)
  },

  createSession(spaceId: string, title: string): Promise<InterviewSession> {
    return request<InterviewSession>(`/spaces/${spaceId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  },

  listReviews(spaceId: string, sessionId: string): Promise<InterviewReview[]> {
    return request<InterviewReview[]>(`/spaces/${spaceId}/sessions/${sessionId}/reviews`)
  },

  createReview(
    spaceId: string,
    sessionId: string,
    originalAnswer: string,
    reviewerProvider?: string,
    repoPath?: string,
    interviewerSkill = 'technical_interviewer',
    llmConfig?: unknown,
    codebaseRepoId?: string,
  ): Promise<InterviewReview> {
    return request<InterviewReview>(`/spaces/${spaceId}/sessions/${sessionId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        original_answer: originalAnswer,
        reviewer_provider: reviewerProvider,
        repo_path: repoPath,
        interviewer_skill: interviewerSkill,
        llm_config: llmConfig,
        codebase_repo_id: codebaseRepoId || null,
      }),
    })
  },

  updateReviewStatus(reviewId: string, status: InterviewReview['status']): Promise<InterviewReview> {
    return request<InterviewReview>(`/reviews/${reviewId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },

  listExternalRuns(spaceId: string, sessionId: string): Promise<ExternalAgentRun[]> {
    return request<ExternalAgentRun[]>(`/spaces/${spaceId}/sessions/${sessionId}/external-runs`)
  },

  createExternalRun(spaceId: string, sessionId: string, repoPath: string, prompt: string): Promise<ExternalAgentRun> {
    return request<ExternalAgentRun>(`/spaces/${spaceId}/sessions/${sessionId}/external-runs`, {
      method: 'POST',
      body: JSON.stringify({ repo_path: repoPath, prompt }),
    })
  },

  splitReading(text: string): Promise<string[]> {
    return request<{ sentences: string[] }>('/reading/split', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }).then((result) => result.sentences)
  },

  explainSentence(sentence: string, articleTitle: string): Promise<SentenceExplanation> {
    return request<SentenceExplanation>('/reading/explain', {
      method: 'POST',
      body: JSON.stringify({ sentence, article_title: articleTitle }),
    })
  },

  getReadingProgress(spaceId: string, articleId: string): Promise<ReadingProgress> {
    return request<ReadingProgress>(`/spaces/${spaceId}/reading/progress/${articleId}`)
  },

  updateReadingProgress(
    spaceId: string,
    articleId: string,
    progress: Pick<ReadingProgress, 'article_title' | 'completed_count' | 'total_count' | 'difficult_sentences'>,
  ): Promise<ReadingProgress> {
    return request<ReadingProgress>(`/spaces/${spaceId}/reading/progress/${articleId}`, {
      method: 'PUT',
      body: JSON.stringify(progress),
    })
  },
}
