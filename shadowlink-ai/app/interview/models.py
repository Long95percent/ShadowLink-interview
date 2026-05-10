"""Domain models for the interview learning module."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SpaceType(str, Enum):
    AI_ENGINEER = "ai_engineer"
    PRODUCT_MANAGER = "product_manager"
    JAPANESE_EXAM = "japanese_exam"
    CUSTOM = "custom"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    REGENERATED = "regenerated"


class TaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_USER_REVIEW = "waiting_user_review"
    COMPLETED = "completed"
    FAILED = "failed"


class SessionMode(str, Enum):
    INTERVIEW_AGENT = "interview_agent"
    READING_WORKSPACE = "reading_workspace"


class ExternalAgentProvider(str, Enum):
    CODEX_CLI = "codex_cli"
    CLAUDE_CODE = "claude_code"


class InterviewSkill(BaseModel):
    skill_id: str
    name: str
    description: str = ""
    instruction: str
    source: str = "custom"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class JobSpace(BaseModel):
    space_id: str
    name: str
    type: SpaceType = SpaceType.CUSTOM
    theme: str = "general"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SpaceProfile(BaseModel):
    space_id: str
    resume_text: str = ""
    jd_text: str = ""
    target_company: str = ""
    target_role: str = ""
    notes: str = ""
    updated_at: datetime = Field(default_factory=utc_now)


class ProjectDocument(BaseModel):
    document_id: str
    space_id: str
    filename: str
    content: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class InterviewSession(BaseModel):
    session_id: str
    space_id: str
    title: str = ""
    mode: SessionMode = SessionMode.INTERVIEW_AGENT
    status: TaskStatus = TaskStatus.COMPLETED
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class InterviewReview(BaseModel):
    review_id: str
    space_id: str
    session_id: str
    original_answer: str
    suggested_answer: str
    critique: str
    token_usage: dict = Field(default_factory=dict)
    status: ReviewStatus = ReviewStatus.PENDING
    created_at: datetime = Field(default_factory=utc_now)


class ExternalAgentRun(BaseModel):
    run_id: str
    space_id: str
    session_id: str
    provider: ExternalAgentProvider = ExternalAgentProvider.CODEX_CLI
    repo_path: str
    prompt: str = ""
    status: TaskStatus = TaskStatus.QUEUED
    output_summary: str = ""
    error_message: str = ""
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ReadingProgress(BaseModel):
    space_id: str
    article_id: str
    article_title: str = ""
    completed_count: int = Field(default=0, ge=0)
    total_count: int = Field(default=0, ge=0)
    difficult_sentences: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=utc_now)

    @model_validator(mode="after")
    def clamp_completed_count(self) -> "ReadingProgress":
        if self.completed_count > self.total_count:
            self.completed_count = self.total_count
        return self
