import { useEffect, useMemo, useState } from 'react'
import { interviewApi } from '@/services/interview'
import type { ReadingProgress, SentenceExplanation } from '@/types/interview'

interface ReadingWorkspaceProps {
  spaceId?: string | null
}

const createArticleId = (title: string, text: string) => {
  const createdAt = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 10)
  const source = `${title.trim()}::${text.trim()}::${createdAt}::${randomPart}`
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0
  }
  return `article-${createdAt}-${randomPart}-${hash.toString(16)}`
}

export function ReadingWorkspace({ spaceId }: ReadingWorkspaceProps) {
  const [articleTitle, setArticleTitle] = useState('職場メール')
  const [text, setText] = useState('')
  const [articleId, setArticleId] = useState<string | null>(null)
  const [sentences, setSentences] = useState<string[]>([])
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<SentenceExplanation | null>(null)
  const [progressState, setProgressState] = useState<ReadingProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const completedCount = progressState?.completed_count ?? 0
  const difficultSentences = useMemo(() => new Set(progressState?.difficult_sentences ?? []), [progressState])
  const progress = sentences.length === 0 ? 0 : Math.round((completedCount / sentences.length) * 100)

  useEffect(() => {
    setArticleId(null)
    setSentences([])
    setSelectedSentence(null)
    setExplanation(null)
    setProgressState(null)
    setMessage(null)
    setBusy(false)
  }, [spaceId])

  const saveProgress = async (next: Pick<ReadingProgress, 'article_title' | 'completed_count' | 'total_count' | 'difficult_sentences'>) => {
    if (!spaceId || !articleId) return null
    const saved = await interviewApi.updateReadingProgress(spaceId, articleId, next)
    setProgressState(saved)
    return saved
  }

  const splitArticle = async () => {
    if (!spaceId) {
      setMessage('请先选择一个岗位 Space，再使用阅读工作台。')
      return
    }
    if (!text.trim()) {
      setMessage('请先粘贴文章内容。')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const nextSentences = await interviewApi.splitReading(text)
      const nextArticleId = createArticleId(articleTitle, text)
      setArticleId(nextArticleId)
      setSentences(nextSentences)
      setSelectedSentence(null)
      setExplanation(null)

      const saved = await interviewApi.getReadingProgress(spaceId, nextArticleId)
      if (saved.total_count === 0 && nextSentences.length > 0) {
        setProgressState(await interviewApi.updateReadingProgress(spaceId, nextArticleId, {
          article_title: articleTitle,
          completed_count: 0,
          total_count: nextSentences.length,
          difficult_sentences: [],
        }))
        return
      }
      setProgressState(saved)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '阅读内容处理失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  const selectSentence = async (sentence: string, index: number) => {
    setSelectedSentence(sentence)
    const nextCompletedCount = Math.max(completedCount, index + 1)
    setBusy(true)
    setMessage(null)
    try {
      await saveProgress({
        article_title: articleTitle,
        completed_count: nextCompletedCount,
        total_count: sentences.length,
        difficult_sentences: progressState?.difficult_sentences ?? [],
      })
    } catch (err) {
      setMessage(err instanceof Error ? `阅读进度保存失败：${err.message}` : '阅读进度保存失败，请稍后重试。')
    }

    try {
      setExplanation(await interviewApi.explainSentence(sentence, articleTitle))
    } catch (err) {
      setMessage(err instanceof Error ? `句子解释失败，但阅读进度已保存：${err.message}` : '句子解释失败，但阅读进度已保存。')
    } finally {
      setBusy(false)
    }
  }

  const toggleDifficultSentence = async () => {
    if (!selectedSentence) return
    const current = progressState?.difficult_sentences ?? []
    const nextDifficultSentences = current.includes(selectedSentence)
      ? current.filter((sentence) => sentence !== selectedSentence)
      : [...current, selectedSentence]
    setBusy(true)
    setMessage(null)
    try {
      await saveProgress({
        article_title: articleTitle,
        completed_count: completedCount,
        total_count: sentences.length,
        difficult_sentences: nextDifficultSentences,
      })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '难句标记保存失败，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-surface-tertiary bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">阅读理解工作台</h2>
          <p className="mt-1 text-sm text-muted">按 Space 保存文章进度、已读句子和难句标记。</p>
        </div>
        <div className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-muted">{busy ? '处理中...' : `进度：${progress}%`}</div>
      </div>

      {message && <div className="mt-3 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">{message}</div>}

      <div className="mt-4 grid grid-cols-[1fr_340px] gap-4">
        <div>
          <input
            value={articleTitle}
            onChange={(event) => setArticleTitle(event.target.value)}
            className="mb-3 w-full rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none"
            placeholder="文章标题"
          />
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-36 w-full resize-none rounded-lg border border-surface-tertiary bg-surface-secondary px-3 py-2 text-foreground outline-none"
            placeholder="粘贴日语文章、真题阅读或职场邮件..."
          />
          <button
            onClick={splitArticle}
            disabled={busy}
            className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            进入纯净阅读
          </button>

          <div className="mt-4 space-y-2 rounded-xl border border-surface-tertiary bg-surface-secondary p-4">
            {sentences.length === 0 ? (
              <div className="text-sm text-muted">句子会显示在这里。</div>
            ) : (
              sentences.map((sentence, index) => (
                <button
                  key={`${sentence}-${index}`}
                  onClick={() => selectSentence(sentence, index)}
                  disabled={busy}
                  className={
                    'block w-full rounded-lg px-3 py-2 text-left text-sm transition ' +
                    (selectedSentence === sentence ? 'bg-primary/20 text-foreground' : 'bg-surface text-muted hover:text-foreground')
                  }
                >
                  <span>{sentence}</span>
                  {difficultSentences.has(sentence) && <span className="ml-2 text-xs text-yellow-300">难句</span>}
                </button>
              ))
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">句子解释</h3>
            {selectedSentence && (
              <button onClick={toggleDifficultSentence} disabled={busy} className="rounded-lg bg-surface px-2 py-1 text-xs text-muted hover:text-foreground">
                {difficultSentences.has(selectedSentence) ? '取消难句' : '标记难句'}
              </button>
            )}
          </div>
          {!explanation ? (
            <p className="mt-3 text-sm text-muted">点击左侧句子后，这里会显示语法、语境和词汇提示。</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-lg bg-surface p-3 text-foreground">{explanation.sentence}</div>
              <div>
                <div className="mb-1 font-medium text-foreground">语法拆解</div>
                <p className="text-muted">{explanation.grammar_note}</p>
              </div>
              <div>
                <div className="mb-1 font-medium text-foreground">语境说明</div>
                <p className="text-muted">{explanation.context_note}</p>
              </div>
              <div>
                <div className="mb-1 font-medium text-foreground">词汇提示</div>
                <p className="text-muted">{explanation.vocabulary_note}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
