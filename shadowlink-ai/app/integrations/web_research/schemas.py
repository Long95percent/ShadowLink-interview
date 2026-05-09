"""Schemas for web research providers."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WebSource(BaseModel):
    title: str = ""
    url: str = ""
    snippet: str = ""
    provider: str = "manual"


class WebResearchResult(BaseModel):
    enabled: bool
    answer: str = ""
    sources: list[WebSource] = Field(default_factory=list)
    message: str = ""

