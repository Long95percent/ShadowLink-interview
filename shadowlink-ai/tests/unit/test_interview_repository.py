"""Unit tests for interview learning persistence."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.interview.models import InterviewSkill, ReadingProgress, ReviewStatus, SpaceProfile, TaskStatus
from app.interview.repository import InterviewRepository


def make_repo() -> tuple[InterviewRepository, Path]:
    data_dir = Path(".test-data") / f"interview-{uuid.uuid4().hex}"
    return InterviewRepository(data_dir), data_dir


def test_create_space_creates_empty_profile():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("AI Engineer", "ai_engineer", "code-dev")
        profile = repo.get_profile(space.space_id)

        assert space.name == "AI Engineer"
        assert profile.space_id == space.space_id
        assert profile.resume_text == ""
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_update_profile_isolated_by_space():
    repo, data_dir = make_repo()

    try:
        ai = repo.create_space("AI", "ai_engineer", "code-dev")
        pm = repo.create_space("PM", "product_manager", "project-management")

        repo.update_profile(SpaceProfile(space_id=ai.space_id, resume_text="ai resume", jd_text="ai jd"))

        assert repo.get_profile(ai.space_id).resume_text == "ai resume"
        assert repo.get_profile(pm.space_id).resume_text == ""
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_create_session_isolated_by_space():
    repo, data_dir = make_repo()

    try:
        ai = repo.create_space("AI", "ai_engineer", "code-dev")
        pm = repo.create_space("PM", "product_manager", "project-management")

        ai_session = repo.create_session(ai.space_id, "AI interview")
        repo.create_session(pm.space_id, "PM interview")

        assert repo.list_sessions(ai.space_id) == [ai_session]
        assert repo.list_sessions(pm.space_id)[0].space_id == pm.space_id
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_create_review_and_accept_without_overwriting_original():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("AI", "ai_engineer", "code-dev")
        session = repo.create_session(space.space_id, "AI interview")

        review = repo.create_review(
            space_id=space.space_id,
            session_id=session.session_id,
            original_answer="my answer",
            suggested_answer="better answer",
            critique="needs stronger project evidence",
        )
        accepted = repo.update_review_status(review.review_id, ReviewStatus.ACCEPTED)

        assert accepted.original_answer == "my answer"
        assert accepted.suggested_answer == "better answer"
        assert accepted.status == ReviewStatus.ACCEPTED
        assert repo.list_reviews(space.space_id, session.session_id)[0].review_id == review.review_id
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_create_external_agent_run_and_update_status():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("AI", "ai_engineer", "code-dev")
        session = repo.create_session(space.space_id, "AI interview")

        run = repo.create_external_agent_run(
            space_id=space.space_id,
            session_id=session.session_id,
            repo_path="D:/repo",
            prompt="analyze project",
        )
        updated = repo.update_external_agent_run(run.run_id, status=TaskStatus.RUNNING, output_summary="started")

        assert run.status == TaskStatus.QUEUED
        assert updated.status == TaskStatus.RUNNING
        assert updated.output_summary == "started"
        assert repo.list_external_agent_runs(space.space_id, session.session_id)[0].run_id == run.run_id
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_upsert_and_delete_interview_skill():
    repo, data_dir = make_repo()

    try:
        saved = repo.upsert_interview_skill(InterviewSkill(
            skill_id="custom-ai-infra",
            name="AI Infra 面试官",
            instruction="严格追问 RAG、Agent 和系统设计。",
        ))

        assert saved.skill_id == "custom-ai-infra"
        assert repo.get_interview_skill("custom-ai-infra").instruction == "严格追问 RAG、Agent 和系统设计。"
        assert repo.list_interview_skills()[0].name == "AI Infra 面试官"
        assert repo.delete_interview_skill("custom-ai-infra") is True
        assert repo.get_interview_skill("custom-ai-infra") is None
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_update_reading_progress_isolated_by_space_and_article():
    repo, data_dir = make_repo()

    try:
        ai = repo.create_space("AI", "ai_engineer", "code-dev")
        jp = repo.create_space("JP", "japanese_exam", "reading")

        saved = repo.update_reading_progress(ReadingProgress(
            space_id=jp.space_id,
            article_id="article-1",
            article_title="職場メール",
            completed_count=2,
            total_count=5,
            difficult_sentences=["資料を確認しました。"],
        ))

        assert saved.completed_count == 2
        assert repo.get_reading_progress(jp.space_id, "article-1").difficult_sentences == ["資料を確認しました。"]
        assert repo.get_reading_progress(ai.space_id, "article-1").completed_count == 0
        assert repo.get_reading_progress(jp.space_id, "article-2").article_id == "article-2"
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_update_reading_progress_clamps_invalid_completed_count():
    repo, data_dir = make_repo()

    try:
        space = repo.create_space("JP", "japanese_exam", "reading")

        saved = repo.update_reading_progress(ReadingProgress(
            space_id=space.space_id,
            article_id="article-1",
            completed_count=9,
            total_count=4,
        ))

        assert saved.completed_count == 4
        assert repo.get_reading_progress(space.space_id, "article-1").completed_count == 4
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
