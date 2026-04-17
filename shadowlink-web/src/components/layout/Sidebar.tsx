/**
 * Sidebar — session list + mode switcher.
 */

import { useChatStore } from '@/stores'
import { ModeSwitcher } from '../ambient/ModeSwitcher'

interface SidebarProps {
  collapsed: boolean
}

export function Sidebar({ collapsed }: SidebarProps) {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const setActiveSession = useChatStore((s) => s.setActiveSession)

  return (
    <aside
      className="flex flex-col border-r border-surface-tertiary bg-surface transition-all duration-300"
      style={{ width: collapsed ? 0 : 'var(--sidebar-width)' }}
    >
      {!collapsed && (
        <>
          {/* Logo / Brand */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-surface-tertiary">
            <div className="w-8 h-8 rounded-lg ambient-gradient flex items-center justify-center text-white font-bold text-sm">
              SL
            </div>
            <span className="font-semibold text-foreground truncate">ShadowLink</span>
          </div>

          {/* Mode Switcher */}
          <div className="px-3 py-2">
            <ModeSwitcher />
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {sessions.length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No conversations yet</p>
            ) : (
              <ul className="space-y-0.5">
                {sessions.map((session) => (
                  <li key={session.sessionId}>
                    <button
                      onClick={() => setActiveSession(session.sessionId)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors
                        ${session.sessionId === activeSessionId
                          ? 'bg-surface-secondary text-foreground'
                          : 'text-muted hover:bg-surface-secondary hover:text-foreground'
                        }`}
                    >
                      {session.title || 'New Chat'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* New Chat Button */}
          <div className="px-3 py-3 border-t border-surface-tertiary">
            <button className="w-full px-3 py-2 rounded-lg ambient-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity">
              + New Chat
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
