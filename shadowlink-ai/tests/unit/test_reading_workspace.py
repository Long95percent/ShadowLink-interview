"""Tests for reading workspace helpers."""

from __future__ import annotations

from app.interview.reading import explain_sentence, split_reading_sentences


def test_split_japanese_sentences():
    text = "本日はありがとうございます。資料を確認しました！よろしくお願いします。"

    sentences = split_reading_sentences(text)

    assert sentences == ["本日はありがとうございます。", "資料を確認しました！", "よろしくお願いします。"]


def test_explain_sentence_returns_placeholder_with_context():
    explanation = explain_sentence("資料を確認しました！", article_title="職場メール")

    assert explanation.sentence == "資料を確認しました！"
    assert "職場メール" in explanation.context_note
    assert explanation.grammar_note
