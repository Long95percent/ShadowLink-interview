"""External coding-agent run executor."""

from __future__ import annotations

from typing import Any

from app.integrations.codex.adapter import CodexExpertAdapter
from app.interview.models import ExternalAgentRun, TaskStatus
from app.interview.repository import InterviewRepository


class ExternalAgentRunExecutor:
    def __init__(self, repo: InterviewRepository, codex_adapter: Any | None = None) -> None:
        self.repo = repo
        self.codex_adapter = codex_adapter or CodexExpertAdapter()

    async def execute(self, run_id: str) -> ExternalAgentRun:
        run = self.repo.get_external_agent_run(run_id)
        self.repo.update_external_agent_run(run.run_id, status=TaskStatus.RUNNING)

        output_parts: list[str] = []
        async for event in self.codex_adapter.run_readonly(run.repo_path, run.prompt):
            event_name = event.get("event", "")
            data = event.get("data", {}) or {}
            if event_name == "error":
                message = str(data.get("message") or data.get("raw") or "Codex run failed")
                return self.repo.update_external_agent_run(run.run_id, status=TaskStatus.FAILED, error_message=message)
            if event_name == "codex_event":
                raw = str(data.get("raw") or "").strip()
                if raw:
                    output_parts.append(raw)

        summary = "\n".join(output_parts)[-4000:]
        return self.repo.update_external_agent_run(run.run_id, status=TaskStatus.COMPLETED, output_summary=summary)

