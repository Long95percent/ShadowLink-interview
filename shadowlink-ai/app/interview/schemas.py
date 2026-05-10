"""API schemas for the interview learning module."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.interview.models import ExternalAgentRun, InterviewReview, InterviewSession, InterviewSkill, JobSpace, ProjectDocument, ReadingProgress, ReviewStatus, SessionMode, SpaceProfile, SpaceType, TaskStatus


class CreateSpaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: SpaceType = SpaceType.CUSTOM
    theme: str = "general"


class UpdateSpaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: SpaceType = SpaceType.CUSTOM
    theme: str = "general"


class UpdateProfileRequest(BaseModel):
    resume_text: str = ""
    jd_text: str = ""
    target_company: str = ""
    target_role: str = ""
    notes: str = ""


class ParsedResumeResponse(BaseModel):
    filename: str
    content: str


class UpsertInterviewSkillRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    instruction: str = Field(min_length=1, max_length=12000)


class UploadInterviewSkillResponse(BaseModel):
    skill: InterviewSkill


class UploadProjectDocumentResponse(BaseModel):
    document: ProjectDocument


class SpaceDetail(BaseModel):
    space: JobSpace
    profile: SpaceProfile


class TaskStatusResponse(BaseModel):
    task_id: str
    space_id: str
    session_id: str | None = None
    status: TaskStatus
    message: str = ""
    updated_at: str


class CreateSessionRequest(BaseModel):
    title: str = Field(default="Interview Session", max_length=100)
    mode: SessionMode = SessionMode.INTERVIEW_AGENT


class CreateReviewRequest(BaseModel):
    original_answer: str = Field(min_length=1)
    suggested_answer: str = ""
    critique: str = ""
    revision_instruction: str = Field(default="", max_length=2000)
    reviewer_provider: str | None = None
    repo_path: str | None = None
    interviewer_skill: str = Field(default="technical_interviewer", max_length=50)
    codebase_repo_id: str | None = None
    llm_config: dict | None = None


class GenerateInterviewQuestionsRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=10)
    difficulty: str = Field(default="mixed", max_length=30)
    interviewer_skill: str = Field(default="technical_interviewer", max_length=50)
    codebase_repo_id: str | None = None
    llm_config: dict | None = None


class InterviewQuestion(BaseModel):
    question: str
    focus: str
    answer_hint: str = ""


class GenerateInterviewQuestionsResponse(BaseModel):
    questions: list[InterviewQuestion]
    provider: str = "local_fallback"
    message: str = ""


class UpdateReviewStatusRequest(BaseModel):
    status: ReviewStatus


class SessionDetail(BaseModel):
    session: InterviewSession
    reviews: list[InterviewReview] = []


class CreateExternalAgentRunRequest(BaseModel):
    repo_path: str = Field(min_length=1)
    prompt: str = Field(default="", max_length=4000)


class ExternalAgentRunDetail(BaseModel):
    run: ExternalAgentRun


class UpdateReadingProgressRequest(BaseModel):
    article_title: str = ""
    completed_count: int = Field(default=0, ge=0)
    total_count: int = Field(default=0, ge=0)
    difficult_sentences: list[str] = Field(default_factory=list)


class ReadingProgressDetail(BaseModel):
    progress: ReadingProgress


class SplitReadingRequest(BaseModel):
    text: str = Field(min_length=1)


class SplitReadingResponse(BaseModel):
    sentences: list[str]


class ExplainSentenceRequest(BaseModel):
    sentence: str = Field(min_length=1)
    article_title: str = ""
