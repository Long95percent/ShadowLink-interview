import { useCallback, useEffect, useState } from 'react'
import { interviewApi } from '@/services/interview'
import type { ExternalAgentRun } from '@/types/interview'

export function useExternalRuns(spaceId?: string, sessionId?: string) {
  const [externalRuns, setExternalRuns] = useState<ExternalAgentRun[]>([])

  const refreshExternalRuns = useCallback(async () => {
    if (!spaceId || !sessionId) {
      setExternalRuns([])
      return []
    }
    const runs = await interviewApi.listExternalRuns(spaceId, sessionId)
    setExternalRuns(runs)
    return runs
  }, [spaceId, sessionId])

  const createExternalRun = useCallback(async (repoPath: string, prompt: string) => {
    if (!spaceId || !sessionId) {
      throw new Error('Missing active space or session')
    }
    const run = await interviewApi.createExternalRun(spaceId, sessionId, repoPath, prompt)
    setExternalRuns((items) => [run, ...items])
    return run
  }, [spaceId, sessionId])

  useEffect(() => {
    refreshExternalRuns().catch(() => setExternalRuns([]))
  }, [refreshExternalRuns])

  useEffect(() => {
    if (!spaceId || !sessionId) return
    if (!externalRuns.some((run) => run.status === 'queued' || run.status === 'running')) return

    const timer = window.setInterval(() => {
      refreshExternalRuns().catch(() => undefined)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [externalRuns, refreshExternalRuns, sessionId, spaceId])

  return { externalRuns, setExternalRuns, refreshExternalRuns, createExternalRun }
}

