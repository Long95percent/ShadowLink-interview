"""Local persistence for interview learning data."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.interview.models import ExternalAgentRun, InterviewReview, InterviewSession, InterviewSkill, JobSpace, ReadingProgress, ReviewStatus, SpaceProfile, TaskStatus, utc_now


class InterviewRepository:
    """Small JSON-backed repository for the first local-only milestone."""

    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.spaces_file = self.data_dir / "spaces.json"
        self.profiles_file = self.data_dir / "profiles.json"
        self.sessions_file = self.data_dir / "sessions.json"
        self.reviews_file = self.data_dir / "reviews.json"
        self.external_runs_file = self.data_dir / "external_agent_runs.json"
        self.reading_progress_file = self.data_dir / "reading_progress.json"
        self.skills_file = self.data_dir / "interview_skills.json"

    def _load_list(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_list(self, path: Path, rows: list[dict]) -> None:
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    def create_space(self, name: str, type: str, theme: str) -> JobSpace:
        space = JobSpace(space_id=f"space-{uuid.uuid4().hex[:12]}", name=name, type=type, theme=theme)
        spaces = self._load_list(self.spaces_file)
        spaces.append(space.model_dump(mode="json"))
        self._save_list(self.spaces_file, spaces)

        profiles = self._load_list(self.profiles_file)
        profiles.append(SpaceProfile(space_id=space.space_id).model_dump(mode="json"))
        self._save_list(self.profiles_file, profiles)
        return space

    def list_spaces(self) -> list[JobSpace]:
        return [JobSpace(**row) for row in self._load_list(self.spaces_file)]

    def get_profile(self, space_id: str) -> SpaceProfile:
        for row in self._load_list(self.profiles_file):
            if row["space_id"] == space_id:
                return SpaceProfile(**row)
        return SpaceProfile(space_id=space_id)

    def update_profile(self, profile: SpaceProfile) -> SpaceProfile:
        profile.updated_at = utc_now()
        profiles = [row for row in self._load_list(self.profiles_file) if row["space_id"] != profile.space_id]
        profiles.append(profile.model_dump(mode="json"))
        self._save_list(self.profiles_file, profiles)
        return profile

    def list_interview_skills(self) -> list[InterviewSkill]:
        return [InterviewSkill(**row) for row in self._load_list(self.skills_file)]

    def get_interview_skill(self, skill_id: str) -> InterviewSkill | None:
        for row in self._load_list(self.skills_file):
            if row["skill_id"] == skill_id:
                return InterviewSkill(**row)
        return None

    def upsert_interview_skill(self, skill: InterviewSkill) -> InterviewSkill:
        existing = self.get_interview_skill(skill.skill_id)
        if existing:
            skill.created_at = existing.created_at
        skill.updated_at = utc_now()
        rows = [row for row in self._load_list(self.skills_file) if row["skill_id"] != skill.skill_id]
        rows.append(skill.model_dump(mode="json"))
        self._save_list(self.skills_file, rows)
        return skill

    def delete_interview_skill(self, skill_id: str) -> bool:
        rows = self._load_list(self.skills_file)
        next_rows = [row for row in rows if row["skill_id"] != skill_id]
        self._save_list(self.skills_file, next_rows)
        return len(next_rows) != len(rows)

    def create_session(self, space_id: str, title: str) -> InterviewSession:
        session = InterviewSession(session_id=f"session-{uuid.uuid4().hex[:12]}", space_id=space_id, title=title)
        sessions = self._load_list(self.sessions_file)
        sessions.append(session.model_dump(mode="json"))
        self._save_list(self.sessions_file, sessions)
        return session

    def list_sessions(self, space_id: str) -> list[InterviewSession]:
        return [InterviewSession(**row) for row in self._load_list(self.sessions_file) if row["space_id"] == space_id]

    def create_review(
        self,
        space_id: str,
        session_id: str,
        original_answer: str,
        suggested_answer: str,
        critique: str,
        token_usage: dict | None = None,
    ) -> InterviewReview:
        review = InterviewReview(
            review_id=f"review-{uuid.uuid4().hex[:12]}",
            space_id=space_id,
            session_id=session_id,
            original_answer=original_answer,
            suggested_answer=suggested_answer,
            critique=critique,
            token_usage=token_usage or {},
        )
        reviews = self._load_list(self.reviews_file)
        reviews.append(review.model_dump(mode="json"))
        self._save_list(self.reviews_file, reviews)
        return review

    def list_reviews(self, space_id: str, session_id: str) -> list[InterviewReview]:
        return [
            InterviewReview(**row)
            for row in self._load_list(self.reviews_file)
            if row["space_id"] == space_id and row["session_id"] == session_id
        ]

    def update_review_status(self, review_id: str, status: ReviewStatus) -> InterviewReview:
        reviews = self._load_list(self.reviews_file)
        for row in reviews:
            if row["review_id"] == review_id:
                row["status"] = status.value
                self._save_list(self.reviews_file, reviews)
                return InterviewReview(**row)
        raise KeyError(f"Review not found: {review_id}")

    def create_external_agent_run(self, space_id: str, session_id: str, repo_path: str, prompt: str) -> ExternalAgentRun:
        run = ExternalAgentRun(
            run_id=f"run-{uuid.uuid4().hex[:12]}",
            space_id=space_id,
            session_id=session_id,
            repo_path=repo_path,
            prompt=prompt,
        )
        runs = self._load_list(self.external_runs_file)
        runs.append(run.model_dump(mode="json"))
        self._save_list(self.external_runs_file, runs)
        return run

    def list_external_agent_runs(self, space_id: str, session_id: str) -> list[ExternalAgentRun]:
        return [
            ExternalAgentRun(**row)
            for row in self._load_list(self.external_runs_file)
            if row["space_id"] == space_id and row["session_id"] == session_id
        ]

    def get_external_agent_run(self, run_id: str) -> ExternalAgentRun:
        for row in self._load_list(self.external_runs_file):
            if row["run_id"] == run_id:
                return ExternalAgentRun(**row)
        raise KeyError(f"External agent run not found: {run_id}")

    def update_external_agent_run(
        self,
        run_id: str,
        status: TaskStatus | None = None,
        output_summary: str | None = None,
        error_message: str | None = None,
    ) -> ExternalAgentRun:
        runs = self._load_list(self.external_runs_file)
        for row in runs:
            if row["run_id"] == run_id:
                if status is not None:
                    row["status"] = status.value
                if output_summary is not None:
                    row["output_summary"] = output_summary
                if error_message is not None:
                    row["error_message"] = error_message
                row["updated_at"] = utc_now().isoformat()
                self._save_list(self.external_runs_file, runs)
                return ExternalAgentRun(**row)
        raise KeyError(f"External agent run not found: {run_id}")

    def get_reading_progress(self, space_id: str, article_id: str) -> ReadingProgress:
        for row in self._load_list(self.reading_progress_file):
            if row["space_id"] == space_id and row["article_id"] == article_id:
                return ReadingProgress(**row)
        return ReadingProgress(space_id=space_id, article_id=article_id)

    def update_reading_progress(self, progress: ReadingProgress) -> ReadingProgress:
        if progress.completed_count > progress.total_count:
            progress.completed_count = progress.total_count
        progress.updated_at = utc_now()
        rows = [
            row
            for row in self._load_list(self.reading_progress_file)
            if not (row["space_id"] == progress.space_id and row["article_id"] == progress.article_id)
        ]
        rows.append(progress.model_dump(mode="json"))
        self._save_list(self.reading_progress_file, rows)
        return progress
