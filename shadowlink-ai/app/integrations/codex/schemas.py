"""Schemas for Codex CLI integration."""

from __future__ import annotations

from pydantic import BaseModel


class CodexStatus(BaseModel):
    installed: bool
    command: str | None = None
    version: str | None = None
    message: str = ""

