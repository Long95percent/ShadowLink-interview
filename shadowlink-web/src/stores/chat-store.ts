/**
 * Chat store — manages sessions and messages for the chat panel.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatSession, ChatMessage } from '@/types'

interface ChatState {
  /** All loaded sessions */
  sessions: ChatSession[]
  /** Currently active session ID */
  activeSessionId: string | null
  /** Messages for the active session */
  messages: ChatMessage[]
  /** Whether a message is being sent / streamed */
  isSending: boolean
  /** Input text draft */
  inputDraft: string
  /** Whether to use local resources / RAG */
  useResources: boolean

  // Actions
  setSessions: (sessions: ChatSession[]) => void
  setActiveSession: (sessionId: string) => void
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  appendToMessage: (id: string, token: string) => void
  setIsSending: (v: boolean) => void
  setInputDraft: (v: string) => void
  setUseResources: (v: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>()(
  immer((set) => ({
    sessions: [],
    activeSessionId: null,
    messages: [],
    isSending: false,
    inputDraft: '',
    useResources: true,

    setSessions: (sessions) =>
      set((s) => { s.sessions = sessions }),

    setActiveSession: (sessionId) =>
      set((s) => { s.activeSessionId = sessionId }),

    setMessages: (messages) =>
      set((s) => { s.messages = messages }),

    addMessage: (message) =>
      set((s) => { s.messages.push(message) }),

    updateMessage: (id, patch) =>
      set((s) => {
        const msg = s.messages.find((m) => m.id === id)
        if (msg) Object.assign(msg, patch)
      }),

    appendToMessage: (id, token) =>
      set((s) => {
        const msg = s.messages.find((m) => m.id === id)
        if (msg) msg.content += token
      }),

    setIsSending: (v) =>
      set((s) => { s.isSending = v }),

    setInputDraft: (v) =>
      set((s) => { s.inputDraft = v }),
      
    setUseResources: (v) =>
      set((s) => { s.useResources = v }),

    clearMessages: () =>
      set((s) => { s.messages = [] }),
  })),
)
