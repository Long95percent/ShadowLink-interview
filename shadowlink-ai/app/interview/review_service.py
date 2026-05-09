"""Deterministic review draft generation for the interview module.

This service is intentionally lightweight. It gives the UI a useful review
draft before the LLM/SSE pipeline is connected, while preserving the same
interfaces that a future Agent reviewer can replace.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import re
import json
from typing import Any

from pydantic import BaseModel

from app.interview.models import InterviewSkill, SpaceProfile
from app.interview.schemas import InterviewQuestion


class ReviewDraft(BaseModel):
    original_answer: str
    suggested_answer: str
    critique: str
    token_usage: dict = {}


class ReviewerProvider(ABC):
    provider_id: str

    @abstractmethod
    def generate_draft(self, profile: SpaceProfile, original_answer: str, context: dict | None = None) -> ReviewDraft:
        raise NotImplementedError


class LocalHeuristicReviewerProvider(ReviewerProvider):
    provider_id = "local_heuristic"

    def generate_draft(self, profile: SpaceProfile, original_answer: str, context: dict | None = None) -> ReviewDraft:
        target_role = profile.target_role or "目标岗位"
        resume_hint = self._summarize(profile.resume_text, "简历暂未补充")
        jd_hint = self._summarize(profile.jd_text, "JD 暂未补充")

        if not profile.resume_text.strip() or not profile.jd_text.strip():
            return ReviewDraft(
                original_answer=original_answer,
                suggested_answer=original_answer,
                critique="请先补充 Resume 和 JD，系统才能做岗位对齐式批改。当前仅保存原始回答，未进行覆盖。",
            )

        suggested_answer = (
            f"面向 {target_role}，建议把回答改写为：\n"
            f"{original_answer}\n\n"
            f"可以进一步补充与岗位 JD 对齐的证据：结合简历中的「{resume_hint}」，"
            f"突出 JD 中关注的「{jd_hint}」，并用项目背景、技术动作、量化结果三段式表达。"
        )
        critique = (
            f"当前回答需要更强的岗位对齐：JD 关键词包括「{jd_hint}」，"
            f"简历证据包括「{resume_hint}」。建议明确你的技术决策、工程取舍和可验证结果，"
            "避免只说“做过项目”而缺少细节。"
        )
        return ReviewDraft(original_answer=original_answer, suggested_answer=suggested_answer, critique=critique)

    def _summarize(self, text: str, fallback: str) -> str:
        normalized = " ".join(text.split())
        if not normalized:
            return fallback
        return normalized[:80]


class ExternalLLMReviewerProvider(ReviewerProvider):
    provider_id = "external_llm"

    def generate_draft(self, profile: SpaceProfile, original_answer: str, context: dict | None = None) -> ReviewDraft:
        return ReviewDraft(
            original_answer=original_answer,
            suggested_answer=original_answer,
            critique="外部 LLM Reviewer 尚未配置。当前已保留原始回答，后续可接 OpenAI-compatible、DeepSeek、硅基流动等 API。",
        )


class CodeExpertReviewerProvider(ReviewerProvider):
    provider_id = "code_expert"

    def generate_draft(self, profile: SpaceProfile, original_answer: str, context: dict | None = None) -> ReviewDraft:
        repo_path = str((context or {}).get("repo_path") or "").strip()
        if not repo_path:
            return ReviewDraft(
                original_answer=original_answer,
                suggested_answer=original_answer,
                critique="未配置本地代码仓库路径。请先在专家模式中选择 repo_path，后续将通过 Codex CLI 只读分析项目代码。",
            )

        return ReviewDraft(
            original_answer=original_answer,
            suggested_answer=original_answer,
            critique=f"Codex 代码专家模式已预留，目标仓库：{repo_path}。当前同步接口不直接执行 Codex；后续将通过异步任务/SSE 返回只读代码分析结果。",
        )


class ReviewerProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, ReviewerProvider] = {
            LocalHeuristicReviewerProvider.provider_id: LocalHeuristicReviewerProvider(),
            ExternalLLMReviewerProvider.provider_id: ExternalLLMReviewerProvider(),
            CodeExpertReviewerProvider.provider_id: CodeExpertReviewerProvider(),
        }

    def get_provider(self, provider_id: str | None = None) -> ReviewerProvider:
        if provider_id and provider_id in self._providers:
            return self._providers[provider_id]
        return self._providers[LocalHeuristicReviewerProvider.provider_id]


class InterviewReviewDraftService:
    def __init__(self, registry: ReviewerProviderRegistry | None = None) -> None:
        self.registry = registry or ReviewerProviderRegistry()

    def generate_draft(
        self,
        profile: SpaceProfile,
        original_answer: str,
        provider_id: str | None = None,
        context: dict | None = None,
    ) -> ReviewDraft:
        return self.registry.get_provider(provider_id).generate_draft(profile, original_answer, context=context)

    async def generate_llm_draft(
        self,
        profile: SpaceProfile,
        original_answer: str,
        llm_client: Any | None = None,
        interviewer_skill: str = "technical_interviewer",
        custom_skill: InterviewSkill | None = None,
        codebase_context: str = "",
    ) -> ReviewDraft:
        prompt = self._build_review_prompt(profile, original_answer, interviewer_skill, custom_skill, codebase_context)
        if llm_client is None:
            fallback = self.generate_draft(profile, original_answer)
            fallback.token_usage = estimate_token_usage(prompt, fallback.suggested_answer + fallback.critique, provider="local_fallback")
            return fallback
        try:
            raw = await llm_client.chat(
                message=prompt,
                system_prompt="你是资深面试官和职业教练。只输出 JSON，不要输出 Markdown。",
                temperature=0.5,
                max_tokens=2200,
            )
            draft = self._parse_llm_review(original_answer, raw)
            draft.token_usage = estimate_token_usage(prompt, raw, provider="llm")
            return draft
        except Exception as exc:
            fallback = self.generate_draft(profile, original_answer)
            fallback.critique = f"LLM 审阅失败，已降级本地模板：{exc}\n\n{fallback.critique}"
            fallback.token_usage = estimate_token_usage(prompt, fallback.suggested_answer + fallback.critique, provider="local_fallback")
            return fallback

    def _build_review_prompt(
        self,
        profile: SpaceProfile,
        original_answer: str,
        interviewer_skill: str,
        custom_skill: InterviewSkill | None = None,
        codebase_context: str = "",
    ) -> str:
        question = ""
        answer = original_answer
        if "我的回答：" in original_answer:
            question, answer = original_answer.split("我的回答：", 1)
        skill_instruction = custom_skill.instruction if custom_skill else InterviewQuestionService()._skill_instruction(interviewer_skill)
        skill_name = custom_skill.name if custom_skill else InterviewQuestionService()._skill_label(interviewer_skill)
        return f"""
请按“{skill_name}”的风格审阅候选人的面试回答。

Skill 要求：{skill_instruction}

请严格基于简历和 JD 判断回答是否有岗位匹配度、证据密度、表达结构和风险点。
只输出 JSON：{{"critique":"总体评价、亮点、问题与风险、下一步追问","suggested_answer":"改写后的更优回答"}}

目标公司：{profile.target_company or "未填写"}
目标岗位：{profile.target_role or "未填写"}
备注：{profile.notes or "无"}

简历：
{profile.resume_text[:6000] or "未填写"}

岗位 JD：
{profile.jd_text[:6000] or "未填写"}

代码库技术档案：
{codebase_context[:8000] if codebase_context.strip() else "未选择或未生成技术档案"}

面试题：
{question.strip() or "未单独提供"}

候选人回答：
{answer.strip()}
""".strip()

    def _parse_llm_review(self, original_answer: str, raw: str) -> ReviewDraft:
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
        payload = json.loads(text)
        return ReviewDraft(
            original_answer=original_answer,
            suggested_answer=str(payload.get("suggested_answer") or original_answer).strip(),
            critique=str(payload.get("critique") or "LLM 未返回明确评价。").strip(),
        )


def estimate_token_usage(prompt: str, completion: str, provider: str) -> dict:
    prompt_tokens = max(1, len(prompt) // 4)
    completion_tokens = max(1, len(completion) // 4)
    return {
        "provider": provider,
        "prompt_tokens_estimated": prompt_tokens,
        "completion_tokens_estimated": completion_tokens,
        "total_tokens_estimated": prompt_tokens + completion_tokens,
        "estimated": True,
    }


class InterviewQuestionService:
    async def generate_questions(
        self,
        profile: SpaceProfile,
        count: int = 5,
        difficulty: str = "mixed",
        interviewer_skill: str = "technical_interviewer",
        custom_skill: InterviewSkill | None = None,
        llm_client: Any | None = None,
        codebase_context: str = "",
    ) -> tuple[list[InterviewQuestion], str, str]:
        if llm_client is not None:
            try:
                questions = self._parse_llm_questions(await llm_client.chat(
                    message=self._build_prompt(profile, count, difficulty, interviewer_skill, custom_skill, codebase_context),
                    system_prompt="你是资深技术面试官和职业教练。只输出 JSON，不要输出 Markdown。",
                    temperature=0.7,
                    max_tokens=1800,
                ), count)
                if questions:
                    return questions, "llm", "已使用当前配置的 LLM API 生成面试题。"
            except Exception as exc:
                return self._generate_fallback_questions(profile, count, difficulty, interviewer_skill, custom_skill), "local_fallback", f"LLM 出题失败，已降级为本地模板：{exc}"

        return self._generate_fallback_questions(profile, count, difficulty, interviewer_skill, custom_skill), "local_fallback", "未检测到可用 LLM Client，已使用本地模板。"

    def _generate_fallback_questions(
        self,
        profile: SpaceProfile,
        count: int = 5,
        difficulty: str = "mixed",
        interviewer_skill: str = "technical_interviewer",
        custom_skill: InterviewSkill | None = None,
    ) -> list[InterviewQuestion]:
        target_role = profile.target_role or "目标岗位"
        company = profile.target_company or "目标公司"
        resume_keywords = self._keywords(profile.resume_text)
        jd_keywords = self._keywords(profile.jd_text)
        primary_resume = resume_keywords[0] if resume_keywords else "你的项目经历"
        primary_jd = jd_keywords[0] if jd_keywords else "岗位核心要求"

        skill_label = custom_skill.name if custom_skill else self._skill_label(interviewer_skill)
        templates = [
            (
                f"作为{skill_label}，请结合你的简历，介绍一个最能证明你胜任 {target_role} 的项目。",
                f"{skill_label} · 项目经历与岗位匹配",
                f"建议围绕 {primary_resume} 展开，并主动对齐 JD 中的 {primary_jd}。",
            ),
            (
                f"{company} 的这个岗位 JD 提到了 {primary_jd}，你过去哪段经历最能支撑这一点？",
                "JD 关键词对齐",
                "用 STAR 结构回答：背景、任务、行动、结果，并给出可验证细节。",
            ),
            (
                f"如果让你重新设计简历中的 {primary_resume}，你会如何提升工程效果？",
                "技术复盘与改进",
                "说明原方案限制、取舍依据，以及下一版会怎么做。",
            ),
            (
                f"你如何向非技术面试官解释你在 {primary_resume} 中的价值？",
                "沟通表达",
                "避免堆技术名词，突出业务问题、你的动作和结果。",
            ),
            (
                f"针对 {target_role}，你认为自己和 JD 之间最大的差距是什么？准备如何补齐？",
                "自我认知",
                "承认差距但给出学习路径、已有证据和短期计划。",
            ),
            (
                f"请讲一次你在项目中遇到困难并推动解决的经历，最好结合 {primary_resume}。",
                "问题解决能力",
                "强调你如何定位问题、协调资源、验证结果。",
            ),
            (
                f"如果面试官追问 {primary_jd} 的底层原理，你会怎么回答？",
                "技术深挖",
                "先给结论，再补原理、工程实践和边界条件。",
            ),
            (
                f"请用 2 分钟说明：为什么你的经历适合 {target_role}？",
                "综合自我介绍",
                "把简历亮点压缩成岗位相关的 2-3 条证据。",
            ),
        ]

        if difficulty == "hard":
            templates.insert(0, (
                f"请指出你简历中与 {primary_jd} 最相关的一项成果，并说明它经得起哪些技术追问。",
                "高压追问",
                "准备数据、架构、失败案例和替代方案。",
            ))

        return [InterviewQuestion(question=q, focus=f, answer_hint=h) for q, f, h in templates[:count]]

    def _build_prompt(
        self,
        profile: SpaceProfile,
        count: int,
        difficulty: str,
        interviewer_skill: str,
        custom_skill: InterviewSkill | None = None,
        codebase_context: str = "",
    ) -> str:
        skill_instruction = custom_skill.instruction if custom_skill else self._skill_instruction(interviewer_skill)
        skill_name = custom_skill.name if custom_skill else interviewer_skill
        return f"""
请根据候选人的简历和岗位 JD，生成 {count} 道真实面试中会问的问题。

面试官 Skill：{skill_name}
Skill 要求：{skill_instruction}

要求：
1. 必须紧扣简历经历和 JD 要求，不要泛泛而谈。
2. 问题要像真实面试官提问，可以包含追问压力。
3. 每道题包含 question、focus、answer_hint 三个字段。
4. difficulty={difficulty}；mixed 表示基础题、项目深挖、行为题、岗位匹配题混合。
5. 只输出 JSON，格式为：{{"questions":[{{"question":"...","focus":"...","answer_hint":"..."}}]}}

目标公司：{profile.target_company or "未填写"}
目标岗位：{profile.target_role or "未填写"}
备注：{profile.notes or "无"}

简历：
{profile.resume_text[:6000] or "未填写"}

岗位 JD：
{profile.jd_text[:6000] or "未填写"}

代码库技术档案：
{codebase_context[:8000] if codebase_context.strip() else "未选择或未生成技术档案"}
""".strip()

    def _skill_label(self, interviewer_skill: str) -> str:
        labels = {
            "technical_interviewer": "技术面试官",
            "project_deep_dive": "项目深挖面试官",
            "hr_interviewer": "HR 面试官",
            "system_design": "系统设计面试官",
            "behavioral_interviewer": "行为面试官",
        }
        return labels.get(interviewer_skill, "技术面试官")

    def _skill_instruction(self, interviewer_skill: str) -> str:
        instructions = {
            "technical_interviewer": "重点考察技术基础、工程实现、岗位技术栈匹配度，问题要能检验真实能力。",
            "project_deep_dive": "围绕简历项目连续深挖，追问架构、难点、指标、失败案例、替代方案和个人贡献。",
            "hr_interviewer": "重点考察动机、稳定性、沟通协作、职业规划、薪资/公司匹配和风险点。",
            "system_design": "重点考察系统拆解、架构设计、扩展性、可靠性、数据流、成本和权衡。",
            "behavioral_interviewer": "使用 STAR 方法考察冲突处理、推动力、学习能力、抗压和复盘能力。",
        }
        return instructions.get(interviewer_skill, instructions["technical_interviewer"])

    def _parse_llm_questions(self, raw: str, count: int) -> list[InterviewQuestion]:
        text = raw.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
        payload = json.loads(text)
        items = payload.get("questions", []) if isinstance(payload, dict) else []
        questions: list[InterviewQuestion] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()
            if not question:
                continue
            questions.append(InterviewQuestion(
                question=question,
                focus=str(item.get("focus") or "面试问题").strip(),
                answer_hint=str(item.get("answer_hint") or "结合简历和 JD，用具体项目证据回答。").strip(),
            ))
            if len(questions) >= count:
                break
        return questions

    def _keywords(self, text: str) -> list[str]:
        normalized = " ".join(text.split())
        if not normalized:
            return []
        candidates = re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{1,}|[\u4e00-\u9fff]{2,}", normalized)
        seen: set[str] = set()
        keywords: list[str] = []
        stop_words = {"负责", "熟悉", "了解", "项目", "经验", "能力", "岗位", "要求", "优先", "相关"}
        for candidate in candidates:
            if candidate in stop_words or candidate.lower() in seen:
                continue
            seen.add(candidate.lower())
            keywords.append(candidate)
            if len(keywords) >= 8:
                break
        return keywords
