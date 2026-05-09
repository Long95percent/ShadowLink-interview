/**
 * SettingsPage — LLM provider management, runtime configuration, and preferences.
 *
 * Talks directly to the Python AI service (/v1/settings/*) for provider CRUD.
 * Provider configs are persisted server-side in data/llm_providers.json.
 */

import { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Server,
  Trash2,
  Zap,
  ArrowLeft,
  Activity,
  AlertCircle,
  Loader2,
  Folder,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSettingsStore } from '@/stores'
import { api } from '@/services'
import type { LLMConfig } from '@/types/agent'

export function SettingsPage() {
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  
  const activeLlmId = useSettingsStore((s) => s.activeLlmId)
  const llmConfigs = useSettingsStore((s) => s.llmConfigs)
  const addLLMConfig = useSettingsStore((s) => s.addLLMConfig)
  const updateLLMConfig = useSettingsStore((s) => s.updateLLMConfig)
  const removeLLMConfig = useSettingsStore((s) => s.removeLLMConfig)
  const setActiveLlmId = useSettingsStore((s) => s.setActiveLlmId)

  const rootDirectory = useSettingsStore((s) => s.rootDirectory)
  const setRootDirectory = useSettingsStore((s) => s.setRootDirectory)
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)
  const setGlobalShortcut = useSettingsStore((s) => s.setGlobalShortcut)

  // Currently editing config
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Local state for the config being edited
  const [form, setForm] = useState<LLMConfig | null>(null)

  // Connectivity test state
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; result: string | null; error: string | null }>>({})

  // When a config is selected to edit
  const startEdit = (id: string) => {
    const target = llmConfigs.find(c => c.id === id)
    if (target) {
      setForm({ ...target })
      setEditingId(id)
    }
  }

  // Add new blank config
  const handleAddNew = () => {
    const newId = `custom-${Date.now()}`
    const newConfig: LLMConfig = {
      id: newId,
      name: 'New Provider',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
    }
    addLLMConfig(newConfig)
    setForm(newConfig)
    setEditingId(newId)
    setActiveLlmId(newId)
  }

  // Update local form state
  const patch = (key: keyof LLMConfig, value: string | number) => {
    if (!form) return
    setForm({ ...form, [key]: value })
  }

  // Save changes to store
  const handleSave = () => {
    if (form && editingId) {
      updateLLMConfig(editingId, form)
      setEditingId(null)
      setForm(null)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setForm(null)
  }

  // Connectivity test
  const testConnection = async (config: LLMConfig) => {
    setTestStatus(prev => ({ ...prev, [config.id]: { loading: true, result: null, error: null } }))
    
    try {
      // Use the existing backend endpoint
      const result = await api.post<{ status: string; message: string }>('/settings/providers/test', {
        name: config.name,
        base_url: config.baseUrl,
        model: config.model,
        api_key: config.apiKey,
        temperature: config.temperature,
        max_tokens: config.maxTokens
      })

      if (result.status === 'ok') {
        setTestStatus(prev => ({ 
          ...prev, 
          [config.id]: { loading: false, result: result.message, error: null } 
        }))
      } else {
        setTestStatus(prev => ({ 
          ...prev, 
          [config.id]: { loading: false, result: null, error: result.message } 
        }))
      }
    } catch (err: any) {
      setTestStatus(prev => ({ 
        ...prev, 
        [config.id]: { loading: false, result: null, error: err.message || 'Network error' } 
      }))
    }
  }

  // Delete config
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to completely delete this API Key and config?')) {
      removeLLMConfig(id)
      if (editingId === id) {
        setEditingId(null)
        setForm(null)
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-3">
            <Link 
              to="/chat" 
              className="p-1.5 -ml-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
              title="Back to Chat"
            >
              <ArrowLeft size={18} />
            </Link>
            Settings
          </h1>
          <p className="text-sm text-muted mt-1">Configure AI providers, models, and preferences</p>
        </div>
      </div>

      {/* LLM Providers List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">LLM Providers</h2>
            <p className="text-xs text-muted mt-0.5">
              Add multiple API keys and select the active AI model provider.
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 text-xs font-medium hover:bg-primary-500/30 transition-colors"
          >
            <Plus size={14} />
            Add Custom Provider
          </button>
        </div>

        <div className="space-y-2">
          {llmConfigs.map((config) => {
            const isActive = config.id === activeLlmId
            const isEditing = config.id === editingId

            return (
              <div 
                key={config.id} 
                className={`surface-card border transition-all ${
                  isActive
                    ? 'border-primary-500/40 ring-1 ring-primary-500/20'
                    : 'border-white/5 hover:border-white/10 cursor-pointer'
                }`}
                onClick={() => !isEditing && setActiveLlmId(config.id)}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isActive ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-secondary text-muted'
                    }`}>
                      {isActive ? <Zap size={14} /> : <Server size={14} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {config.name || 'Unnamed Provider'}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-500/20 text-primary-400">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted truncate">
                        {config.model} &middot; {config.baseUrl}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        isEditing ? handleCancel() : startEdit(config.id)
                      }}
                      className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                    >
                      {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {llmConfigs.length > 1 && (
                      <button
                        onClick={(e) => handleDelete(config.id, e)}
                        className="p-1.5 rounded-md text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Editor Panel */}
                {isEditing && form && (
                  <div className="border-t border-white/5 px-4 py-4 space-y-4" onClick={e => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-medium text-muted">Config Name</span>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => patch('name', e.target.value)}
                          placeholder="e.g. My DeepSeek"
                          className="mt-1.5 w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-muted">Model Name</span>
                        <input
                          type="text"
                          value={form.model}
                          onChange={(e) => patch('model', e.target.value)}
                          placeholder="gpt-4o"
                          className="mt-1.5 w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs font-medium text-muted">Base URL</span>
                      <input
                        type="text"
                        value={form.baseUrl}
                        onChange={(e) => patch('baseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                        className="mt-1.5 w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-muted">API Key</span>
                      <input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => patch('apiKey', e.target.value)}
                        placeholder="sk-... (Leave empty for local models)"
                        className="mt-1.5 w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-xs font-medium text-muted">Temperature: {form.temperature}</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          value={form.temperature}
                          onChange={(e) => patch('temperature', parseFloat(e.target.value) || 0)}
                          className="mt-2 w-full accent-primary-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-muted">Max Tokens: {form.maxTokens}</span>
                        <input
                          type="range"
                          min={256}
                          max={8192}
                          step={256}
                          value={form.maxTokens}
                          onChange={(e) => patch('maxTokens', parseInt(e.target.value) || 4096)}
                          className="mt-2 w-full accent-primary-500"
                        />
                      </label>
                    </div>
                    
                    <div className="pt-3 border-t border-white/5 mt-4 flex justify-between items-center">
                       <div className="flex items-center gap-2">
                        <button
                          onClick={() => testConnection(form)}
                          disabled={testStatus[form.id]?.loading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            testStatus[form.id]?.result 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                              : testStatus[form.id]?.error
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-surface-secondary text-muted hover:text-foreground border border-white/5'
                          }`}
                        >
                          {testStatus[form.id]?.loading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : testStatus[form.id]?.result ? (
                            <Check size={12} />
                          ) : testStatus[form.id]?.error ? (
                            <AlertCircle size={12} />
                          ) : (
                            <Activity size={12} />
                          )}
                          {testStatus[form.id]?.loading 
                            ? 'Testing...' 
                            : testStatus[form.id]?.result 
                            ? 'Connection OK' 
                            : testStatus[form.id]?.error 
                            ? 'Test Failed' 
                            : 'Test Connection'}
                        </button>
                        {testStatus[form.id]?.error && (
                          <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={testStatus[form.id]?.error!}>
                            {testStatus[form.id]?.error}
                          </span>
                        )}
                       </div>
                       <button
                         onClick={handleSave}
                         className="px-4 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors"
                       >
                         Save Config
                       </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Environment Settings */}
      <section className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Folder size={16} className="text-primary-400" />
          <h2 className="text-sm font-medium text-foreground">Environment</h2>
        </div>
        <label className="block">
          <span className="text-xs text-muted">Root Directory</span>
          <p className="text-[10px] text-muted mb-2">Base path for file operations and local search. If empty, defaults to current data folder.</p>
          <input
            type="text"
            value={rootDirectory}
            onChange={(e) => setRootDirectory(e.target.value)}
            placeholder="e.g., D:\Projects\MyWorkspace"
            className="w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all"
          />
        </label>
      </section>

      {/* Desktop Integration (Electron Only) */}
      {window.shadowlink?.isElectron && (
        <section className="surface-card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-primary-400" />
            <h2 className="text-sm font-medium text-foreground">Desktop Integration</h2>
          </div>
          <label className="block">
            <span className="text-xs text-muted">Global Hotkey (Quick Assist)</span>
            <p className="text-[10px] text-muted mb-2">
              The shortcut to show/hide the floating AI bar. Format: Alt+Space, Ctrl+Shift+L, etc.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={globalShortcut}
                onChange={(e) => setGlobalShortcut(e.target.value)}
                placeholder="Alt+Space"
                className="flex-1 px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none transition-all font-mono"
              />
              <button 
                onClick={() => setGlobalShortcut('Alt+Space')}
                className="px-3 py-2 rounded-lg bg-white/5 text-xs text-muted hover:text-foreground transition-colors"
              >
                Reset
              </button>
            </div>
          </label>
        </section>
      )}

      {/* Preferences */}
      <section className="surface-card p-5 space-y-4">
        <h2 className="text-sm font-medium text-foreground">Preferences</h2>
        <label className="block">
          <span className="text-xs text-muted">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-secondary text-sm text-foreground border border-white/5 focus:border-primary-500/50 outline-none"
          >
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      {/* Version info */}
      <div className="text-center text-xs text-muted pb-4">
        ShadowLink AI Platform v3.0
      </div>
    </div>
  )
}
