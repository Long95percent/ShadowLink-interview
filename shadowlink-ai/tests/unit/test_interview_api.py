"""API tests for interview learning spaces."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import interview_router
from app.codebase.models import CodebaseTechnicalDoc
from app.codebase.repository import CodebaseRepository
from app.core.dependencies import set_resource
from app.interview.repository import InterviewRepository
from app.main import app


class NoopExternalAgentRunExecutor:
    def __init__(self, repo):
        self.repo = repo

    async def execute(self, run_id: str):
        return self.repo.get_external_agent_run(run_id)


class FakeQuestionLLMClient:
    async def chat(self, message: str, *, model=None, system_prompt=None, temperature=None, max_tokens=None):
        assert "简历" in message
        assert "岗位 JD" in message
        assert "project_deep_dive" in message
        assert "连续深挖" in message
        return '{"questions":[{"question":"请深入介绍 ShadowLink RAG Agent 项目如何匹配 AI Application Engineer 岗位？","focus":"项目深挖","answer_hint":"结合 RAG、Agent 和 FastAPI 说明工程价值。"}]}'


class CapturingOpenAIProvider:
    captured = {}
    messages = []

    def __init__(self, base_url=None, api_key=None, default_model=None):
        CapturingOpenAIProvider.captured = {
            "base_url": base_url,
            "api_key": api_key,
            "default_model": default_model,
        }

    async def chat(self, message: str, *, model=None, system_prompt=None, temperature=None, max_tokens=None):
        CapturingOpenAIProvider.messages.append(message)
        if "Candidate answer:" in message:
            return '{"critique":"回答有项目证据，但需要补充量化指标。","suggested_answer":"建议用 STAR 结构重写回答。"}'
        return '{"questions":[{"question":"请求级配置题目","focus":"配置覆盖","answer_hint":"使用前端传入的配置。"}]}'


@pytest.mark.anyio
async def test_create_and_list_spaces(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/v1/interview/spaces", json={
                "name": "AI Engineer",
                "type": "ai_engineer",
                "theme": "code-dev",
            })
            assert response.status_code == 200
            payload = response.json()
            assert payload["data"]["space"]["name"] == "AI Engineer"

            response = await client.get("/v1/interview/spaces")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 1
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_update_profile_requires_existing_space(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.put("/v1/interview/spaces/missing/profile", json={
                "resume_text": "resume",
                "jd_text": "jd",
            })
            assert response.status_code == 404
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_parse_resume_draft_without_existing_space(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router.settings, "data_dir", str(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/v1/interview/profile/resume/parse",
                files={"file": ("resume.txt", b"ShadowLink RAG Agent resume", "text/plain")},
            )

            assert response.status_code == 200
            payload = response.json()["data"]
            assert payload["filename"] == "resume.txt"
            assert "ShadowLink RAG Agent resume" in payload["content"]
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_create_session_and_review(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={
                "resume_text": "做过 RAG 检索优化",
                "jd_text": "需要熟悉 LangChain 和 RAG 工程化",
                "target_role": "AI Application Engineer",
            })

            session_response = await client.post(f"/v1/interview/spaces/{space_id}/sessions", json={"title": "RAG interview"})
            assert session_response.status_code == 200
            session_id = session_response.json()["data"]["session_id"]

            review_response = await client.post(
                f"/v1/interview/spaces/{space_id}/sessions/{session_id}/reviews",
                json={"original_answer": "my answer"},
            )
            assert review_response.status_code == 200
            review = review_response.json()["data"]
            assert review["original_answer"] == "my answer"
            assert review["status"] == "pending"
            assert "AI Application Engineer" in review["suggested_answer"]
            assert "RAG" in review["critique"]

            list_response = await client.get(f"/v1/interview/spaces/{space_id}/sessions/{session_id}/reviews")
            assert len(list_response.json()["data"]) == 1
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_review_rejects_session_from_other_space(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            ai_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            pm_response = await client.post("/v1/interview/spaces", json={"name": "PM", "type": "product_manager"})
            ai_space_id = ai_response.json()["data"]["space"]["space_id"]
            pm_space_id = pm_response.json()["data"]["space"]["space_id"]
            session_response = await client.post(f"/v1/interview/spaces/{ai_space_id}/sessions", json={"title": "AI"})
            session_id = session_response.json()["data"]["session_id"]

            response = await client.post(
                f"/v1/interview/spaces/{pm_space_id}/sessions/{session_id}/reviews",
                json={"original_answer": "wrong space"},
            )
            assert response.status_code == 404
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_generate_interview_questions_from_profile(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={
                "resume_text": "ShadowLink RAG Agent 工程化 项目",
                "jd_text": "需要 LangChain RAG Agent FastAPI 经验",
                "target_role": "AI Application Engineer",
                "target_company": "TestCo",
            })

            response = await client.post(f"/v1/interview/spaces/{space_id}/interview/questions", json={"count": 3})

            assert response.status_code == 200
            questions = response.json()["data"]["questions"]
            assert len(questions) == 3
            assert questions[0]["question"]
            assert questions[0]["focus"]
            assert questions[0]["answer_hint"]
    finally:
        set_resource("llm_client", None)
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_generate_interview_questions_uses_configured_llm(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    set_resource("llm_client", FakeQuestionLLMClient())

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={
                "resume_text": "ShadowLink RAG Agent 工程化 项目",
                "jd_text": "需要 LangChain RAG Agent FastAPI 经验",
                "target_role": "AI Application Engineer",
            })

            response = await client.post(
                f"/v1/interview/spaces/{space_id}/interview/questions",
                json={"count": 1, "interviewer_skill": "project_deep_dive"},
            )

            payload = response.json()["data"]
            assert payload["provider"] == "llm"
            assert "ShadowLink RAG Agent" in payload["questions"][0]["question"]
    finally:
        set_resource("llm_client", None)
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_generate_interview_questions_uses_request_llm_config(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    monkeypatch.setattr(interview_router, "OpenAIProvider", CapturingOpenAIProvider)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={
                "resume_text": "简历",
                "jd_text": "JD",
            })

            response = await client.post(f"/v1/interview/spaces/{space_id}/interview/questions", json={
                "count": 1,
                "llm_config": {
                    "baseUrl": "https://example.com/v1",
                    "apiKey": "request-key",
                    "model": "request-model",
                },
            })

            assert response.status_code == 200
            assert CapturingOpenAIProvider.captured["base_url"] == "https://example.com/v1"
            assert CapturingOpenAIProvider.captured["api_key"] == "request-key"
            assert CapturingOpenAIProvider.captured["default_model"] == "request-model"
            assert response.json()["data"]["provider"] == "llm"
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_generate_interview_questions_excludes_codebase_doc(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    codebase_dir = Path(".test-data") / f"codebase-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    monkeypatch.setattr(interview_router, "get_codebase_repo", lambda: CodebaseRepository(codebase_dir))
    monkeypatch.setattr(interview_router, "OpenAIProvider", CapturingOpenAIProvider)
    CapturingOpenAIProvider.messages = []

    try:
        codebase_repo = CodebaseRepository(codebase_dir)
        profile = codebase_repo.create_profile("ShadowLink", "D:/github_desktop/ShadowLink")
        codebase_repo.save_doc(CodebaseTechnicalDoc(repo_id=profile.repo_id, raw_markdown="ShadowLink 技术档案：FastAPI + React + RAG Agent"))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={"resume_text": "简历", "jd_text": "JD"})

            response = await client.post(f"/v1/interview/spaces/{space_id}/interview/questions", json={
                "count": 1,
                "codebase_repo_id": profile.repo_id,
                "llm_config": {"baseUrl": "https://example.com/v1", "apiKey": "request-key", "model": "request-model"},
            })

            assert response.status_code == 200
            assert not any("ShadowLink 技术档案" in message for message in CapturingOpenAIProvider.messages)
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
        shutil.rmtree(codebase_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_upload_list_and_delete_interview_skill(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            upload_response = await client.post(
                "/v1/interview/skills/upload",
                files={"file": ("ai-infra.json", '{"id":"custom-ai-infra","name":"AI Infra 面试官","instruction":"严格追问 RAG 和 Agent。"}', "application/json")},
            )
            assert upload_response.status_code == 200
            assert upload_response.json()["data"]["skill"]["skill_id"] == "custom-ai-infra"

            list_response = await client.get("/v1/interview/skills")
            assert list_response.json()["data"][0]["name"] == "AI Infra 面试官"

            delete_response = await client.delete("/v1/interview/skills/custom-ai-infra")
            assert delete_response.json()["data"]["deleted"] is True
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_create_review_uses_request_llm_and_records_token_usage(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    monkeypatch.setattr(interview_router, "OpenAIProvider", CapturingOpenAIProvider)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            session_response = await client.post(f"/v1/interview/spaces/{space_id}/sessions", json={"title": "AI"})
            session_id = session_response.json()["data"]["session_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={
                "resume_text": "做过 RAG Agent 项目",
                "jd_text": "需要 AI 工程经验",
            })

            response = await client.post(f"/v1/interview/spaces/{space_id}/sessions/{session_id}/reviews", json={
                "original_answer": "我做过 ShadowLink 项目。",
                "llm_config": {"baseUrl": "https://example.com/v1", "apiKey": "request-key", "model": "request-model"},
            })

            review = response.json()["data"]
            assert response.status_code == 200
            assert review["suggested_answer"] == "建议用 STAR 结构重写回答。"
            assert review["token_usage"]["provider"] == "llm"
            assert review["token_usage"]["total_tokens_estimated"] > 0
            assert CapturingOpenAIProvider.captured["api_key"] == "request-key"
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_create_review_includes_codebase_doc(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    codebase_dir = Path(".test-data") / f"codebase-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    monkeypatch.setattr(interview_router, "get_codebase_repo", lambda: CodebaseRepository(codebase_dir))
    monkeypatch.setattr(interview_router, "OpenAIProvider", CapturingOpenAIProvider)
    CapturingOpenAIProvider.messages = []

    try:
        codebase_repo = CodebaseRepository(codebase_dir)
        profile = codebase_repo.create_profile("ShadowLink", "D:/github_desktop/ShadowLink")
        codebase_repo.save_doc(CodebaseTechnicalDoc(repo_id=profile.repo_id, raw_markdown="ShadowLink 审阅档案：外接 API、Codex、面试训练模块"))

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            session_response = await client.post(f"/v1/interview/spaces/{space_id}/sessions", json={"title": "AI"})
            session_id = session_response.json()["data"]["session_id"]
            await client.put(f"/v1/interview/spaces/{space_id}/profile", json={"resume_text": "简历", "jd_text": "JD"})

            response = await client.post(f"/v1/interview/spaces/{space_id}/sessions/{session_id}/reviews", json={
                "original_answer": "我做过 ShadowLink。",
                "codebase_repo_id": profile.repo_id,
                "llm_config": {"baseUrl": "https://example.com/v1", "apiKey": "request-key", "model": "request-model"},
            })

            assert response.status_code == 200
            assert any("ShadowLink 审阅档案" in message for message in CapturingOpenAIProvider.messages)
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
        shutil.rmtree(codebase_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_parse_resume_txt_file(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]

            response = await client.post(
                f"/v1/interview/spaces/{space_id}/profile/resume/parse",
                files={"file": ("resume.txt", "做过 RAG Agent 项目", "text/plain")},
            )

            assert response.status_code == 200
            assert response.json()["data"]["filename"] == "resume.txt"
            assert "RAG Agent" in response.json()["data"]["content"]
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_create_review_without_llm_config_returns_error(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            session_response = await client.post(f"/v1/interview/spaces/{space_id}/sessions", json={"title": "AI"})
            session_id = session_response.json()["data"]["session_id"]

            response = await client.post(
                f"/v1/interview/spaces/{space_id}/sessions/{session_id}/reviews",
                json={"original_answer": "answer", "reviewer_provider": "external_llm"},
            )

            assert response.status_code == 500
            assert "LLM reviewer is not configured" in response.text
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_create_and_list_external_agent_runs(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))
    monkeypatch.setattr(interview_router, "ExternalAgentRunExecutor", NoopExternalAgentRunExecutor)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            space_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            space_id = space_response.json()["data"]["space"]["space_id"]
            session_response = await client.post(f"/v1/interview/spaces/{space_id}/sessions", json={"title": "AI"})
            session_id = session_response.json()["data"]["session_id"]

            create_response = await client.post(
                f"/v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs",
                json={"repo_path": "D:/repo", "prompt": "analyze project"},
            )
            assert create_response.status_code == 200
            run = create_response.json()["data"]
            assert run["status"] == "queued"
            assert run["provider"] == "codex_cli"

            list_response = await client.get(f"/v1/interview/spaces/{space_id}/sessions/{session_id}/external-runs")
            assert len(list_response.json()["data"]) == 1
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.mark.anyio
async def test_reading_split_and_explain():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        split_response = await client.post("/v1/interview/reading/split", json={
            "text": "本日はありがとうございます。資料を確認しました！"
        })
        assert split_response.status_code == 200
        assert split_response.json()["data"]["sentences"] == ["本日はありがとうございます。", "資料を確認しました！"]

        explain_response = await client.post("/v1/interview/reading/explain", json={
            "sentence": "資料を確認しました！",
            "article_title": "職場メール",
        })
        assert explain_response.status_code == 200
        assert "職場メール" in explain_response.json()["data"]["context_note"]

@pytest.mark.anyio
async def test_reading_progress_api_is_scoped_by_space(monkeypatch):
    data_dir = Path(".test-data") / f"interview-api-{uuid.uuid4().hex}"
    monkeypatch.setattr(interview_router, "get_repo", lambda: InterviewRepository(data_dir))

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            ai_response = await client.post("/v1/interview/spaces", json={"name": "AI", "type": "ai_engineer"})
            jp_response = await client.post("/v1/interview/spaces", json={"name": "JP", "type": "japanese_exam"})
            ai_space_id = ai_response.json()["data"]["space"]["space_id"]
            jp_space_id = jp_response.json()["data"]["space"]["space_id"]

            update_response = await client.put(
                f"/v1/interview/spaces/{jp_space_id}/reading/progress/article-1",
                json={
                    "article_title": "職場メール",
                    "completed_count": 2,
                    "total_count": 5,
                    "difficult_sentences": ["資料を確認しました。"],
                },
            )
            assert update_response.status_code == 200
            assert update_response.json()["data"]["completed_count"] == 2

            jp_get_response = await client.get(f"/v1/interview/spaces/{jp_space_id}/reading/progress/article-1")
            assert jp_get_response.json()["data"]["difficult_sentences"] == ["資料を確認しました。"]

            ai_get_response = await client.get(f"/v1/interview/spaces/{ai_space_id}/reading/progress/article-1")
            assert ai_get_response.json()["data"]["completed_count"] == 0
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
