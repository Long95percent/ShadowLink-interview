"""Repository tests for codebase technical profiles."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.codebase.models import CodebaseProfileStatus, CodebaseTechnicalDoc
from app.codebase.repository import CodebaseRepository


def test_create_profile_and_mark_status():
    data_dir = Path(".test-data") / f"codebase-repo-{uuid.uuid4().hex}"
    repo = CodebaseRepository(data_dir)

    try:
        profile = repo.create_profile("ShadowLink", "D:/github_desktop/ShadowLink")
        updated = repo.mark_status(profile.repo_id, CodebaseProfileStatus.COMPLETED)

        assert updated.name == "ShadowLink"
        assert updated.status == CodebaseProfileStatus.COMPLETED
        assert updated.last_indexed_at is not None
        assert repo.get_profile(profile.repo_id).status == CodebaseProfileStatus.COMPLETED
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)


def test_save_and_get_doc():
    data_dir = Path(".test-data") / f"codebase-repo-{uuid.uuid4().hex}"
    repo = CodebaseRepository(data_dir)

    try:
        profile = repo.create_profile("ShadowLink", "D:/github_desktop/ShadowLink")
        saved = repo.save_doc(CodebaseTechnicalDoc(repo_id=profile.repo_id, raw_markdown="# 技术档案"))

        loaded = repo.get_doc(profile.repo_id)
        assert saved.raw_markdown == "# 技术档案"
        assert loaded is not None
        assert loaded.raw_markdown == "# 技术档案"
    finally:
        shutil.rmtree(data_dir, ignore_errors=True)
