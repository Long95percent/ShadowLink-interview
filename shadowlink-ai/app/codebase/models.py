"""Codebase technical profile models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CodebaseProfileStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CodebaseProfile(BaseModel):
    repo_id: str
    name: str
    repo_path: str
    status: CodebaseProfileStatus = CodebaseProfileStatus.PENDING
    last_indexed_at: datetime | None = None
    last_error: str = ""
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CodebaseTechnicalDoc(BaseModel):
    repo_id: str
    overview: str = ""
    tech_stack: list[str] = Field(default_factory=list)
    architecture_summary: str = ""
    module_map: list[str] = Field(default_factory=list)
    key_flows: list[str] = Field(default_factory=list)
    important_files: list[str] = Field(default_factory=list)
    interview_talking_points: list[str] = Field(default_factory=list)
    risks_and_todos: list[str] = Field(default_factory=list)
    followup_questions: list[str] = Field(default_factory=list)
    raw_markdown: str = ""
    updated_at: datetime = Field(default_factory=utc_now)
