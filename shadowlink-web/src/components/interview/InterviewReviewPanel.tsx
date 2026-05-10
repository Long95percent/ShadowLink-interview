import { useEffect, useState } from 'react'
import { InterviewParticleField } from '@/components/interview/InterviewParticleField'
import { getReviewLevel, loadSavedQuestions, makePracticeAttemptId, mergeGeneratedQuestions, saveQuestions, type SavedInterviewQuestion } from '@/components/interview/questionReviewState'
import { codebaseApi } from '@/services/codebase'
import { interviewApi } from '@/services/interview'
import { useSettingsStore } from '@/stores/settings-store'
import type { CodebaseProfile } from '@/types/codebase'
import type { InterviewReview, InterviewSession, InterviewSkill, ProjectDocument, SpaceDetail } from '@/types/interview'

interface InterviewReviewPanelProps {
  detail: SpaceDetail | null
  customSkills?: InterviewSkill[]
}

export function InterviewReviewPanel({ detail, customSkills = [] }: InterviewReviewPanelProps) {
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null)
  const [reviews, setReviews] = useState<InterviewReview[]>([])
  const [questions, setQuestions] = useState<SavedInterviewQuestion[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [questionProvider, setQuestionProvider] = useState<string | null>(null)
  const [interviewerSkill, setInterviewerSkill] = useState('technical_interviewer')
  const [answer, setAnswer] = useState('')
  const [revisionInstruction, setRevisionInstruction] = useState('')
  const [codebaseProfiles, setCodebaseProfiles] = useState<CodebaseProfile[]>([])
  const [selectedCodebaseRepoId, setSelectedCodebaseRepoId] = useState('')
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([])
  const [practiceMode, setPracticeMode] = useState(false)
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false)
  const [favoriteRepositoryOpen, setFavoriteRepositoryOpen] = useState(false)
  const [selectedRepositoryQuestionId, setSelectedRepositoryQuestionId] = useState<string | null>(null)
  const [showResume, setShowResume] = useState(false)
  const [showJd, setShowJd] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const activeLlmId = useSettingsStore((state) => state.activeLlmId)
  const llmConfigs = useSettingsStore((state) => state.llmConfigs)
  const llmConfig = llmConfigs.find((config) => config.id === activeLlmId) ?? llmConfigs[0]
  const activeQuestion = questions[activeIndex] ?? null
  const favoriteQuestions = questions.filter((question) => question.favorited)
  const selectedRepositoryQuestion = selectedRepositoryQuestionId
    ? favoriteQuestions.find((question) => question.id === selectedRepositoryQuestionId) ?? null
    : null
  const reviewHint = activeQuestion ? getReviewLevel(activeQuestion) : null
  const latestReview = reviews[0] ?? null

  useEffect(() => {
    codebaseApi.listProfiles().then((items) => {
      setCodebaseProfiles(items)
      const completed = items.find((item) => item.status === 'completed')
      if (!selectedCodebaseRepoId && completed) setSelectedCodebaseRepoId(completed.repo_id)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    setActiveSession(null)
    setReviews([])
    setQuestions([])
    setActiveIndex(0)
    setAnswer('')
    setMessage(null)
    if (!detail) return
    setQuestions(loadSavedQuestions(detail.space.space_id))
    interviewApi.listProjectDocuments(detail.space.space_id).then(setProjectDocuments).catch(() => undefined)
    interviewApi.listSessions(detail.space.space_id).then((items) => setActiveSession(items[0] ?? null))
  }, [detail?.space.space_id])

  useEffect(() => {
    if (!detail || !activeSession) return
    interviewApi.listReviews(detail.space.space_id, activeSession.session_id).then(setReviews)
  }, [detail?.space.space_id, activeSession?.session_id])

  if (!detail) {
    return <div className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4 text-sm text-muted">请先选择岗位，再开始面试练习。</div>
  }

  const persistQuestions = (nextQuestions: SavedInterviewQuestion[]) => {
    setQuestions(nextQuestions)
    saveQuestions(detail.space.space_id, nextQuestions)
  }

  const updateQuestionAttemptStatus = (reviewId: string, reviewStatus: string) => {
    persistQuestions(questions.map((question) => ({
      ...question,
      attempts: question.attempts?.map((attempt) => (attempt.reviewId === reviewId ? { ...attempt, reviewStatus } : attempt)),
    })))
  }

  const appendPracticeAttempt = (questionId: string, originalAnswer: string, review: InterviewReview) => {
    persistQuestions(questions.map((question) => (question.id === questionId ? {
      ...question,
      attempts: [
        {
          attemptId: makePracticeAttemptId(),
          answeredAt: new Date().toISOString(),
          originalAnswer,
          critique: review.critique,
          suggestedAnswer: review.suggested_answer,
          reviewId: review.review_id,
          reviewStatus: review.status,
        },
        ...(question.attempts ?? []),
      ],
    } : question)))
  }


  const createSession = async () => {
    const session = await interviewApi.createSession(detail.space.space_id, `${detail.space.name} 面试练习`)
    setActiveSession(session)
    setReviews([])
    return session
  }

  const generateQuestions = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await interviewApi.generateQuestions(detail.space.space_id, 5, 'mixed', interviewerSkill, llmConfig, selectedCodebaseRepoId)
      const merged = mergeGeneratedQuestions(detail.space.space_id, result.questions)
      setQuestions(merged)
      setActiveIndex(0)
      setQuestionProvider(result.provider)
      if (!activeSession) await createSession()
      setMessage(result.message || '已生成面试题。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '生成面试题失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = () => {
    if (!activeQuestion) return
    const now = new Date().toISOString()
    persistQuestions(questions.map((question) => question.id === activeQuestion.id
      ? { ...question, favorited: !question.favorited, favoritedAt: question.favorited ? question.favoritedAt : now }
      : question,
    ))
  }

  const markReviewed = () => {
    if (!activeQuestion) return
    const now = new Date().toISOString()
    persistQuestions(questions.map((question) => question.id === activeQuestion.id ? { ...question, lastReviewedAt: now } : question))
    setMessage('已记录本题复习时间。')
  }

  const submitAnswer = async () => {
    if (!answer.trim()) {
      setMessage('请先输入你的回答。')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const session = activeSession ?? await createSession()
      const originalAnswer = activeQuestion ? `面试题：${activeQuestion.question}

我的回答：
${answer}` : answer
      const review = await interviewApi.createReview(detail.space.space_id, session.session_id, originalAnswer, 'external_llm', '', interviewerSkill, llmConfig, selectedCodebaseRepoId)
      setReviews((items) => [review, ...items])
      setReviewDrawerOpen(true)
      if (activeQuestion) appendPracticeAttempt(activeQuestion.id, answer, review)
      markReviewed()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '提交回答失败')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (review: InterviewReview, status: InterviewReview['status']) => {
    const updated = await interviewApi.updateReviewStatus(review.review_id, status)
    setReviews((items) => items.map((item) => (item.review_id === updated.review_id ? updated : item)))
    updateQuestionAttemptStatus(updated.review_id, updated.status)
    setMessage(status === 'accepted' ? '已采纳 AI 建议。' : '审阅状态已更新。')
  }

  const regenerateReview = async () => {
    if (!latestReview) return
    if (!revisionInstruction.trim()) {
      setMessage('请先写下你觉得不对的地方，AI 会按你的意见重新生成。')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const session = activeSession ?? await createSession()
      const review = await interviewApi.createReview(
        detail.space.space_id,
        session.session_id,
        latestReview.original_answer,
        'external_llm',
        '',
        interviewerSkill,
        llmConfig,
        selectedCodebaseRepoId,
        revisionInstruction,
      )
      setReviews((items) => [review, ...items])
      if (activeQuestion) appendPracticeAttempt(activeQuestion.id, answer || latestReview.original_answer, review)
      setRevisionInstruction('')
      setReviewDrawerOpen(true)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '重新生成审阅失败')
    } finally {
      setLoading(false)
    }
  }

  const uploadProjectDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setLoading(true)
    setMessage(null)
    try {
      const uploaded: ProjectDocument[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await interviewApi.uploadProjectDocument(detail.space.space_id, file))
      }
      setProjectDocuments((items) => [...uploaded, ...items])
      setMessage(`已上传 ${uploaded.length} 份项目文档，AI 会作为参考资料。`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '项目文档操作失败')
    } finally {
      setLoading(false)
    }
  }

  const deleteProjectDocument = async (documentId: string) => {
    try {
      await interviewApi.deleteProjectDocument(documentId)
      setProjectDocuments((items) => items.filter((item) => item.document_id !== documentId))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '删除项目文档失败')
    }
  }

  const nextQuestion = () => {
    setActiveIndex((index) => Math.min(questions.length - 1, index + 1))
    setAnswer('')
  }
  const previousQuestion = () => setActiveIndex((index) => Math.max(0, index - 1))

  const openFavoriteQuestion = (questionId: string) => {
    const nextIndex = questions.findIndex((question) => question.id === questionId)
    if (nextIndex < 0) return
    setActiveIndex(nextIndex)
    setAnswer('')
    setReviews([])
    setReviewDrawerOpen(false)
    setFavoriteRepositoryOpen(false)
    setPracticeMode(true)
    setMessage('已进入重新练习，本次会作为新的练习记录保存。')
  }

  const removeFavoriteQuestion = (questionId: string) => {
    persistQuestions(questions.map((question) => question.id === questionId
      ? { ...question, favorited: false }
      : question,
    ))
  }

  const copyQuestion = async (questionText: string) => {
    try {
      await navigator.clipboard.writeText(questionText)
      setMessage('题目已复制。')
    } catch {
      setMessage('复制失败，请手动选中题目复制。')
    }
  }

  return (
    <section className="relative">
      {!practiceMode ? (
        <div className="rounded-3xl border border-primary/30 bg-surface-secondary p-6 shadow-xl shadow-primary/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">模拟面试</div>
              <h2 className="mt-2 text-3xl font-semibold text-foreground">专注练习</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">当前练习岗位：<span className="font-medium text-foreground">{detail.space.name}</span>。如需切换岗位，请先在左侧岗位列表选择。</p>
              <p className="mt-1 max-w-2xl text-sm text-muted">进入全屏练习模式，题目卡片居中展示，AI 审阅会在右侧抽屉打开。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFavoriteRepositoryOpen(true)} className="rounded-2xl bg-yellow-500/20 px-5 py-3 text-sm font-semibold text-yellow-100">查看收藏题目仓库</button>
              <button onClick={async () => { if (questions.length === 0) await generateQuestions(); setPracticeMode(true) }} disabled={loading} className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 disabled:opacity-60">
                {loading ? '准备中...' : '开始练习'}
              </button>
            </div>
          </div>

          {message && <div className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">{message}</div>}

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-surface-tertiary bg-surface p-4">
              <div className="text-sm font-semibold text-foreground">面试官类型</div>
              <select value={interviewerSkill} onChange={(event) => setInterviewerSkill(event.target.value)} className="mt-3 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none">
                <option value="technical_interviewer">技术面试官</option>
                <option value="project_deep_dive">项目深挖</option>
                <option value="system_design">系统设计</option>
                <option value="hr_interviewer">HR 面试官</option>
                <option value="behavioral_interviewer">行为面试官</option>
                {customSkills.map((skill) => <option key={skill.skill_id} value={skill.skill_id}>{skill.name}</option>)}
              </select>
            </div>

            <div className="rounded-2xl border border-surface-tertiary bg-surface p-4">
              <div className="text-sm font-semibold text-foreground">项目文档</div>
              <p className="mt-1 text-xs text-muted">上传多份 PDF/DOCX/TXT/MD 项目文档，AI 会作为参考资料。</p>
              <label className="mt-3 block cursor-pointer rounded-xl border border-dashed border-primary/50 bg-primary/10 px-3 py-3 text-center text-sm text-primary hover:bg-primary/15">
                上传文档
                <input type="file" multiple accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" className="hidden" onChange={(event) => uploadProjectDocuments(event.target.files)} />
              </label>
              <div className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1">
                {projectDocuments.length === 0 ? <div className="text-xs text-muted">暂无项目文档。</div> : projectDocuments.map((doc) => (
                  <div key={doc.document_id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-xs text-muted">
                    <span className="truncate">{doc.filename}</span>
                    <button onClick={() => deleteProjectDocument(doc.document_id)} className="text-red-300 hover:text-red-200">删除</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-surface-tertiary bg-surface p-4">
              <div className="text-sm font-semibold text-foreground">代码库档案（可选）</div>
              <p className="mt-1 text-xs text-muted">仅使用已生成的代码库档案作为 AI 参考资料。</p>
              <select value={selectedCodebaseRepoId} onChange={(event) => setSelectedCodebaseRepoId(event.target.value)} className="mt-3 w-full rounded-xl border border-surface-tertiary bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none">
                <option value="">不使用代码库档案</option>
                {codebaseProfiles.map((profile) => <option key={profile.repo_id} value={profile.repo_id} disabled={profile.status !== 'completed'}>{profile.name}（{profile.status === 'completed' ? '已生成' : '未完成'}）</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">
            <button onClick={generateQuestions} disabled={loading} className="rounded-xl bg-surface px-4 py-2 text-foreground disabled:opacity-60">重新生成题目</button>
            <button onClick={() => setShowResume(true)} className="rounded-xl bg-surface px-4 py-2 text-foreground">简历</button>
            <button onClick={() => setShowJd(true)} className="rounded-xl bg-surface px-4 py-2 text-foreground">JD</button>
            <span>{questions.length > 0 ? `已准备 ${questions.length} 道题` : '暂无题目'}</span>
            {questionProvider && <span>来源：{questionProvider === 'llm' ? 'LLM API' : '本地降级'}</span>}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-40 flex overflow-hidden bg-[#080A12] text-foreground">
          <InterviewParticleField />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_42%),linear-gradient(180deg,rgba(8,10,18,0.18),rgba(8,10,18,0.62))]" />
          <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-primary">{detail.space.name}</div>
                <div className="mt-1 text-sm text-muted">第 {questions.length ? activeIndex + 1 : 0} / {questions.length} 题 ? {interviewerSkill}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setReviewDrawerOpen((value) => !value)} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-foreground">{reviewDrawerOpen ? '收起审阅' : '打开审阅'}</button>
                <button onClick={() => setPracticeMode(false)} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-foreground">退出</button>
              </div>
            </div>
            {message && <div className="mx-auto mt-4 w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted">{message}</div>}
            <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
              <div key={activeQuestion?.id ?? 'empty'} className="w-full max-w-4xl animate-fade-in rounded-[2rem] border border-white/10 bg-surface p-7 shadow-2xl shadow-black/40">
                {!activeQuestion ? (
                  <div className="py-20 text-center">
                    <div className="text-xl font-semibold text-foreground">暂无题目</div>
                    <button onClick={generateQuestions} disabled={loading} className="mt-5 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">生成题目</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">第 {activeIndex + 1} 题</div>
                      {reviewHint && <span className={`rounded-full px-3 py-1 text-xs ${reviewHint.tone}`}>{reviewHint.label}{reviewHint.days > 0 ? ` ? ${reviewHint.days}天` : ''}</span>}
                    </div>
                    <h2 className="mt-5 text-2xl font-semibold leading-relaxed text-foreground">{activeQuestion.question}</h2>
                    {activeQuestion.answer_hint && <div className="mt-4 rounded-2xl bg-primary/10 p-4 text-sm leading-relaxed text-muted">提示：{activeQuestion.answer_hint}</div>}
                    <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-6 h-56 w-full resize-none rounded-2xl border border-white/10 bg-surface-secondary px-4 py-3 text-sm leading-relaxed text-foreground outline-none focus:border-primary/60" placeholder="在这里输入你的回答。" />
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-2">
                        <button onClick={previousQuestion} disabled={activeIndex === 0} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-foreground disabled:opacity-40">上一题</button>
                        <button onClick={nextQuestion} disabled={activeIndex >= questions.length - 1} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-foreground disabled:opacity-40">下一题</button>
                        <button onClick={toggleFavorite} className="rounded-xl bg-yellow-500/20 px-4 py-2 text-sm text-yellow-100">{activeQuestion.favorited ? '取消收藏' : '收藏'}</button>
                      </div>
                      <button onClick={submitAnswer} disabled={loading || !answer.trim()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? '审阅中...' : '提交审阅'}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
          <aside className={`relative z-10 h-full border-l border-white/10 bg-surface/95 transition-all duration-300 ${reviewDrawerOpen ? 'w-[420px]' : 'w-0 overflow-hidden'}`}>
            <div className="h-full w-[420px] overflow-y-auto p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">AI 审阅</h3>
                <button onClick={() => setReviewDrawerOpen(false)} className="rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-foreground">关闭</button>
              </div>
              {!latestReview ? (
                <div className="mt-6 rounded-2xl bg-surface-secondary p-5 text-sm text-muted">提交回答后，这里会显示不足之处、修改建议和完整参考回答。</div>
              ) : (
                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-2xl bg-surface-secondary p-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>{latestReview.status}</span><span>{latestReview.review_id}</span></div>
                    <div className="font-semibold text-foreground">不足之处与修改建议</div>
                    <div className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{latestReview.critique}</div>
                  </div>
                  <div className="rounded-2xl bg-surface-secondary p-4">
                    <div className="font-semibold text-foreground">完整参考回答</div>
                    <div className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">{latestReview.suggested_answer}</div>
                  </div>
                  {latestReview.token_usage && <div className="rounded-2xl bg-primary/10 p-3 text-xs text-muted">Token 估算：{String(latestReview.token_usage.total_tokens_estimated ?? '-')}</div>}
                  <div className="rounded-2xl bg-surface-secondary p-4">
                    <div className="font-semibold text-foreground">让 AI 重新生成</div>
                    <textarea value={revisionInstruction} onChange={(event) => setRevisionInstruction(event.target.value)} className="mt-3 h-24 w-full resize-none rounded-xl border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60" placeholder="写下你觉得不对的地方，比如：参考回答太空泛、没有结合项目文档、缺少技术细节。" />
                    <div className="mt-3 flex gap-2">
                      <button onClick={regenerateReview} disabled={loading || !revisionInstruction.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{loading ? '重新生成中...' : '重新生成'}</button>
                      <button onClick={() => updateStatus(latestReview, 'accepted')} className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs text-green-200">采纳</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
      {favoriteRepositoryOpen && (
        <FavoriteRepositoryModal
          spaceName={detail.space.name}
          questions={favoriteQuestions}
          selectedQuestion={selectedRepositoryQuestion}
          onSelect={setSelectedRepositoryQuestionId}
          onBack={() => setSelectedRepositoryQuestionId(null)}
          onClose={() => { setFavoriteRepositoryOpen(false); setSelectedRepositoryQuestionId(null) }}
          onPractice={openFavoriteQuestion}
          onCopy={copyQuestion}
          onRemove={removeFavoriteQuestion}
        />
      )}
      {showResume && <ContentModal title="简历" content={detail.profile.resume_text || '当前岗位还没有简历内容。'} onClose={() => setShowResume(false)} />}
      {showJd && <ContentModal title="JD" content={detail.profile.jd_text || '当前岗位还没有 JD 内容。'} onClose={() => setShowJd(false)} />}
    </section>
  )
}


function FavoriteRepositoryModal({
  spaceName,
  questions,
  selectedQuestion,
  onSelect,
  onBack,
  onClose,
  onPractice,
  onCopy,
  onRemove,
}: {
  spaceName: string
  questions: SavedInterviewQuestion[]
  selectedQuestion: SavedInterviewQuestion | null
  onSelect: (questionId: string) => void
  onBack: () => void
  onClose: () => void
  onPractice: (questionId: string) => void
  onCopy: (questionText: string) => void
  onRemove: (questionId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-3xl border border-surface-tertiary bg-surface shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-tertiary p-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-yellow-200">收藏题目仓库</div>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">{spaceName}</h3>
            <p className="mt-1 text-sm text-muted">查看收藏题的历次练习输入、AI 审阅和参考回答，也可以从空白状态重新练习。</p>
          </div>
          <div className="flex gap-2">
            {selectedQuestion && <button onClick={onBack} className="rounded-xl bg-surface-secondary px-4 py-2 text-sm text-foreground">返回列表</button>}
            <button onClick={onClose} className="rounded-xl bg-surface-secondary px-4 py-2 text-sm text-foreground">关闭</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-tertiary bg-surface-secondary p-8 text-center text-sm text-muted">
              暂无收藏题目。练习时点击“收藏”，题目就会出现在这里。
            </div>
          ) : selectedQuestion ? (
            <FavoriteQuestionDetail question={selectedQuestion} onPractice={onPractice} onCopy={onCopy} onRemove={onRemove} />
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => {
                const level = getReviewLevel(question)
                const attemptCount = question.attempts?.length ?? 0
                return (
                  <article key={question.id} className="rounded-2xl border border-surface-tertiary bg-surface-secondary p-4">
                    <button onClick={() => onSelect(question.id)} className="w-full text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span>第 {index + 1} 题 · {question.focus || '综合能力'}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{attemptCount > 0 ? `${attemptCount} 次练习` : '暂无练习记录'}</span>
                          {level && <span className={`rounded-full px-2.5 py-1 ${level.tone}`}>{level.label}{level.days > 0 ? ` · ${level.days}天` : ''}</span>}
                          {question.favoritedAt && <span>收藏于 {new Date(question.favoritedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="mt-3 whitespace-pre-wrap text-base font-semibold leading-relaxed text-foreground">{question.question}</div>
                      {question.answer_hint && <div className="mt-3 rounded-xl bg-primary/10 p-3 text-sm leading-relaxed text-muted">参考提示：{question.answer_hint}</div>}
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => onPractice(question.id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">重新练习</button>
                      <button onClick={() => onSelect(question.id)} className="rounded-xl bg-surface px-4 py-2 text-sm text-foreground">查看详情</button>
                      <button onClick={() => onCopy(question.question)} className="rounded-xl bg-surface px-4 py-2 text-sm text-foreground">复制题目</button>
                      <button onClick={() => onRemove(question.id)} className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200">取消收藏</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FavoriteQuestionDetail({
  question,
  onPractice,
  onCopy,
  onRemove,
}: {
  question: SavedInterviewQuestion
  onPractice: (questionId: string) => void
  onCopy: (questionText: string) => void
  onRemove: (questionId: string) => void
}) {
  const attempts = question.attempts ?? []
  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-surface-tertiary bg-surface-secondary p-5">
        <div className="text-xs text-muted">{question.focus || '综合能力'} · {attempts.length} 次练习</div>
        <h4 className="mt-3 whitespace-pre-wrap text-xl font-semibold leading-relaxed text-foreground">{question.question}</h4>
        {question.answer_hint && <div className="mt-4 rounded-xl bg-primary/10 p-3 text-sm leading-relaxed text-muted">参考提示：{question.answer_hint}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onPractice(question.id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">重新练习</button>
          <button onClick={() => onCopy(question.question)} className="rounded-xl bg-surface px-4 py-2 text-sm text-foreground">复制题目</button>
          <button onClick={() => onRemove(question.id)} className="rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200">取消收藏</button>
        </div>
      </article>

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-tertiary bg-surface-secondary p-6 text-sm text-muted">这道题还没有保存过练习记录。提交审阅后，会自动保存你的原始输入和 AI 审阅结果。</div>
      ) : attempts.map((attempt, index) => (
        <article key={attempt.attemptId} className="rounded-2xl border border-surface-tertiary bg-surface-secondary p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>第 {attempts.length - index} 次练习 · {new Date(attempt.answeredAt).toLocaleString()}</span>
            <span>{attempt.reviewStatus === 'accepted' ? '已采纳' : '未采纳'}</span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl bg-surface p-3">
              <div className="text-sm font-semibold text-foreground">我的原始回答</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{attempt.originalAnswer}</div>
            </section>
            <section className="rounded-xl bg-surface p-3">
              <div className="text-sm font-semibold text-foreground">AI 审阅</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{attempt.critique}</div>
            </section>
            <section className="rounded-xl bg-surface p-3">
              <div className="text-sm font-semibold text-foreground">完整参考回答</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{attempt.suggestedAnswer}</div>
            </section>
          </div>
        </article>
      ))}
    </div>
  )
}

function ContentModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="max-h-[80vh] w-full max-w-4xl rounded-2xl border border-surface-tertiary bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-foreground">关闭</button>
        </div>
        <pre className="mt-4 max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-xl bg-surface-secondary p-4 text-sm text-muted">{content}</pre>
      </div>
    </div>
  )
}
