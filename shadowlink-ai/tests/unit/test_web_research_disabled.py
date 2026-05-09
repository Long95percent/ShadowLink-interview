"""Tests for disabled web research provider."""

from __future__ import annotations

import pytest

from app.integrations.web_research.disabled import DisabledWebResearchProvider


@pytest.mark.anyio
async def test_disabled_web_research_is_explicit():
    provider = DisabledWebResearchProvider()

    result = await provider.search_and_answer("latest langchain agent docs")

    assert result.enabled is False
    assert "未启用" in result.message
    assert result.sources == []

