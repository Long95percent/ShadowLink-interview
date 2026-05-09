import { useEffect, useState } from 'react'
import { integrationsApi, type CodexStatus } from '@/services/integrations'

export function ExpertModePanel() {
  const [status, setStatus] = useState<CodexStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    integrationsApi.codexStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to detect Codex CLI'))
  }, [])

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
  }

  if (!status) {
    return <div className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4 text-sm text-muted">正在检测 Codex CLI...</div>
  }

  if (!status.installed) {
    return (
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">
        <div className="font-medium">Codex CLI 未安装</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>安装 Node.js</li>
          <li><code>npm install -g @openai/codex</code></li>
          <li><code>codex login</code></li>
          <li>回到本页面重新检测</li>
        </ol>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-4 text-sm text-blue-100">
      <div className="font-medium">Codex CLI 已就绪</div>
      <div className="mt-1 text-blue-100/70">{status.command}</div>
      <div className="mt-1 text-blue-100/70">{status.version}</div>
      <div className="mt-3 text-blue-100/80">专家模式默认只读分析代码，不会修改文件。</div>
    </div>
  )
}

