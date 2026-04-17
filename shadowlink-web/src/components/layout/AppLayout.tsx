/**
 * AppLayout — root shell: sidebar + top bar + content area + status bar.
 * Reads sidebar width from CSS variables set by the ambient engine.
 */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { useSettingsStore } from '@/stores'

export function AppLayout() {
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)

  // Sync hotkey with Electron on mount
  useEffect(() => {
    if (window.shadowlink?.isElectron && globalShortcut) {
      window.shadowlink.updateHotkey(globalShortcut)
    }
  }, [globalShortcut])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-app">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
