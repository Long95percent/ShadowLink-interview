"""Codex-backed codebase technical document generation."""

from __future__ import annotations

from typing import Any

from app.codebase.models import CodebaseProfileStatus, CodebaseTechnicalDoc
from app.codebase.repository import CodebaseRepository
from app.integrations.codex.adapter import CodexExpertAdapter


DEFAULT_CODEBASE_PROMPT = """
请对这个代码库生成一份非常详细的技术档案，用 Markdown 输出。
必须覆盖：
1. 项目定位与业务目标
2. 技术栈总览
3. 前端架构
4. 后端架构
5. AI / Agent / RAG / LLM 集成架构
6. 数据模型和持久化策略
7. 关键业务链路
8. 核心模块与重要文件路径
9. 可用于面试表达的技术亮点
10. 当前风险、限制和后续改进
11. 面试官可能追问的问题
请尽量引用具体目录和文件名，输出要适合后续普通 LLM 检索和回答面试问题。
""".strip()


class CodebaseProfileService:
    def __init__(self, repo: CodebaseRepository, codex_adapter: Any | None = None) -> None:
        self.repo = repo
        self.codex_adapter = codex_adapter or CodexExpertAdapter()

    async def generate_doc(self, repo_id: str, prompt: str = "") -> CodebaseTechnicalDoc:
        profile = self.repo.get_profile(repo_id)
        self.repo.mark_status(repo_id, CodebaseProfileStatus.RUNNING)
        output_parts: list[str] = []
        final_prompt = prompt.strip() or DEFAULT_CODEBASE_PROMPT

        async for event in self.codex_adapter.run_readonly(profile.repo_path, final_prompt):
            event_name = event.get("event", "")
            data = event.get("data", {}) or {}
            if event_name == "error":
                message = str(data.get("message") or data.get("raw") or "Codex profile generation failed")
                self.repo.mark_status(repo_id, CodebaseProfileStatus.FAILED, error=message)
                raise RuntimeError(message)
            if event_name == "codex_event":
                raw = str(data.get("raw") or "").strip()
                if raw:
                    output_parts.append(raw)

        raw_markdown = "\n".join(output_parts).strip()
        doc = CodebaseTechnicalDoc(
            repo_id=repo_id,
            overview=self._section_or_head(raw_markdown),
            architecture_summary=self._section_or_head(raw_markdown),
            raw_markdown=raw_markdown,
        )
        saved = self.repo.save_doc(doc)
        self.repo.mark_status(repo_id, CodebaseProfileStatus.COMPLETED)
        return saved

    def _section_or_head(self, markdown: str) -> str:
        normalized = markdown.strip()
        if not normalized:
            return ""
        return normalized[:1200]
