/**
 * ChatPage — main chat workspace with split view: chat panel + agent panel.
 */

import { useCallback, useState } from 'react'
import { ChatPanel } from '@/components/chat'
import { AgentPanel } from '@/components/agent'
import { useChatStore, useAmbientStore } from '@/stores'
import { useAgent } from '@/hooks'
import { Activity } from 'lucide-react'

export function ChatPage() {
  const { execute } = useAgent()
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const addMessage = useChatStore((s) => s.addMessage)
  const activeModeId = useAmbientStore((s) => s.activeModeId)
  const [showAgentPanel, setShowAgentPanel] = useState(false)

  const handleSend = useCallback(
    (message: string) => {
      const sessionId = activeSessionId ?? `session-${Date.now()}`

      // If no active session, set one
      if (!activeSessionId) {
        useChatStore.getState().setActiveSession(sessionId)
        useChatStore.getState().setSessions([
          ...useChatStore.getState().sessions,
          {
            sessionId,
            modeId: activeModeId,
            title: message.slice(0, 40),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ])
      }

      // Add user message
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
      execute(sessionId, message)
      setShowAgentPanel(true) // Auto open panel when agent starts
    },
    [activeSessionId, activeModeId, addMessage, execute],
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
