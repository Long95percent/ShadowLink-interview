"""Tests for external agent run execution."""

from __future__ import annotations

import shutil
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

from app.interview.external_runner import ExternalAgentRunExecutor
from app.interview.models import TaskStatus
from app.interview.repository import InterviewRepository


class FakeCodexAdapter:
    async def run_readonly(self, repo_path: str, prompt: str) -> AsyncIterator[dict]:
        yield {"event": "codex_event", "data": {"raw": "analysis started"}}
        yield {"event": "codex_done", "data": {"return_code": 0}}


class FailingCodexAdapter:
    async def run_readonly(self, repo_path: str, prompt: str) -> AsyncIterator[dict]:
        yield {"event": "error", "data": {"message": "codex unavailable"}}


def make_repo() -> tuple[InterviewRepository, Path]:
    data_dir = Path(".test-data") / f"external-runner-{uuid.uuid4().hex}"
    return InterviewRepository(data_dir), data_dir


@pytest.mark.anyio
async def test_executor_marks_run_completed():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("AI", "ai_engineer", "code-dev")
        session = repo.create_session(space.space_id, "AI interview")
        run = repo.create_external_agent_run(space.space_id, session.session_id, "D:/repo", "analyze")

        executor = ExternalAgentRunExecutor(repo=repo, codex_adapter=FakeCodexAdapter())
        updated = await executor.execute(run.run_id)

        assert updated.status == TaskStatus.COMPLETED
        assert "analysis started" in updated.output_summary
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_executor_marks_run_failed_on_error_event():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("AI", "ai_engineer", "code-dev")
        session = repo.create_session(space.space_id, "AI interview")
        run = repo.create_external_agent_run(space.space_id, session.session_id, "D:/repo", "analyze")

        executor = ExternalAgentRunExecutor(repo=repo, codex_adapter=FailingCodexAdapter())
        updated = await executor.execute(run.run_id)

        assert updated.status == TaskStatus.FAILED
        assert "codex unavailable" in updated.error_message
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)

