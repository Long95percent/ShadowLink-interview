/**
 * InputArea — chat input with send button, supports Shift+Enter for newlines.
 */

import { useRef, useCallback, useState, type KeyboardEvent } from 'react'
import { useChatStore } from '@/stores'
import { Database, Zap } from 'lucide-react'
import type { AgentStrategy } from '@/types'

interface InputAreaProps {
  onSend: (message: string, strategy?: AgentStrategy) => void
  disabled?: boolean
}

export function InputArea({ onSend, disabled }: InputAreaProps) {
  const inputDraft = useChatStore((s) => s.inputDraft)
  const setInputDraft = useChatStore((s) => s.setInputDraft)
  const useResources = useChatStore((s) => s.useResources)
  const setUseResources = useChatStore((s) => s.setUseResources)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const [strategy, setStrategy] = useState<AgentStrategy | 'auto'>('auto')
  const [showStrategyMenu, setShowStrategyMenu] = useState(false)

  const handleSend = useCallback(() => {
    const text = inputDraft.trim()
    if (!text || disabled) return
    onSend(text, strategy === 'auto' ? undefined : strategy as AgentStrategy)
    setInputDraft('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputDraft, disabled, onSend, setInputDraft, strategy])

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

  const strategies: { id: AgentStrategy | 'auto', label: string, icon: string }[] = [
    { id: 'auto', label: 'Auto', icon: '🤖' },
    { id: 'direct', label: 'Direct', icon: '⚡' },
    { id: 'react', label: 'ReAct', icon: '🔄' },
    { id: 'plan_execute', label: 'Plan', icon: '📝' },
  ]

  return (
    <div className="border-t border-surface-tertiary bg-surface px-4 py-3">
      <div className="flex flex-col gap-2 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
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
        <div className="flex items-end gap-2 relative">
          {/* Strategy Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowStrategyMenu(!showStrategyMenu)}
              className="h-[42px] px-3 rounded-xl bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary transition-colors flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
              title="Select Agent Strategy"
            >
              <Zap size={14} className={strategy !== 'auto' ? 'text-primary-400' : ''} />
              <span className="hidden sm:inline">
                {strategies.find(s => s.id === strategy)?.label}
              </span>
            </button>

            {showStrategyMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStrategyMenu(false)} />
                <div className="absolute bottom-full left-0 mb-2 z-50 bg-surface border border-surface-tertiary rounded-xl shadow-2xl overflow-hidden min-w-[140px] animate-fade-in">
                  <div className="px-3 py-2 border-b border-surface-tertiary text-[10px] font-bold text-muted uppercase tracking-wider">
                    Strategy
                  </div>
                  {strategies.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setStrategy(s.id)
                        setShowStrategyMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-secondary transition-colors text-xs
                        ${strategy === s.id ? 'bg-surface-secondary text-primary-400 font-medium' : 'text-foreground'}`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

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
