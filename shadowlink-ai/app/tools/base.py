"""Base tool class — foundation for all ShadowLink tools.

All built-in tools inherit from ShadowLinkTool, which provides:
- Unified interface compatible with both LangChain and MCP
- Automatic metrics collection (latency, success rate)
- Mode-aware execution context
- Timeout and error handling
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any

import structlog
from langchain_core.tools import BaseTool
from pydantic import Field

from app.models.mcp import ToolCategory, ToolInfo

logger = structlog.get_logger("tools.base")


class ShadowLinkTool(BaseTool, ABC):
    """Base class for all ShadowLink tools.

    Subclasses must implement:
    - _run(): Synchronous execution
    - _arun(): Async execution (preferred)

    Provides:
    - Automatic MCP ToolInfo conversion
    - Latency tracking
    - Error wrapping
    """

    category: ToolCategory = Field(default=ToolCategory.SYSTEM)
    timeout_seconds: int = Field(default=30)
    requires_confirmation: bool = Field(default=False)

    def to_tool_info(self) -> ToolInfo:
        """Convert to MCP-compatible ToolInfo."""
        return ToolInfo(
            name=self.name,
            description=self.description or "",
            category=self.category,
            input_schema=self.args_schema.model_json_schema() if self.args_schema else {},
            is_async=True,
            timeout_seconds=self.timeout_seconds,
            requires_confirmation=self.requires_confirmation,
        )

    async def safe_arun(self, **kwargs: Any) -> str:
        """Run with timeout and error handling."""
        start = time.perf_counter()
        try:
            result = await self._arun(**kwargs)
            elapsed = (time.perf_counter() - start) * 1000
            await logger.ainfo("tool_executed", tool=self.name, latency_ms=round(elapsed, 2))
            return str(result)
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            await logger.aerror("tool_failed", tool=self.name, error=str(exc), latency_ms=round(elapsed, 2))
            return f"Error: {exc}"
