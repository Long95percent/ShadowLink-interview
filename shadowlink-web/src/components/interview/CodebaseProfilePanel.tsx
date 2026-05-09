import { useEffect, useMemo, useState } from 'react'

import { codebaseApi } from '@/services/codebase'
import type { CodebaseProfile, CodebaseProfileDetail } from '@/types/codebase'

const statusText: Record<CodebaseProfile['status'], string> = {
  pending: '待生成',
  running: '生成中',
  completed: '已完成',
  failed: '失败',
}

export function CodebaseProfilePanel() {
  const [profiles, setProfiles] = useState<CodebaseProfile[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<CodebaseProfileDetail | null>(null)
  const [name, setName] = useState('ShadowLink')
  const [repoPath, setRepoPath] = useState('D:\\github_desktop\\ShadowLink')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.repo_id === selectedId) ?? null,
    [profiles, selectedId],
  )

  const loadProfiles = async () => {
    const items = await codebaseApi.listProfiles()
    setProfiles(items)
    if (!selectedId && items[0]) setSelectedId(items[0].repo_id)
  }

  useEffect(() => {
    loadProfiles().catch((err) => setError(err instanceof Error ? err.message : '加载代码库档案失败'))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const loadDetail = async () => {
      const nextDetail = await codebaseApi.getProfile(selectedId)
      if (!cancelled) setDetail(nextDetail)
    }
    loadDetail().catch((err) => setError(err instanceof Error ? err.message : '加载技术文档失败'))
    return () => {
      cancelled = true
    }
  }, [selectedId])

  useEffect(() => {
    if (detail?.profile.status !== 'running') return
    const timer = window.setInterval(async () => {
      try {
        const nextDetail = await codebaseApi.getProfile(detail.profile.repo_id)
        setDetail(nextDetail)
        setProfiles((items) => items.map((item) => (item.repo_id === nextDetail.profile.repo_id ? nextDetail.profile : item)))
      } catch (err) {
        setError(err instanceof Error ? err.message : '刷新技术文档状态失败')
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [detail?.profile.repo_id, detail?.profile.status])

  const createProfile = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const created = await codebaseApi.createProfile(name, repoPath)
      setProfiles((items) => [created.profile, ...items])
      setSelectedId(created.profile.repo_id)
      setDetail(created)
      setMessage('代码库已添加，可以生成技术档案。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加代码库失败')
    } finally {
      setLoading(false)
    }
  }

  const generateDoc = async () => {
    if (!selectedId) return
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const nextDetail = await codebaseApi.generateDoc(selectedId)
      setDetail(nextDetail)
      setProfiles((items) => items.map((item) => (item.repo_id === selectedId ? nextDetail.profile : item)))
      setMessage('已提交 Codex 生成任务，生成期间会自动刷新。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成技术档案失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">代码库技术档案</h2>
          <p className="mt-1 text-sm text-muted">Codex 只在新代码库或刷新时深度扫描，后续普通 LLM 可优先读取这份档案。</p>
        </div>
        <button
          onClick={generateDoc}
          disabled={!selectedId || loading || detail?.profile.status === 'running'}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          生成/刷新技术文档
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="代码库名称"
          className="rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground"
        />
        <input
          value={repoPath}
          onChange={(event) => setRepoPath(event.target.value)}
          placeholder="本地仓库路径"
          className="rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground"
        />
        <button
          onClick={createProfile}
          disabled={loading || !name.trim() || !repoPath.trim()}
          className="rounded-lg border border-primary/50 px-3 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          添加代码库
        </button>
      </div>

      {(message || error) && (
        <div className={`mt-3 rounded-lg p-3 text-sm ${error ? 'border border-red-500/30 bg-red-500/10 text-red-300' : 'border border-primary/30 bg-primary/10 text-primary'}`}>
          {error || message}
        </div>
      )}

      <div className="mt-4 grid min-h-0 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {profiles.length === 0 && <div className="rounded-lg bg-surface p-3 text-sm text-muted">暂无代码库档案。</div>}
          {profiles.map((profile) => (
            <button
              key={profile.repo_id}
              onClick={() => setSelectedId(profile.repo_id)}
              className={`w-full rounded-lg border p-3 text-left text-sm ${profile.repo_id === selectedId ? 'border-primary bg-primary/10' : 'border-surface-tertiary bg-surface'}`}
            >
              <div className="font-medium text-foreground">{profile.name}</div>
              <div className="mt-1 truncate text-xs text-muted">{profile.repo_path}</div>
              <div className="mt-2 text-xs text-primary">{statusText[profile.status]}</div>
            </button>
          ))}
        </div>

        <div className="min-h-0 rounded-lg border border-surface-tertiary bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <div className="font-medium text-foreground">{selectedProfile?.name ?? '未选择代码库'}</div>
            {detail?.profile && <div className="text-xs text-muted">状态：{statusText[detail.profile.status]}</div>}
          </div>
          {detail?.profile.last_error && <div className="mb-2 rounded bg-red-500/10 p-2 text-xs text-red-300">{detail.profile.last_error}</div>}
          <pre className="max-h-[420px] whitespace-pre-wrap overflow-y-auto rounded-lg bg-surface-secondary p-3 text-xs leading-5 text-muted">
            {detail?.doc?.raw_markdown || '还没有技术文档。点击“生成/刷新技术文档”后，Codex 会读取本地仓库并生成详细 Markdown 档案。'}
          </pre>
        </div>
      </div>
    </div>
  )
}
