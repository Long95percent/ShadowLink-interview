import { useEffect, useState } from 'react'
import { interviewApi } from '@/services/interview'
import type { InterviewSkill } from '@/types/interview'

interface InterviewSkillManagerProps {
  onSkillsChange?: (skills: InterviewSkill[]) => void
}

export function InterviewSkillManager({ onSkillsChange }: InterviewSkillManagerProps) {
  const [skills, setSkills] = useState<InterviewSkill[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSkills = async () => {
    const items = await interviewApi.listSkills()
    setSkills(items)
    onSkillsChange?.(items)
  }

  useEffect(() => {
    loadSkills().catch((err) => setMessage(err instanceof Error ? err.message : '加载 Skill 失败'))
  }, [])

  const saveSkill = async () => {
    if (!name.trim() || !instruction.trim()) {
      setMessage('请填写 Skill 名称和指令。')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      await interviewApi.createSkill({ name, description, instruction })
      setName('')
      setDescription('')
      setInstruction('')
      await loadSkills()
      setMessage('自定义 Skill 已保存。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存 Skill 失败')
    } finally {
      setLoading(false)
    }
  }

  const uploadSkill = async (file: File | null) => {
    if (!file) return
    setLoading(true)
    setMessage(null)
    try {
      const skill = await interviewApi.uploadSkill(file)
      await loadSkills()
      setMessage(`已上传 Skill：${skill.name}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '上传 Skill 失败')
    } finally {
      setLoading(false)
    }
  }

  const deleteSkill = async (skillId: string) => {
    setLoading(true)
    setMessage(null)
    try {
      await interviewApi.deleteSkill(skillId)
      await loadSkills()
      setMessage('Skill 已删除。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '删除 Skill 失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-surface-tertiary bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">自定义面试官 Skill 管理</h2>
          <p className="mt-1 text-sm text-muted">上传 JSON/TXT/MD，或手动创建 Skill。保存后会出现在“生成面试题”的 Skill 下拉框中。</p>
        </div>
        <label className="rounded-lg bg-surface px-3 py-2 text-sm text-foreground">
          上传 Skill
          <input
            type="file"
            accept=".json,.txt,.md,application/json,text/plain,text/markdown"
            disabled={loading}
            onChange={(event) => uploadSkill(event.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>

      {message && <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted">{message}</div>}

      <div className="mt-4 grid grid-cols-[260px_1fr] gap-3">
        <div className="space-y-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground outline-none"
            placeholder="Skill 名称，例如：AI Infra 面试官"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground outline-none"
            placeholder="描述"
          />
          <button onClick={saveSkill} disabled={loading} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
            保存自定义 Skill
          </button>
        </div>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          className="h-32 w-full resize-none rounded-lg border border-surface-tertiary bg-surface px-3 py-2 text-sm text-foreground outline-none"
          placeholder="写入完整 Skill 指令：你是谁、重点追问什么、不要问什么、输出风格是什么..."
        />
      </div>

      <div className="mt-4 space-y-2">
        {skills.length === 0 ? (
          <div className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">暂无自定义 Skill。</div>
        ) : (
          skills.map((skill) => (
            <div key={skill.skill_id} className="rounded-lg border border-surface-tertiary bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{skill.name}</div>
                  <div className="mt-1 text-xs text-muted">{skill.skill_id} · {skill.description || '无描述'}</div>
                </div>
                <button onClick={() => deleteSkill(skill.skill_id)} disabled={loading} className="rounded-lg bg-red-500/20 px-2 py-1 text-xs text-red-200 disabled:opacity-60">
                  删除
                </button>
              </div>
              <div className="mt-2 line-clamp-2 text-xs text-muted">{skill.instruction}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
