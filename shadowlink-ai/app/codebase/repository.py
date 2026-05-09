"""JSON repository for codebase technical profiles."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.codebase.models import CodebaseProfile, CodebaseProfileStatus, CodebaseTechnicalDoc, utc_now


class CodebaseRepository:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.profiles_file = self.data_dir / "profiles.json"
        self.docs_file = self.data_dir / "technical_docs.json"

    def _load_list(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_list(self, path: Path, rows: list[dict]) -> None:
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    def create_profile(self, name: str, repo_path: str) -> CodebaseProfile:
        profile = CodebaseProfile(repo_id=f"repo-{uuid.uuid4().hex[:12]}", name=name, repo_path=repo_path)
        rows = self._load_list(self.profiles_file)
        rows.append(profile.model_dump(mode="json"))
        self._save_list(self.profiles_file, rows)
        return profile

    def list_profiles(self) -> list[CodebaseProfile]:
        return [CodebaseProfile(**row) for row in self._load_list(self.profiles_file)]

    def get_profile(self, repo_id: str) -> CodebaseProfile:
        for row in self._load_list(self.profiles_file):
            if row["repo_id"] == repo_id:
                return CodebaseProfile(**row)
        raise KeyError(f"Codebase profile not found: {repo_id}")

    def update_profile(self, profile: CodebaseProfile) -> CodebaseProfile:
        profile.updated_at = utc_now()
        rows = [row for row in self._load_list(self.profiles_file) if row["repo_id"] != profile.repo_id]
        rows.append(profile.model_dump(mode="json"))
        self._save_list(self.profiles_file, rows)
        return profile

    def mark_status(self, repo_id: str, status: CodebaseProfileStatus, error: str = "") -> CodebaseProfile:
        profile = self.get_profile(repo_id)
        profile.status = status
        profile.last_error = error
        if status == CodebaseProfileStatus.COMPLETED:
            profile.last_indexed_at = utc_now()
        return self.update_profile(profile)

    def save_doc(self, doc: CodebaseTechnicalDoc) -> CodebaseTechnicalDoc:
        doc.updated_at = utc_now()
        rows = [row for row in self._load_list(self.docs_file) if row["repo_id"] != doc.repo_id]
        rows.append(doc.model_dump(mode="json"))
        self._save_list(self.docs_file, rows)
        return doc

    def get_doc(self, repo_id: str) -> CodebaseTechnicalDoc | None:
        for row in self._load_list(self.docs_file):
            if row["repo_id"] == repo_id:
                return CodebaseTechnicalDoc(**row)
        return None
