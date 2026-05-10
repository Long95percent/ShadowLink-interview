import { ReadingWorkspace } from '@/components/interview'
import { useInterviewStore } from '@/stores/interview-store'

export function ReadingPage() {
  const activeSpaceId = useInterviewStore((state) => state.activeSpaceId)

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-surface-tertiary bg-surface p-5">
        <ReadingWorkspace spaceId={activeSpaceId} />
      </div>
    </div>
  )
}
