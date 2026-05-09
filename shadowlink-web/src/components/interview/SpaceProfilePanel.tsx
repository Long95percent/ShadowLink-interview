import { useEffect, useState } from 'react'
import { interviewApi } from '@/services/interview'
import { useInterviewStore } from '@/stores/interview-store'
import type { SpaceDetail } from '@/types/interview'

interface SpaceProfilePanelProps {
  detail: SpaceDetail | null
}

export function SpaceProfilePanel({ detail }: SpaceProfilePanelProps) {
  const upsertSpace = useInterviewStore((state) => state.upsertSpace)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [targetCompany, setTargetCompany] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setResumeText(detail?.profile.resume_text ?? '')
    setJdText(detail?.profile.jd_text ?? '')
    setTargetCompany(detail?.profile.target_company ?? '')
    setTargetRole(detail?.profile.target_role ?? '')
    setNotes(detail?.profile.notes ?? '')
    setMessage(null)
  }, [detail?.space.space_id])

  if (!detail) {
    return <div className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4 text-sm text-muted">请选择一个岗位空间。</div>
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const profile = await interviewApi.updateProfile(detail.space.space_id, {
        resume_text: resumeText,
        jd_text: jdText,
        target_company: targetCompany,
        target_role: targetRole,
        notes,
      })
      upsertSpace({ ...detail, profile })
      setMessage('已保存当前岗位的简历和 JD。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const parseResumeFile = async (file: File | null) => {
    if (!file) return
    setParsingResume(true)
    setMessage(null)
    try {
      const parsed = await interviewApi.parseResume(detail.space.space_id, file)
      setResumeText(parsed.content)
      setMessage(`已解析 ${parsed.filename}，请检查内容后点击“保存资料”。`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '简历解析失败')
    } finally {
      setParsingResume(false)
    }
  }

  return (
    <section className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">岗位资料</h2>
          <p className="mt-1 text-sm text-muted">每个 Space 独立保存 Resume 和 JD，后续 Agent 只读取当前 Space。</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? '保存中...' : '保存资料'}
        </button>
      </div>

      {message && <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">{message}</div>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">
          目标公司
          <input
            value={targetCompany}
            onChange={(event) => setTargetCompany(event.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-foreground outline-none"
            placeholder="例如：OpenAI / 字节 / 阿里云"
          />
        </label>
        <label className="text-sm text-muted">
          目标岗位
          <input
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            className="mt-1 w-full rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-foreground outline-none"
            placeholder="例如：AI Application Engineer"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">
          Resume
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            onChange={(event) => parseResumeFile(event.target.files?.[0] ?? null)}
            disabled={parsingResume || saving}
            className="mt-1 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white disabled:opacity-60"
          />
          <span className="mt-1 block text-xs text-muted">支持 PDF / DOCX / TXT / MD，解析后会填入下方文本框。</span>
          <textarea
            value={resumeText}
            onChange={(event) => setResumeText(event.target.value)}
            className="mt-1 h-56 w-full resize-none rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-foreground outline-none"
            placeholder={parsingResume ? '正在解析简历...' : '上传 PDF/DOCX 或粘贴当前岗位使用的简历内容...'}
          />
        </label>
        <label className="text-sm text-muted">
          JD
          <textarea
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            className="mt-1 h-56 w-full resize-none rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-foreground outline-none"
            placeholder="粘贴当前岗位 JD..."
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-muted">
        备注
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1 h-24 w-full resize-none rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-foreground outline-none"
          placeholder="记录准备重点、面试轮次、岗位偏好..."
        />
      </label>
    </section>
  )
}
