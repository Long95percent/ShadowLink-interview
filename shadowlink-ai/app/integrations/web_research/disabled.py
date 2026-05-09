"""Disabled web research provider used before paid/search APIs are configured."""

from __future__ import annotations

from app.integrations.web_research.base import WebResearchProvider
from app.integrations.web_research.schemas import WebResearchResult


class DisabledWebResearchProvider(WebResearchProvider):
    async def search_and_answer(self, query: str) -> WebResearchResult:
        return WebResearchResult(
            enabled=False,
            message="网页搜索当前未启用。请手动粘贴 URL 或网页正文，后续可接入模型 API 内置搜索。",
        )

