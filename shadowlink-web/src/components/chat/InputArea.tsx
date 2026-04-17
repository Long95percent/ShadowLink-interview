/**
 * InputArea — chat input with send button, supports Shift+Enter for newlines.
 */

import { useRef, useCallback, type KeyboardEvent } from 'react'
import { useChatStore } from '@/stores'
import { Database } from 'lucide-react'

interface InputAreaProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function InputArea({ onSend, disabled }: InputAreaProps) {
  const inputDraft = useChatStore((s) => s.inputDraft)
  const setInputDraft = useChatStore((s) => s.setInputDraft)
  const useResources = useChatStore((s) => s.useResources)
  const setUseResources = useChatStore((s) => s.setUseResources)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const text = inputDraft.trim()
    if (!text || disabled) return
    onSend(text)
    setInputDraft('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputDraft, disabled, onSend, setInputDraft])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }, [])

  return (
    <div className="border-t border-surface-tertiary bg-surface px-4 py-3">
      <div className="flex flex-col gap-2 max-w-4xl mx-auto">
        <div className="flex items-center">
          <button 
            onClick={() => setUseResources(!useResources)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              useResources 
                ? 'bg-primary-500/20 text-primary-400' 
                : 'bg-surface-secondary text-muted hover:text-foreground'
            }`}
          >
            <Database size={12} />
            {useResources ? 'Local Resources: ON' : 'Local Resources: OFF'}
          </button>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputDraft}
            onChange={(e) => setInputDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Type your message..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-surface-secondary rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-1 focus:ring-primary-500/50 transition-shadow max-h-[200px]"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !inputDraft.trim()}
            className="px-4 py-2.5 rounded-xl ambient-gradient text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
