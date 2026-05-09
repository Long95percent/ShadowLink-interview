"""Codex CLI installation detection."""

from __future__ import annotations

import platform
import shutil
import subprocess

from app.integrations.codex.schemas import CodexStatus


def detect_codex() -> CodexStatus:
    candidates = ["codex.cmd", "codex"] if platform.system().lower() == "windows" else ["codex"]
    for candidate in candidates:
        command = shutil.which(candidate)
        if not command:
            continue
        try:
            result = subprocess.run([command, "--version"], capture_output=True, text=True, timeout=5)
            output = (result.stdout or result.stderr).strip()
            version = output.splitlines()[0] if output else "unknown"
            return CodexStatus(installed=True, command=command, version=version)
        except Exception as exc:
            return CodexStatus(installed=True, command=command, message=str(exc))
    return CodexStatus(
        installed=False,
        message="Codex CLI not found. Install Node.js, run `npm install -g @openai/codex`, then run `codex login`.",
    )

