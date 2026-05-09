import { useInterviewStore } from '@/stores/interview-store'

export function JobSpaceSwitcher() {
  const { spaces, activeSpaceId, setActiveSpace } = useInterviewStore()

  return (
    <div className="rounded-xl border border-surface-tertiary bg-surface p-3">
      <div className="mb-2 text-sm font-medium text-foreground">Job Spaces</div>
      <div className="flex flex-col gap-2">
        {spaces.length === 0 ? (
          <p className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-muted">No spaces yet</p>
        ) : (
          spaces.map(({ space }) => (
            <button
              key={space.space_id}
              onClick={() => setActiveSpace(space.space_id)}
              className={
                'rounded-lg px-3 py-2 text-left text-sm transition ' +
                (activeSpaceId === space.space_id
                  ? 'bg-primary/20 text-foreground'
                  : 'bg-surface-secondary text-muted hover:text-foreground')
              }
            >
              <div className="font-medium">{space.name}</div>
              <div className="text-xs opacity-70">{space.type}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

