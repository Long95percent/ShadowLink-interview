"""Tests for interview review draft generation."""

from __future__ import annotations

from app.interview.models import SpaceProfile
from app.interview.review_service import CodeExpertReviewerProvider, ExternalLLMReviewerProvider, LocalHeuristicReviewerProvider, ReviewerProviderRegistry


def test_review_draft_uses_resume_and_jd_context():
    service = LocalHeuristicReviewerProvider()
    profile = SpaceProfile(
        space_id="space-ai",
        resume_text="做过 RAG 检索优化和 Agent 工具编排",
        jd_text="需要熟悉 RAG、LangChain、工程化落地",
        target_role="AI Application Engineer",
    )

    draft = service.generate_draft(
        profile=profile,
        original_answer="我做过一个知识库项目。",
    )

    assert draft.original_answer == "我做过一个知识库项目。"
    assert "AI Application Engineer" in draft.suggested_answer
    assert "RAG" in draft.critique
    assert draft.suggested_answer != draft.original_answer


def test_review_draft_handles_missing_profile_context():
    service = LocalHeuristicReviewerProvider()
    profile = SpaceProfile(space_id="space-empty")

    draft = service.generate_draft(profile=profile, original_answer="我参与过项目开发。")

    assert draft.original_answer == "我参与过项目开发。"
    assert "请先补充 Resume 和 JD" in draft.critique


def test_reviewer_registry_defaults_to_local_provider():
    registry = ReviewerProviderRegistry()

    provider = registry.get_provider("unknown")

    assert isinstance(provider, LocalHeuristicReviewerProvider)


def test_external_llm_provider_is_explicit_placeholder():
    provider = ExternalLLMReviewerProvider()
    profile = SpaceProfile(space_id="space-ai", resume_text="resume", jd_text="jd")

    draft = provider.generate_draft(profile=profile, original_answer="answer")

    assert draft.original_answer == "answer"
    assert "外部 LLM Reviewer 尚未配置" in draft.critique


def test_code_expert_provider_reports_missing_repo_path():
    provider = CodeExpertReviewerProvider()
    profile = SpaceProfile(space_id="space-ai", resume_text="resume", jd_text="jd")

    draft = provider.generate_draft(profile=profile, original_answer="answer")

    assert draft.original_answer == "answer"
    assert "未配置本地代码仓库路径" in draft.critique


def test_reviewer_registry_can_select_code_expert_provider():
    registry = ReviewerProviderRegistry()

    provider = registry.get_provider("code_expert")

    assert isinstance(provider, CodeExpertReviewerProvider)
