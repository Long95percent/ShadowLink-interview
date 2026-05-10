/**
 * Settings store — LLM config, language, and preferences.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LLMConfig } from '@/types/agent'

export type ColorTheme = 'night' | 'lightness' | 'sunny' | 'lavender' | 'eyeCare'

interface SettingsState {
  // Current active LLM config ID
  activeLlmId: string
  // List of all saved LLM configs
  llmConfigs: LLMConfig[]
  
  language: string
  sidebarCollapsed: boolean
  rootDirectory: string
  globalShortcut: string
  colorTheme: ColorTheme

  // Actions
  addLLMConfig: (config: LLMConfig) => void
  updateLLMConfig: (id: string, patch: Partial<LLMConfig>) => void
  removeLLMConfig: (id: string) => void
  setActiveLlmId: (id: string) => void
  
  setLanguage: (lang: string) => void
  setRootDirectory: (dir: string) => void
  setGlobalShortcut: (shortcut: string) => void
  setColorTheme: (theme: ColorTheme) => void
  toggleSidebar: () => void
}

const defaultLLM: LLMConfig = {
  id: 'default',
  name: 'OpenAI Default',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: '',
  temperature: 0.7,
  maxTokens: 4096,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      activeLlmId: 'default',
      llmConfigs: [defaultLLM],
      
      language: 'zh-CN',
      sidebarCollapsed: false,
      rootDirectory: '', // Empty means default to ./data or project root
      globalShortcut: 'Alt+Space',
      colorTheme: 'night',

      addLLMConfig: (config) =>
        set((s) => ({ llmConfigs: [...s.llmConfigs, config] })),
        
      updateLLMConfig: (id, patch) =>
        set((s) => ({
          llmConfigs: s.llmConfigs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
        
      removeLLMConfig: (id) =>
        set((s) => ({
          llmConfigs: s.llmConfigs.filter((c) => c.id !== id),
          // If we remove the active one, fallback to the first available or default
          activeLlmId: s.activeLlmId === id 
            ? (s.llmConfigs.find(c => c.id !== id)?.id || 'default') 
            : s.activeLlmId
        })),
        
      setActiveLlmId: (id) =>
        set({ activeLlmId: id }),

      setLanguage: (language) => set({ language }),

      setRootDirectory: (rootDirectory) => set({ rootDirectory }),

      setGlobalShortcut: (globalShortcut) => {
        set({ globalShortcut })
        // If in Electron, notify the main process
        if (window.shadowlink?.isElectron) {
          window.shadowlink.updateHotkey(globalShortcut)
        }
      },

      setColorTheme: (colorTheme) => set({ colorTheme }),

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'shadowlink-settings',
      partialize: (s) => ({ 
        llmConfigs: s.llmConfigs, 
        activeLlmId: s.activeLlmId,
        language: s.language, 
        sidebarCollapsed: s.sidebarCollapsed,
        rootDirectory: s.rootDirectory,
        globalShortcut: s.globalShortcut,
        colorTheme: s.colorTheme
      }),
    },
  ),
)
