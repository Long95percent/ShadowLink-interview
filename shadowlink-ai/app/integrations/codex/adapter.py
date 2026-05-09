"""Readonly Codex CLI expert-mode adapter."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.integrations.codex.detector import detect_codex


class CodexExpertAdapter:
    async def run_readonly(self, repo_path: str, prompt: str) -> AsyncIterator[dict]:
        status = detect_codex()
        if not status.installed or not status.command:
            yield {"event": "error", "data": {"message": status.message}}
            return

        process = await asyncio.create_subprocess_exec(
            status.command,
            "exec",
            "--cd",
            repo_path,
            "--sandbox",
            "read-only",
            "--ask-for-approval",
            "never",
            "--json",
            prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        assert process.stdout is not None
        async for line in process.stdout:
            yield {"event": "codex_event", "data": {"raw": line.decode("utf-8", errors="ignore").strip()}}

        return_code = await process.wait()
        yield {"event": "codex_done", "data": {"return_code": return_code}}

