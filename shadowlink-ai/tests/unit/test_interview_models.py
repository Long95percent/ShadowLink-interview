"""Unit tests for interview learning domain models."""

from __future__ import annotations

from app.interview.models import ExternalAgentProvider, ExternalAgentRun, InterviewReview, InterviewSession, JobSpace, ReadingProgress, ReviewStatus, SessionMode, SpaceProfile, SpaceType, TaskStatus


def test_job_space_defaults():
    space = JobSpace(space_id="space-1", name="AI Engineer")

    assert space.space_id == "space-1"
    assert space.type == SpaceType.CUSTOM
    assert space.theme == "general"


def test_space_profile_is_scoped_by_space_id():
    profile = SpaceProfile(space_id="space-ai", resume_text="resume", jd_text="jd")

    assert profile.space_id == "space-ai"
    assert profile.resume_text == "resume"
    assert profile.jd_text == "jd"


def test_interview_session_belongs_to_space():
    session = InterviewSession(session_id="session-1", space_id="space-ai", title="RAG interview")

    assert session.session_id == "session-1"
    assert session.space_id == "space-ai"
    assert session.mode == SessionMode.INTERVIEW_AGENT


def test_review_keeps_original_answer_pending():
    review = InterviewReview(
        review_id="review-1",
        space_id="space-ai",
        session_id="session-1",
        original_answer="my answer",
        suggested_answer="better answer",
        critique="needs stronger code evidence",
    )

    assert review.original_answer == "my answer"
    assert review.suggested_answer == "better answer"
    assert review.status == ReviewStatus.PENDING


def test_external_agent_run_defaults_to_queued_codex():
    run = ExternalAgentRun(run_id="run-1", space_id="space-ai", session_id="session-1", repo_path="D:/repo")

    assert run.provider == ExternalAgentProvider.CODEX_CLI
    assert run.status == TaskStatus.QUEUED
    assert run.repo_path == "D:/repo"


def test_reading_progress_defaults():
    progress = ReadingProgress(space_id="space-jp", article_id="article-1", article_title="職場メール")

    assert progress.completed_count == 0
    assert progress.difficult_sentences == []
    assert progress.article_title == "職場メール"


def test_reading_progress_default_difficult_sentences_are_isolated():
    first = ReadingProgress(space_id="space-jp", article_id="article-1")
    second = ReadingProgress(space_id="space-jp", article_id="article-2")

    first.difficult_sentences.append("資料を確認しました。")

    assert second.difficult_sentences == []


def test_reading_progress_clamps_completed_count_to_total_count():
    progress = ReadingProgress(space_id="space-jp", article_id="article-1", completed_count=8, total_count=3)

    assert progress.completed_count == 3
