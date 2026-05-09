import { useEffect, useState } from 'react'
import { ExternalRunPanel } from '@/components/interview/ExternalRunPanel'
import { getReviewLevel, loadSavedQuestions, mergeGeneratedQuestions, saveQuestions, type SavedInterviewQuestion } from '@/components/interview/questionReviewState'
import { useExternalRuns } from '@/hooks'
import { codebaseApi } from '@/services/codebase'
import { interviewApi } from '@/services/interview'
import { useSettingsStore } from '@/stores/settings-store'
import type { CodebaseProfile } from '@/types/codebase'
import type { InterviewReview, InterviewSession, InterviewSkill, SpaceDetail } from '@/types/interview'

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
  const [reviewerProvider, setReviewerProvider] = useState('local_heuristic')
  const [repoPath, setRepoPath] = useState('')
  const [codebaseProfiles, setCodebaseProfiles] = useState<CodebaseProfile[]>([])
  const [selectedCodebaseRepoId, setSelectedCodebaseRepoId] = useState('')
  const [showResume, setShowResume] = useState(false)
  const [showJd, setShowJd] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const activeLlmId = useSettingsStore((state) => state.activeLlmId)
  const llmConfigs = useSettingsStore((state) => state.llmConfigs)
  const llmConfig = llmConfigs.find((config) => config.id === activeLlmId) ?? llmConfigs[0]
  const activeQuestion = questions[activeIndex] ?? null
  const reviewHint = activeQuestion ? getReviewLevel(activeQuestion) : null
  const favoriteQuestions = questions.filter((question) => question.favorited)
  const reviewRecommendations = favoriteQuestions.filter((question) => {
    const level = getReviewLevel(question)
    return level && level.days >= 1
  })
  const { externalRuns, createExternalRun } = useExternalRuns(detail?.space.space_id, activeSession?.session_id)

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
    interviewApi.listSessions(detail.space.space_id).then((items) => {
      setActiveSession(items[0] ?? null)
    })
  }, [detail?.space.space_id])

  useEffect(() => {
    if (!detail || !activeSession) return
    interviewApi.listReviews(detail.space.space_id, activeSession.session_id).then(setReviews)
  }, [detail?.space.space_id, activeSession?.session_id])

  if (!detail) {
    return <div className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4 text-sm text-muted">请选择岗位空间后再开始面试练习。</div>
  }

  const persistQuestions = (nextQuestions: SavedInterviewQuestion[]) => {
    setQuestions(nextQuestions)
    saveQuestions(detail.space.space_id, nextQuestions)
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
      const originalAnswer = activeQuestion ? `面试题：${activeQuestion.question}\n\n我的回答：\n${answer}` : answer
      const review = await interviewApi.createReview(detail.space.space_id, session.session_id, originalAnswer, reviewerProvider, repoPath, interviewerSkill, llmConfig, selectedCodebaseRepoId)
      setReviews((items) => [review, ...items])
      setAnswer('')
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
  }

  const startCodeExpertRun = async () => {
    if (!activeSession) {
      setMessage('请先创建或选择一个 Session。')
      return
    }
    if (!repoPath.trim()) {
      setMessage('请先填写本地代码仓库路径。')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      await createExternalRun(repoPath, answer || `请结合 ${detail.space.name} 的 Resume/JD 分析本地项目代码，并给出面试表达建议。`)
      setMessage('Codex 专家任务已创建，正在后台只读分析。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '创建 Codex 专家任务失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-primary/40 bg-surface-secondary p-4 shadow-xl shadow-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-primary">独立面试训练页</div>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">题目 · 我的回答 · AI 审阅</h2>
          <p className="mt-1 text-sm text-muted">顶部悬浮题目卡片用于练习，简历和 JD 可随时通过按钮查看。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowResume(true)} className="rounded-lg bg-surface px-3 py-2 text-sm text-foreground">查看简历</button>
          <button onClick={() => setShowJd(true)} className="rounded-lg bg-surface px-3 py-2 text-sm text-foreground">查看 JD</button>
          <button onClick={generateQuestions} disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? '处理中...' : '生成面试题'}
          </button>
        </div>
      </div>

      {message && <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">{message}</div>}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="min-w-0 space-y-4">
          <div className="sticky top-4 z-30 rounded-2xl border border-primary/50 bg-surface/95 p-5 shadow-2xl shadow-black/30 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span>题目 {questions.length ? activeIndex + 1 : 0}/{questions.length}</span>
                {questionProvider && <span>来源：{questionProvider === 'llm' ? 'LLM API' : '本地降级'}</span>}
                {reviewHint && <span className={`rounded-full px-2 py-1 ${reviewHint.tone}`}>{reviewHint.label}{reviewHint.days > 0 ? ` · ${reviewHint.days}天` : ''}</span>}
              </div>
              <select value={interviewerSkill} onChange={(event) => setInterviewerSkill(event.target.value)} className="rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-xs text-foreground outline-none">
                <option value="technical_interviewer">技术面试官</option>
                <option value="project_deep_dive">项目深挖面试官</option>
                <option value="system_design">系统设计面试官</option>
                <option value="hr_interviewer">HR 面试官</option>
                <option value="behavioral_interviewer">行为面试官</option>
                {customSkills.map((skill) => <option key={skill.skill_id} value={skill.skill_id}>{skill.name}</option>)}
              </select>
            </div>

            {!activeQuestion ? (
              <div className="mt-5 rounded-xl bg-surface-secondary p-6 text-center text-sm text-muted">还没有题目。点击右上角“生成面试题”开始。</div>
            ) : (
              <>
                <div className="mt-4 text-xl font-semibold leading-relaxed text-foreground">{activeQuestion.question}</div>
                <div className="mt-3 rounded-xl bg-primary/10 p-3 text-sm text-muted">答题提示：{activeQuestion.answer_hint}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-foreground">上一题</button>
                  <button onClick={() => setActiveIndex((index) => Math.min(questions.length - 1, index + 1))} className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-foreground">下一题</button>
                  <button onClick={toggleFavorite} className="rounded-lg bg-yellow-500/20 px-3 py-2 text-sm text-yellow-100">{activeQuestion.favorited ? '取消收藏' : '收藏题目'}</button>
                  <button onClick={markReviewed} className="rounded-lg bg-blue-500/20 px-3 py-2 text-sm text-blue-100">标记已复习</button>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-surface-tertiary bg-surface p-4">
              <h3 className="text-base font-semibold text-foreground">我的回答</h3>
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className="mt-3 h-64 w-full resize-none rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none"
                placeholder="在这里回答当前题目..."
              />
              <button onClick={submitAnswer} disabled={loading} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">保存并生成 AI 审阅</button>
            </div>

            <div className="rounded-xl border border-surface-tertiary bg-surface p-4">
              <h3 className="text-base font-semibold text-foreground">AI 审阅</h3>
              <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
                {reviews.length === 0 ? (
                  <div className="rounded-lg bg-surface-secondary p-4 text-sm text-muted">提交回答后，这里会显示 AI 审阅和更优回答。</div>
                ) : reviews.map((review) => (
                  <div key={review.review_id} className="rounded-xl bg-surface-secondary p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted"><span>{review.status}</span><span>{review.review_id}</span></div>
                    <div className="font-medium text-foreground">审阅建议</div>
                    <div className="mt-1 whitespace-pre-wrap text-muted">{review.critique}</div>
                    <div className="mt-3 font-medium text-foreground">更优回答</div>
                    <div className="mt-1 whitespace-pre-wrap text-muted">{review.suggested_answer}</div>
                    {review.token_usage && (
                      <div className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted">
                        Token 估算：{String(review.token_usage.total_tokens_estimated ?? '-')}（Prompt：{String(review.token_usage.prompt_tokens_estimated ?? '-')}，Completion：{String(review.token_usage.completion_tokens_estimated ?? '-')}）
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => updateStatus(review, 'accepted')} className="rounded-lg bg-green-500/20 px-3 py-1.5 text-xs text-green-200">采纳</button>
                      <button onClick={() => updateStatus(review, 'rejected')} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200">保留原样</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {reviewerProvider === 'code_expert' && <ExternalRunPanel runs={externalRuns} loading={loading} onStart={startCodeExpertRun} />}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <h3 className="text-sm font-semibold text-foreground">代码库技术档案</h3>
            <p className="mt-1 text-xs text-muted">选择后，生成面试题和 AI 审阅会优先参考这份 Codex 档案。</p>
            <select
              value={selectedCodebaseRepoId}
              onChange={(event) => setSelectedCodebaseRepoId(event.target.value)}
              className="mt-3 w-full rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none"
            >
              <option value="">不使用代码库档案</option>
              {codebaseProfiles.map((profile) => (
                <option key={profile.repo_id} value={profile.repo_id} disabled={profile.status !== 'completed'}>
                  {profile.name}（{profile.status === 'completed' ? '已生成' : '未完成'}）
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-surface-tertiary bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground">题目列表</h3>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {questions.length === 0 ? <div className="text-sm text-muted">暂无题目。</div> : questions.map((question, index) => (
                <button key={question.id} onClick={() => setActiveIndex(index)} className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${index === activeIndex ? 'bg-primary/20 text-foreground' : 'bg-surface-secondary text-muted'}`}>
                  Q{index + 1}. {question.question}
                  {question.favorited && <span className="ml-1 text-yellow-300">★</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-surface-tertiary bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground">推荐复习</h3>
            <div className="mt-3 space-y-2">
              {reviewRecommendations.length === 0 ? <div className="text-sm text-muted">暂无到期复习题。</div> : reviewRecommendations.map((question) => {
                const level = getReviewLevel(question)
                return <button key={question.id} onClick={() => setActiveIndex(questions.findIndex((item) => item.id === question.id))} className="block w-full rounded-lg bg-surface-secondary px-3 py-2 text-left text-xs text-muted">
                  <span className={level ? `mr-2 rounded px-1.5 py-0.5 ${level.tone}` : ''}>{level?.label}</span>{question.question}
                </button>
              })}
            </div>
          </div>

          <div className="rounded-xl border border-surface-tertiary bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground">审阅 Provider</h3>
            <select value={reviewerProvider} onChange={(event) => setReviewerProvider(event.target.value)} className="mt-3 w-full rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none">
              <option value="local_heuristic">LLM 优先审阅</option>
              <option value="code_expert">Codex 代码专家 Reviewer（预留）</option>
            </select>
            {reviewerProvider === 'code_expert' && <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} className="mt-3 w-full rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none" placeholder="D:\\github_desktop\\ShadowLink" />}
          </div>
        </aside>
      </div>

      {showResume && <ContentModal title="简历内容" content={detail.profile.resume_text || '当前 Space 还没有简历内容。'} onClose={() => setShowResume(false)} />}
      {showJd && <ContentModal title="岗位 JD" content={detail.profile.jd_text || '当前 Space 还没有 JD 内容。'} onClose={() => setShowJd(false)} />}
    </section>
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


