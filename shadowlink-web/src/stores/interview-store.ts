import { create } from 'zustand'
import type { SpaceDetail } from '@/types/interview'

interface InterviewState {
  spaces: SpaceDetail[]
  activeSpaceId: string | null
  setSpaces: (spaces: SpaceDetail[]) => void
  setActiveSpace: (spaceId: string | null) => void
  upsertSpace: (space: SpaceDetail) => void
}

export const useInterviewStore = create<InterviewState>((set) => ({
  spaces: [],
  activeSpaceId: null,
  setSpaces: (spaces) => set({ spaces }),
  setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId }),
  upsertSpace: (space) => set((state) => ({
    spaces: state.spaces.some((item) => item.space.space_id === space.space.space_id)
      ? state.spaces.map((item) => (item.space.space_id === space.space.space_id ? space : item))
      : [space, ...state.spaces],
  })),
}))
