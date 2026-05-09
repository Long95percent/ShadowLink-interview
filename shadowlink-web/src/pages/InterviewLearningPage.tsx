import { useEffect, useMemo, useState } from 'react'
import { CodebaseProfilePanel, ExpertModePanel, InterviewReviewPanel, InterviewSkillManager, JobSpaceSwitcher, ReadingWorkspace, SpaceProfilePanel } from '@/components/interview'
import { interviewApi } from '@/services/interview'
import { useInterviewStore } from '@/stores/interview-store'
import type { InterviewSkill, SpaceType } from '@/types/interview'

const defaultSpace = {
  name: 'AI Application Engineer',
  type: 'ai_engineer' as SpaceType,
  theme: 'code-dev',
}

export function InterviewLearningPage() {
  const { spaces, setSpaces, setActiveSpace, activeSpaceId } = useInterviewStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customSkills, setCustomSkills] = useState<InterviewSkill[]>([])
  const [showSetup, setShowSetup] = useState(false)

  const activeDetail = useMemo(
    () => spaces.find(({ space }) => space.space_id === activeSpaceId) ?? null,
    [activeSpaceId, spaces],
  )

  useEffect(() => {
    setLoading(true)
    interviewApi.listSpaces()
      .then((items) => {
        setSpaces(items)
        if (!activeSpaceId && items[0]) setActiveSpace(items[0].space.space_id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load interview spaces'))
      .finally(() => setLoading(false))
  }, [])

  const createDefaultSpace = async () => {
    setError(null)
    setLoading(true)
    try {
      const created = await interviewApi.createSpace(defaultSpace.name, defaultSpace.type, defaultSpace.theme)
      const nextSpaces = [created, ...spaces]
      setSpaces(nextSpaces)
      setActiveSpace(created.space.space_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create interview space')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_1fr] gap-4 p-4">
      <JobSpaceSwitcher />

      <main className="min-h-0 overflow-y-auto rounded-xl border border-surface-tertiary bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">面试学习工作台</h1>
            <p className="mt-2 text-sm text-muted">按岗位隔离简历、JD、Session 和后续 Agent 审阅上下文。</p>
          </div>
          <button
            onClick={createDefaultSpace}
            disabled={loading}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            + 创建默认岗位
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <section className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
          {activeDetail ? (
            <div className="space-y-3 text-sm text-muted">
              <div className="text-base font-medium text-foreground">{activeDetail.space.name}</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface px-3 py-2"><span className="text-primary">1.</span> 上传/粘贴简历与 JD</div>
                <div className="rounded-lg bg-surface px-3 py-2"><span className="text-primary">2.</span> 点击“生成面试题”</div>
                <div className="rounded-lg bg-surface px-3 py-2"><span className="text-primary">3.</span> 作答并生成审阅建议</div>
              </div>
              <div>当前 Space：{activeDetail.space.space_id} · {activeDetail.space.type} · {activeDetail.space.theme}</div>
            </div>
          ) : (
            <div className="text-sm text-muted">
              {loading ? 'Loading spaces...' : '请先创建或选择一个岗位空间。'}
            </div>
          )}
        </section>

        <section className="mt-4">
          <InterviewReviewPanel detail={activeDetail} customSkills={customSkills} />
        </section>

        <section className="mt-4">
          <button
            onClick={() => setShowSetup((value) => !value)}
            className="w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-4 py-3 text-left text-sm font-medium text-foreground"
          >
            {showSetup ? '收起资料与 Skill 配置' : '展开资料与 Skill 配置'}
          </button>
        </section>

        {showSetup && (
          <>
            <section className="mt-4">
              <SpaceProfilePanel detail={activeDetail} />
            </section>

            <section className="mt-4">
              <InterviewSkillManager onSkillsChange={setCustomSkills} />
            </section>

            <section className="mt-4">
              <CodebaseProfilePanel />
            </section>
          </>
        )}

        <section className="mt-4">
          <ExpertModePanel />
        </section>

        <section className="mt-4">
          <ReadingWorkspace spaceId={activeSpaceId} />
        </section>
      </main>
    </div>
  )
}
