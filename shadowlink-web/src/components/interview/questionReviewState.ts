import type { InterviewQuestion } from '@/types/interview'

export interface QuestionPracticeAttempt {
  attemptId: string
  answeredAt: string
  originalAnswer: string
  critique: string
  suggestedAnswer: string
  reviewId?: string
  reviewStatus?: string
}

export interface SavedInterviewQuestion extends InterviewQuestion {
  id: string
  spaceId: string
  favorited: boolean
  favoritedAt?: string
  lastReviewedAt?: string
  attempts?: QuestionPracticeAttempt[]
}

const storageKey = (spaceId: string) => `shadowlink:interview:saved-questions:${spaceId}`

export const makeQuestionId = (question: string) => {
  let hash = 0
  for (let index = 0; index < question.length; index += 1) {
    hash = (hash * 31 + question.charCodeAt(index)) >>> 0
  }
  return `question-${hash.toString(16)}`
}

export const loadSavedQuestions = (spaceId: string): SavedInterviewQuestion[] => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(spaceId)) || '[]') as SavedInterviewQuestion[]
  } catch {
    return []
  }
}

export const saveQuestions = (spaceId: string, questions: SavedInterviewQuestion[]) => {
  localStorage.setItem(storageKey(spaceId), JSON.stringify(questions))
}

export const makePracticeAttemptId = () => `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const mergeGeneratedQuestions = (spaceId: string, generated: InterviewQuestion[]) => {
  const existing = loadSavedQuestions(spaceId)
  const byId = new Map(existing.map((question) => [question.id, question]))
  generated.forEach((question) => {
    const id = makeQuestionId(question.question)
    const previous = byId.get(id)
    byId.set(id, {
      ...question,
      ...previous,
      id,
      spaceId,
      question: question.question,
      focus: question.focus,
      answer_hint: question.answer_hint,
      favorited: previous?.favorited ?? false,
    })
  })
  const merged = Array.from(byId.values())
  saveQuestions(spaceId, merged)
  return merged
}

export const getReviewLevel = (question: SavedInterviewQuestion) => {
  if (!question.favoritedAt) return null
  const days = Math.floor((Date.now() - new Date(question.favoritedAt).getTime()) / 86_400_000)
  if (days >= 7) return { days, label: '必须复盘', tone: 'text-red-200 bg-red-500/20' }
  if (days >= 3) return { days, label: '重点复习', tone: 'text-yellow-100 bg-yellow-500/20' }
  if (days >= 1) return { days, label: '建议复习', tone: 'text-blue-100 bg-blue-500/20' }
  return { days, label: '新收藏', tone: 'text-muted bg-surface-secondary' }
}
