import type { ApiResult } from '@/types'

export interface CodexStatus {
  installed: boolean
  command?: string | null
  version?: string | null
  message: string
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/v1/integrations${path}`)
  if (!response.ok) {
    throw new Error(await response.text())
  }
  const body: ApiResult<T> = await response.json()
  if (!body.success) {
    throw new Error(body.message)
  }
  return body.data as T
}

export const integrationsApi = {
  codexStatus(): Promise<CodexStatus> {
    return request<CodexStatus>('/codex/status')
  },
}

