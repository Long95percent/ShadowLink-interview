"""API schemas for codebase technical profiles."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.codebase.models import CodebaseProfile, CodebaseTechnicalDoc


class CreateCodebaseProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    repo_path: str = Field(min_length=1)


class GenerateCodebaseDocRequest(BaseModel):
    prompt: str = ""


class CodebaseProfileDetail(BaseModel):
    profile: CodebaseProfile
    doc: CodebaseTechnicalDoc | None = None
