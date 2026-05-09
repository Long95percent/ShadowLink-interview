"""API tests for codebase technical profiles."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import codebase_router
from app.codebase.repository import CodebaseRepository
from app.main import app


async def fake_generate_doc_task(repo_id: str, prompt: str) -> None:
    repo = codebase_router.get_repo()
    from app.codebase.models import CodebaseProfileStatus, CodebaseTechnicalDoc

    repo.save_doc(CodebaseTechnicalDoc(repo_id=repo_id, raw_markdown="# 技术档案\n\n## 架构\nFastAPI + React"))
    repo.mark_status(repo_id, CodebaseProfileStatus.COMPLETED)


@pytest.mark.anyio
async def test_codebase_profile_api(monkeypatch):
    data_dir = Path(".test-data") / f"codebase-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(codebase_router, "get_repo", lambda: CodebaseRepository(data_dir))
    monkeypatch.setattr(codebase_router, "generate_doc_task", fake_generate_doc_task)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            create_response = await client.post(
                "/v1/codebase/profiles",
                json={"name": "ShadowLink", "repo_path": "D:/github_desktop/ShadowLink"},
            )
            assert create_response.status_code == 200
            detail = create_response.json()["data"]
            repo_id = detail["profile"]["repo_id"]
            assert detail["profile"]["status"] == "pending"

            list_response = await client.get("/v1/codebase/profiles")
            assert list_response.status_code == 200
            assert len(list_response.json()["data"]) == 1

            generate_response = await client.post(f"/v1/codebase/profiles/{repo_id}/generate", json={"prompt": ""})
            assert generate_response.status_code == 200
            assert generate_response.json()["data"]["profile"]["status"] == "running"

            get_response = await client.get(f"/v1/codebase/profiles/{repo_id}")
            assert get_response.status_code == 200
            loaded = get_response.json()["data"]
            assert loaded["profile"]["status"] == "completed"
            assert "FastAPI" in loaded["doc"]["raw_markdown"]
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
