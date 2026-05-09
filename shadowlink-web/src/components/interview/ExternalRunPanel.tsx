import type { ExternalAgentRun } from '@/types/interview'

interface ExternalRunPanelProps {
  runs: ExternalAgentRun[]
  loading: boolean
  onStart: () => void
}

export function ExternalRunPanel({ runs, loading, onStart }: ExternalRunPanelProps) {
  return (
    <div className="mt-3 rounded-xl border border-blue-400/20 bg-blue-400/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-blue-100">Codex 专家任务通过短轮询刷新状态，默认只读分析本地代码。</div>
        <button
          onClick={onStart}
          disabled={loading}
          className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          启动 Codex 任务
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {runs.length === 0 ? (
          <div className="text-sm text-blue-100/70">暂无 Codex 任务。</div>
        ) : (
          runs.map((run) => (
            <div key={run.run_id} className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
              <div className="flex items-center justify-between gap-3">
                <span>{run.run_id}</span>
                <span className="text-foreground">{run.status}</span>
              </div>
              <div className="mt-1 truncate">{run.repo_path}</div>
              {run.output_summary && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{run.output_summary}</pre>}
              {run.error_message && <div className="mt-2 text-xs text-red-300">{run.error_message}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

