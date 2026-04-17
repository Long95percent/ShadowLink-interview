/**
 * ChatPanel — full chat interface: message list + input area.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '@/stores'
import { MessageBubble } from './MessageBubble'
import { InputArea } from './InputArea'

interface ChatPanelProps {
  onSend: (message: string) => void
}

export function ChatPanel({ onSend }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages)
  const isSending = useChatStore((s) => s.isSending)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(
    (message: string) => onSend(message),
    [onSend],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="w-16 h-16 rounded-2xl ambient-gradient flex items-center justify-center mb-4">
                <span className="text-2xl text-white font-bold">SL</span>
              </div>
              <h2 className="text-lg font-medium text-foreground mb-1">Welcome to ShadowLink</h2>
              <p className="text-sm text-muted max-w-sm">
                Your ambient AI workspace. Start a conversation or switch work modes from the sidebar.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <InputArea onSend={handleSend} disabled={isSending} />
    </div>
  )
}
