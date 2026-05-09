import type { ApiResult } from '@/types'
import type { CodebaseProfile, CodebaseProfileDetail } from '@/types/codebase'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/v1/codebase${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const body: ApiResult<T> = await response.json()
  if (!body.success) {
    throw new Error(body.message)
  }
  return body.data as T
}

export const codebaseApi = {
  listProfiles(): Promise<CodebaseProfile[]> {
    return request<CodebaseProfile[]>('/profiles')
  },

  createProfile(name: string, repoPath: string): Promise<CodebaseProfileDetail> {
    return request<CodebaseProfileDetail>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name, repo_path: repoPath }),
    })
  },

  getProfile(repoId: string): Promise<CodebaseProfileDetail> {
    return request<CodebaseProfileDetail>(`/profiles/${repoId}`)
  },

  generateDoc(repoId: string, prompt = ''): Promise<CodebaseProfileDetail> {
    return request<CodebaseProfileDetail>(`/profiles/${repoId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  },
}
