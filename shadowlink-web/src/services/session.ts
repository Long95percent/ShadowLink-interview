import { api } from './api'
import type { ChatSession, ChatMessage } from '@/types'

export const sessionApi = {
  /** Create a new session */
  create(modeId: string, title?: string): Promise<ChatSession> {
    return api.post<ChatSession>('/sessions', { mode_id: modeId, title })
  },

  /** List sessions for a mode */
  list(modeId?: string): Promise<ChatSession[]> {
    const path = modeId ? `/sessions?mode_id=${modeId}` : '/sessions'
    return api.get<ChatSession[]>(path)
  },

  /** Get a single session's details */
  get(sessionId: string): Promise<ChatSession> {
    return api.get<ChatSession>(`/sessions/${sessionId}`)
  },

  /** Get messages for a session */
  getMessages(sessionId: string): Promise<ChatMessage[]> {
    return api.get<ChatMessage[]>(`/sessions/${sessionId}/messages`)
  },

  /** Delete a session */
  delete(sessionId: string): Promise<void> {
    return api.delete<void>(`/sessions/${sessionId}`)
  },

  /** Rename a session */
  rename(sessionId: string, title: string): Promise<void> {
    return api.patch<void>(`/sessions/${sessionId}/title?title=${encodeURIComponent(title)}`)
  },
}
