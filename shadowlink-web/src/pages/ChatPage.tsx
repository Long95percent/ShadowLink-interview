/**
 * ChatPage — main chat workspace with split view: chat panel + agent panel.
 */

import { useCallback, useEffect, useState } from 'react'
import { ChatPanel } from '@/components/chat'
import { AgentPanel } from '@/components/agent'
import { useChatStore, useAmbientStore } from '@/stores'
import { useAgent } from '@/hooks'
import { sessionApi } from '@/services'
import { Activity } from 'lucide-react'
import type { AgentStrategy } from '@/types'

export function ChatPage() {
  const { execute } = useAgent()
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const sessions = useChatStore((s) => s.sessions)
  const setSessions = useChatStore((s) => s.setSessions)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const setMessages = useChatStore((s) => s.setMessages)
  const addMessage = useChatStore((s) => s.addMessage)
  const resetChat = useChatStore((s) => s.resetChat)
  const activeModeId = useAmbientStore((s) => s.activeModeId)
  const [showAgentPanel, setShowAgentPanel] = useState(false)

  // Load sessions for the current mode
  useEffect(() => {
    if (!activeModeId) return

    // 1. Reset state for the new mode
    resetChat()

    // 2. Load sessions for the new mode
    sessionApi.list(activeModeId).then((loadedSessions) => {
      setSessions(loadedSessions)
      
      // If we have sessions for this mode, pick the latest one
      if (loadedSessions.length > 0) {
        setActiveSession(loadedSessions[0].sessionId)
      }
    })
  }, [activeModeId, setSessions, setActiveSession, resetChat])

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }

    sessionApi.getMessages(activeSessionId).then((loadedMessages) => {
      setMessages(loadedMessages)
    })
  }, [activeSessionId, setMessages])

  const handleSend = useCallback(
    async (message: string, strategy?: AgentStrategy) => {
      let sessionId = activeSessionId

      // If no active session, create one in the backend
      if (!sessionId) {
        try {
          const newSession = await sessionApi.create(activeModeId, message.slice(0, 40))
          sessionId = newSession.sessionId
          setActiveSession(sessionId)
          setSessions([newSession, ...sessions])
        } catch (error) {
          console.error('Failed to create session:', error)
          // Fallback to local-only if backend fails (though unlikely with L1 setup)
          sessionId = `session-${Date.now()}`
          setActiveSession(sessionId)
        }
      }

      // Add user message locally (backend will save it via ProxyController)
      addMessage({
        id: `msg-${Date.now()}-user`,
        sessionId,
        role: 'user',
        content: message,
        tokenCount: 0,
        model: '',
        createdAt: new Date().toISOString(),
      })

      // Start agent execution
      execute(sessionId, message, strategy)
      setShowAgentPanel(true)
    },
    [activeSessionId, activeModeId, sessions, setSessions, setActiveSession, addMessage, execute],
  )

  return (
    <div className="flex h-full relative">
      {/* Chat panel */}
      <div className="flex-1 min-w-0 transition-all duration-300">
        <ChatPanel onSend={handleSend} />
      </div>

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setShowAgentPanel(!showAgentPanel)}
        className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg border ${
          showAgentPanel 
            ? 'bg-surface-secondary border-primary-500/30 text-primary-400' 
            : 'bg-surface border-white/5 text-muted hover:text-foreground'
        }`}
      >
        <Activity size={14} />
        {showAgentPanel ? 'Hide Agent Logic' : 'Show Agent Logic'}
      </button>

      {/* Agent panel (Slide out) */}
      <div 
        className={`border-l border-surface-tertiary bg-surface transition-all duration-300 overflow-hidden ${
          showAgentPanel ? 'w-80 lg:w-96' : 'w-0 border-l-0'
        }`}
      >
        <div className="w-80 lg:w-96 h-full">
          <AgentPanel />
        </div>
      </div>
    </div>
  )
}
