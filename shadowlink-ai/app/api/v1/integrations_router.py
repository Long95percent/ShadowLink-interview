"""Integration status endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.integrations.codex.detector import detect_codex
from app.integrations.codex.schemas import CodexStatus
from app.models.common import Result

router = APIRouter()


@router.get("/codex/status")
async def codex_status() -> Result[CodexStatus]:
    return Result.ok(data=detect_codex())

