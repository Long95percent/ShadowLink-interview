/// <reference types="vite/client" />

interface Window {
  shadowlink?: {
    platform: string
    isElectron: boolean
    getClipboard: () => Promise<string>
    setClipboard: (text: string) => Promise<boolean>
    getSelectedText: () => Promise<string>
    getSystemInfo: () => Promise<Record<string, string>>
    openExternal: (url: string) => Promise<boolean>
    updateHotkey: (shortcut: string) => Promise<boolean>
    closeWindow: () => Promise<void>
    minimizeWindow: () => Promise<void>
    onClipboardContent: (callback: (text: string) => void) => void
    onScreenshotCaptured: (callback: (base64: string) => void) => void
    removeAllListeners: (channel: string) => void
  }
}
