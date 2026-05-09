"""Provider abstraction for optional web research."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.integrations.web_research.schemas import WebResearchResult


class WebResearchProvider(ABC):
    @abstractmethod
    async def search_and_answer(self, query: str) -> WebResearchResult:
        raise NotImplementedError

