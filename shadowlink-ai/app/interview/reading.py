"""Reading workspace helpers."""

from __future__ import annotations

import re

from pydantic import BaseModel


class SentenceExplanation(BaseModel):
    sentence: str
    grammar_note: str
    context_note: str
    vocabulary_note: str = ""


def split_reading_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text.strip())
    if not normalized:
        return []
    parts = re.split(r"(?<=[。！？!?\.])\s*", normalized)
    return [part.strip() for part in parts if part.strip()]


def explain_sentence(sentence: str, article_title: str = "") -> SentenceExplanation:
    title = article_title or "当前文章"
    return SentenceExplanation(
        sentence=sentence,
        grammar_note="语法拆解将在后续接入 LLM Reviewer；当前先标记句子主干、助词和敬语表达。",
        context_note=f"该句来自「{title}」，解释时应结合文章语境，而不是只做词典翻译。",
        vocabulary_note="后续可在这里补充关键词、职场表达和例句。",
    )

