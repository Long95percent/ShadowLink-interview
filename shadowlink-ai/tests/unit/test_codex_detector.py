"""Unit tests for Codex CLI detection."""

from __future__ import annotations

from app.integrations.codex import detector


def test_detect_codex_not_installed(monkeypatch):
    monkeypatch.setattr(detector.shutil, "which", lambda _: None)

    status = detector.detect_codex()

    assert status.installed is False
    assert "npm install -g @openai/codex" in status.message

