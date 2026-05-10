import { useEffect, useMemo, useState } from 'react'
import { InterviewReviewPanel, InterviewSkillManager } from '@/components/interview'
import { interviewApi } from '@/services/interview'
import { useInterviewStore } from '@/stores/interview-store'
import type { InterviewSkill, SpaceDetail, SpaceType } from '@/types/interview'

type PanelMode = 'view' | 'create' | 'edit'

type SpaceDraft = {
  name: string
  type: SpaceType
  target_company: string
  target_role: string
  resume_text: string
  jd_text: string
  notes: string
}

const emptyDraft: SpaceDraft = {
  name: '',
  type: 'ai_engineer',
  target_company: '',
  target_role: '',
  resume_text: '',
  jd_text: '',
  notes: '',
}

const spaceTypeLabels: Record<SpaceType, string> = {
  ai_engineer: 'AI 工程师',
  product_manager: '产品经理',
  japanese_exam: '日语考试',
  custom: '自定义',
}

function draftFromDetail(detail: SpaceDetail): SpaceDraft {
  return {
    name: detail.space.name,
    type: detail.space.type,
    target_company: detail.profile.target_company,
    target_role: detail.profile.target_role,
    resume_text: detail.profile.resume_text,
    jd_text: detail.profile.jd_text,
    notes: detail.profile.notes,
  }
}

export function InterviewLearningPage() {
  const { spaces, setSpaces, setActiveSpace, activeSpaceId, upsertSpace, removeSpace } = useInterviewStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [draft, setDraft] = useState<SpaceDraft>(emptyDraft)
  const [customSkills, setCustomSkills] = useState<InterviewSkill[]>([])
  const [panelMode, setPanelMode] = useState<PanelMode>('view')
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [parsingResume, setParsingResume] = useState(false)

  const activeDetail = useMemo(
    () => spaces.find(({ space }) => space.space_id === activeSpaceId) ?? null,
    [activeSpaceId, spaces],
  )
  const isCreating = panelMode === 'create'
  const isEditing = panelMode === 'edit' && Boolean(editingSpaceId)
  const canEditDraft = isCreating || isEditing
  const displayedDraft = canEditDraft ? draft : activeDetail ? draftFromDetail(activeDetail) : emptyDraft

  useEffect(() => {
    setLoading(true)
    interviewApi.listSpaces()
      .then((items) => {
        setSpaces(items)
        if (!activeSpaceId && items[0]) setActiveSpace(items[0].space.space_id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载面试空间失败'))
      .finally(() => setLoading(false))
  }, [])

  const updateDraft = (patch: Partial<SpaceDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const resetPanel = () => {
    setDraft(emptyDraft)
    setPanelMode('view')
    setEditingSpaceId(null)
    setMessage(null)
    setError(null)
  }

  const startCreating = () => {
    setDraft(emptyDraft)
    setPanelMode('create')
    setEditingSpaceId(null)
    setMessage(null)
    setError(null)
  }

  const selectSpace = (detail: SpaceDetail) => {
    setActiveSpace(detail.space.space_id)
    setPanelMode('view')
    setEditingSpaceId(null)
    setDraft(emptyDraft)
    setMessage(null)
    setError(null)
  }

  const startEditing = (detail: SpaceDetail) => {
    setDraft(draftFromDetail(detail))
    setPanelMode('edit')
    setEditingSpaceId(detail.space.space_id)
    setActiveSpace(detail.space.space_id)
    setMessage(null)
    setError(null)
  }

  const submitSpace = async () => {
    const name = draft.name.trim()
    if (!canEditDraft) {
      setError('请先进入创建或编辑模式')
      return
    }
    const wasEditing = isEditing
    if (!name) {
      setError('请输入面试空间名称')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const detail = isEditing && editingSpaceId
        ? await interviewApi.updateSpace(editingSpaceId, name, draft.type, 'interview')
        : await interviewApi.createSpace(name, draft.type, 'interview')
      const profile = await interviewApi.updateProfile(detail.space.space_id, {
        target_company: draft.target_company,
        target_role: draft.target_role,
        resume_text: draft.resume_text,
        jd_text: draft.jd_text,
        notes: draft.notes,
      })
      const nextDetail = { ...detail, profile }
      upsertSpace(nextDetail)
      setActiveSpace(nextDetail.space.space_id)
      setMessage(wasEditing ? '面试空间已更新' : '面试空间已创建')
      if (wasEditing) {
        setDraft(draftFromDetail(nextDetail))
        setPanelMode('edit')
        setEditingSpaceId(nextDetail.space.space_id)
      } else {
        setDraft(emptyDraft)
        setPanelMode('view')
        setEditingSpaceId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存面试空间失败')
    } finally {
      setLoading(false)
    }
  }

  const deleteSpace = async (detail: SpaceDetail) => {
    const confirmed = window.confirm(`确认删除面试空间「${detail.space.name}」吗？相关 Session 会一起删除。`)
    if (!confirmed) return
    setLoading(true)
    setError(null)
    try {
      await interviewApi.deleteSpace(detail.space.space_id)
      removeSpace(detail.space.space_id)
      if (editingSpaceId === detail.space.space_id) resetPanel()
      setMessage('面试空间已删除')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除面试空间失败')
    } finally {
      setLoading(false)
    }
  }

  const parseResumeFile = async (file: File | null) => {
    if (!file) return
    if (!canEditDraft) {
      setError('请先进入创建或编辑模式后再上传简历')
      return
    }
    setParsingResume(true)
    setError(null)
    try {
      const parsed = await interviewApi.parseResumeDraft(file)
      updateDraft({ resume_text: parsed.content })
      setMessage(`已解析 ${parsed.filename}，请检查后保存`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历解析失败')
    } finally {
      setParsingResume(false)
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-3xl border border-surface-tertiary bg-surface p-5">
          <h1 className="text-2xl font-semibold text-foreground">沉浸式面试</h1>
          <p className="mt-2 text-sm text-muted">按岗位隔离简历、JD、Session 和后续 Agent 审阅上下文，支持生成面试题与复盘。</p>
        </section>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {message && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-muted">{message}</div>}

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-surface-tertiary bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">面试空间</h2>
                  <p className="mt-1 text-xs text-muted">为不同岗位维护独立资料。</p>
                </div>
                <button onClick={startCreating} className="rounded-xl bg-primary/15 px-3 py-1.5 text-xs text-primary">新建</button>
              </div>
              <div className="mt-4 space-y-2">
                {spaces.length === 0 ? (
                  <div className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">暂无面试空间，点击新建开始准备。</div>
                ) : spaces.map((detail) => (
                  <div key={detail.space.space_id} className={`rounded-2xl border p-3 ${activeSpaceId === detail.space.space_id ? 'border-primary/50 bg-primary/10' : 'border-surface-tertiary bg-surface-secondary'}`}>
                    <button onClick={() => selectSpace(detail)} className="w-full text-left">
                      <div className="font-medium text-foreground">{detail.space.name}</div>
                      <div className="mt-1 text-xs text-muted">{detail.profile.target_company || '未设置公司'} · {spaceTypeLabels[detail.space.type]}</div>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => startEditing(detail)} className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-foreground">编辑</button>
                      <button onClick={() => deleteSpace(detail)} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs text-red-200">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <main className="space-y-4">
            <section className="rounded-3xl border border-surface-tertiary bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">面试准备</div>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">{isCreating ? '新建面试空间' : activeDetail ? `${activeDetail.space.name} 准备面板` : '面试准备面板'}</h2>
                  <p className="mt-2 text-sm text-muted">{isCreating ? '填写目标岗位、简历和 JD，创建新的面试空间。' : isEditing ? '正在编辑空间资料，保存后会同步用于面试题生成。' : '选择或创建空间后，可以维护资料并生成模拟面试题。'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeDetail && panelMode === 'view' && <a href="#interview-practice" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">进入面试练习</a>}
                  {activeDetail && panelMode === 'view' && <button onClick={() => startEditing(activeDetail)} className="rounded-xl bg-surface-secondary px-4 py-2 text-sm text-foreground">编辑空间</button>}
                </div>
              </div>

              {!activeDetail && panelMode === 'view' ? (
                <div className="mt-5 rounded-2xl border border-dashed border-surface-tertiary bg-surface-secondary p-6 text-sm text-muted">请先新建一个面试空间，或从左侧选择已有空间。</div>
              ) : <>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-muted">空间名称 <span className="text-red-300">*</span><input value={displayedDraft.name} onChange={(event) => updateDraft({ name: event.target.value })} disabled={!canEditDraft} className="mt-2 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" /></label>
                <label className="text-sm text-muted">空间类型<select value={displayedDraft.type} onChange={(event) => updateDraft({ type: event.target.value as SpaceType })} disabled={!canEditDraft} className="mt-2 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60"><option value="ai_engineer">AI 工程师</option><option value="product_manager">产品经理</option><option value="japanese_exam">日语考试</option><option value="custom">自定义</option></select></label>
                <label className="text-sm text-muted">目标公司<input value={displayedDraft.target_company} onChange={(event) => updateDraft({ target_company: event.target.value })} disabled={!canEditDraft} className="mt-2 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" /></label>
                <label className="text-sm text-muted">目标岗位<input value={displayedDraft.target_role} onChange={(event) => updateDraft({ target_role: event.target.value })} disabled={!canEditDraft} className="mt-2 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" /></label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="text-sm text-muted">
                  <div className="flex items-center justify-between gap-3"><span>简历内容</span><span className={`rounded-lg px-3 py-1.5 text-xs ${canEditDraft ? 'cursor-pointer bg-primary/15 text-primary hover:bg-primary/20' : 'cursor-not-allowed bg-surface-secondary text-muted'}`}>{parsingResume ? '解析中...' : '上传简历'}<input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" disabled={!canEditDraft} className="hidden" onChange={(event) => parseResumeFile(event.target.files?.[0] ?? null)} /></span></div>
                  <textarea value={displayedDraft.resume_text} onChange={(event) => updateDraft({ resume_text: event.target.value })} disabled={!canEditDraft} className="mt-2 h-44 w-full resize-none rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" />
                </label>
                <label className="text-sm text-muted">岗位 JD<textarea value={displayedDraft.jd_text} onChange={(event) => updateDraft({ jd_text: event.target.value })} disabled={!canEditDraft} className="mt-2 h-44 w-full resize-none rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" /></label>
              </div>

              <label className="mt-4 block text-sm text-muted">备注<textarea value={displayedDraft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} disabled={!canEditDraft} className="mt-2 h-24 w-full resize-none rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none focus:border-primary/60" /></label>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {canEditDraft && <button onClick={resetPanel} className="rounded-xl bg-surface-secondary px-4 py-2 text-sm text-foreground">取消</button>}
                {canEditDraft && <button onClick={submitSpace} disabled={loading || !draft.name.trim()} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? '保存中...' : isEditing ? '保存修改' : '创建空间'}</button>}
              </div>
              </>}
            </section>

            {activeDetail ? (
              <section id="interview-practice" className="scroll-mt-4">
                <InterviewReviewPanel detail={activeDetail} customSkills={customSkills} />
              </section>
            ) : <div className="rounded-3xl border border-surface-tertiary bg-surface p-6 text-sm text-muted">创建或选择一个面试空间后，这里会显示题目生成与复盘面板。</div>}

            <section className="rounded-3xl border border-surface-tertiary bg-surface p-4">
              <InterviewSkillManager onSkillsChange={setCustomSkills} />
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}
