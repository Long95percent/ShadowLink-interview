"""Interview learning API endpoints."""

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from app.config import settings
from app.codebase.repository import CodebaseRepository
from app.core.dependencies import get_resource
from app.interview.external_runner import ExternalAgentRunExecutor
from app.interview.models import ExternalAgentRun, InterviewReview, InterviewSession, InterviewSkill, ProjectDocument, ReadingProgress, SpaceProfile
from app.interview.reading import SentenceExplanation, explain_sentence, split_reading_sentences
from app.interview.repository import InterviewRepository
from app.file_processing.pipeline import FileProcessingPipeline
from app.interview.review_service import InterviewQuestionService, InterviewReviewDraftService
from app.interview.schemas import CreateExternalAgentRunRequest, CreateReviewRequest, CreateSessionRequest, CreateSpaceRequest, ExplainSentenceRequest, GenerateInterviewQuestionsRequest, GenerateInterviewQuestionsResponse, ParsedResumeResponse, SplitReadingRequest, SplitReadingResponse, UpdateProfileRequest, UpdateReadingProgressRequest, UpdateReviewStatusRequest, UpdateSpaceRequest, UpsertInterviewSkillRequest, UploadInterviewSkillResponse, UploadProjectDocumentResponse, SpaceDetail
from app.llm.client import LLMClient
from app.llm.providers.openai import OpenAIProvider
from app.models.common import Result
from app.models.mcp import FileProcessingRequest

router = APIRouter()


def get_repo() -> InterviewRepository:
    return InterviewRepository(Path(settings.data_dir) / "interview")


def get_codebase_repo() -> CodebaseRepository:
    return CodebaseRepository(Path(settings.data_dir) / "codebase")


def get_codebase_context(repo_id: str | None) -> str:
    if not repo_id:
        return ""
    doc = get_codebase_repo().get_doc(repo_id)
    return doc.raw_markdown if doc else ""


def build_reference_context(repo: InterviewRepository, space_id: str, codebase_repo_id: str | None) -> str:
    chunks = []
    project_docs_context = repo.build_project_documents_context(space_id)
    if project_docs_context.strip():
        chunks.append(f"# Uploaded project documents\n{project_docs_context}")
    codebase_context = get_codebase_context(codebase_repo_id)
    if codebase_context.strip():
        chunks.append(f"# Codebase technical profile\n{codebase_context}")
    return "\n\n".join(chunks)


def ensure_space_exists(repo: InterviewRepository, space_id: str) -> None:
    if not any(space.space_id == space_id for space in repo.list_spaces()):
        raise HTTPException(status_code=404, detail="Space not found")


def ensure_session_in_space(repo: InterviewRepository, space_id: str, session_id: str) -> None:
    if not any(session.session_id == session_id for session in repo.list_sessions(space_id)):
        raise HTTPException(status_code=404, detail="Session not found in space")


def normalize_skill_id(name: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip()).strip("-").lower()
    return f"custom-{normalized or 'skill'}"


def parse_skill_payload(text: str, fallback_name: str) -> InterviewSkill:
    stripped = text.strip()
    try:
        payload = json.loads(stripped)
        name = str(payload.get("name") or fallback_name).strip()
        instruction = str(payload.get("instruction") or payload.get("prompt") or "").strip()
        description = str(payload.get("description") or "").strip()
        skill_id = str(payload.get("id") or payload.get("skill_id") or normalize_skill_id(name)).strip()
    except json.JSONDecodeError:
        name = Path(fallback_name).stem or "自定义面试官"
        instruction = stripped
        description = "从文本文件上传的自定义面试官 Skill。"
        skill_id = normalize_skill_id(name)
    if not instruction:
        raise HTTPException(status_code=400, detail="Skill instruction is required")
    return InterviewSkill(skill_id=skill_id, name=name, description=description, instruction=instruction, source="custom")


async def parse_uploaded_resume(file: UploadFile, upload_scope: str) -> ParsedResumeResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT, and Markdown resumes are supported")

    upload_dir = Path(settings.data_dir) / "interview" / "uploads" / upload_scope
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or f"resume{suffix}").name
    target = upload_dir / safe_name
    target.write_bytes(await file.read())

    parsed = await FileProcessingPipeline().process(FileProcessingRequest(file_path=str(target)))
    if parsed.content.startswith("Error:"):
        raise HTTPException(status_code=400, detail=parsed.content)
    return ParsedResumeResponse(filename=safe_name, content=parsed.content.strip())


def build_request_llm_client(llm_config: dict | None):
    if not llm_config:
        return get_resource("llm_client")
    provider = OpenAIProvider(
        base_url=llm_config.get("baseUrl") or llm_config.get("base_url"),
        api_key=llm_config.get("apiKey") or llm_config.get("api_key"),
        default_model=llm_config.get("model"),
    )
    client = LLMClient()
    client._default_provider = provider
    client._providers["openai"] = provider
    return client


@router.get("/spaces")
async def list_spaces() -> Result[list[SpaceDetail]]:
    repo = get_repo()
    details = [SpaceDetail(space=space, profile=repo.get_profile(space.space_id)) for space in repo.list_spaces()]
    return Result.ok(data=details)


@router.post("/spaces")
async def create_space(request: CreateSpaceRequest) -> Result[SpaceDetail]:
    repo = get_repo()
    space = repo.create_space(request.name, request.type.value, request.theme)
    return Result.ok(data=SpaceDetail(space=space, profile=repo.get_profile(space.space_id)))


@router.put("/spaces/{space_id}")
async def update_space(space_id: str, request: UpdateSpaceRequest) -> Result[SpaceDetail]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    space = repo.update_space(space_id, request.name, request.type.value, request.theme)
    return Result.ok(data=SpaceDetail(space=space, profile=repo.get_profile(space_id)))


@router.delete("/spaces/{space_id}")
async def delete_space(space_id: str) -> Result[dict[str, bool]]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data={"deleted": repo.delete_space(space_id)})


@router.put("/spaces/{space_id}/profile")
async def update_profile(space_id: str, request: UpdateProfileRequest) -> Result[SpaceProfile]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    profile = SpaceProfile(space_id=space_id, **request.model_dump())
    return Result.ok(data=repo.update_profile(profile))


@router.get("/skills")
async def list_interview_skills() -> Result[list[InterviewSkill]]:
    return Result.ok(data=get_repo().list_interview_skills())


@router.post("/skills")
async def create_interview_skill(request: UpsertInterviewSkillRequest) -> Result[InterviewSkill]:
    skill = InterviewSkill(
        skill_id=normalize_skill_id(request.name),
        name=request.name,
        description=request.description,
        instruction=request.instruction,
        source="custom",
    )
    return Result.ok(data=get_repo().upsert_interview_skill(skill))


@router.put("/skills/{skill_id}")
async def update_interview_skill(skill_id: str, request: UpsertInterviewSkillRequest) -> Result[InterviewSkill]:
    skill = InterviewSkill(
        skill_id=skill_id,
        name=request.name,
        description=request.description,
        instruction=request.instruction,
        source="custom",
    )
    return Result.ok(data=get_repo().upsert_interview_skill(skill))


@router.delete("/skills/{skill_id}")
async def delete_interview_skill(skill_id: str) -> Result[dict[str, bool]]:
    return Result.ok(data={"deleted": get_repo().delete_interview_skill(skill_id)})


@router.post("/skills/upload")
async def upload_interview_skill(file: UploadFile = File(...)) -> Result[UploadInterviewSkillResponse]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".json", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Only JSON, TXT, and Markdown skill files are supported")
    text = (await file.read()).decode("utf-8")
    skill = parse_skill_payload(text, file.filename or "custom-skill")
    return Result.ok(data=UploadInterviewSkillResponse(skill=get_repo().upsert_interview_skill(skill)))


@router.post("/spaces/{space_id}/profile/resume/parse")
async def parse_resume_file(space_id: str, file: UploadFile = File(...)) -> Result[ParsedResumeResponse]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data=await parse_uploaded_resume(file, space_id))


@router.post("/profile/resume/parse")
async def parse_resume_draft_file(file: UploadFile = File(...)) -> Result[ParsedResumeResponse]:
    return Result.ok(data=await parse_uploaded_resume(file, "_draft"))


@router.get("/spaces/{space_id}/project-documents")
async def list_project_documents(space_id: str) -> Result[list[ProjectDocument]]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data=repo.list_project_documents(space_id))


@router.post("/spaces/{space_id}/project-documents/upload")
async def upload_project_document(space_id: str, file: UploadFile = File(...)) -> Result[UploadProjectDocumentResponse]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT, and Markdown project documents are supported")

    upload_dir = Path(settings.data_dir) / "interview" / "project_documents" / space_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or f"project-document{suffix}").name
    target = upload_dir / safe_name
    target.write_bytes(await file.read())

    parsed = await FileProcessingPipeline().process(FileProcessingRequest(file_path=str(target)))
    if parsed.content.startswith("Error:"):
        raise HTTPException(status_code=400, detail=parsed.content)
    document = repo.add_project_document(space_id, safe_name, parsed.content.strip())
    return Result.ok(data=UploadProjectDocumentResponse(document=document))


@router.delete("/project-documents/{document_id}")
async def delete_project_document(document_id: str) -> Result[dict[str, bool]]:
    return Result.ok(data={"deleted": get_repo().delete_project_document(document_id)})


@router.post("/spaces/{space_id}/interview/questions")
async def generate_interview_questions(
    space_id: str,
    request: GenerateInterviewQuestionsRequest,
) -> Result[GenerateInterviewQuestionsResponse]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    llm_client = build_request_llm_client(request.llm_config)
    questions, provider, message = await InterviewQuestionService().generate_questions(
        repo.get_profile(space_id),
        count=request.count,
        difficulty=request.difficulty,
        interviewer_skill=request.interviewer_skill,
        custom_skill=repo.get_interview_skill(request.interviewer_skill),
        llm_client=llm_client,
    )
    return Result.ok(data=GenerateInterviewQuestionsResponse(questions=questions, provider=provider, message=message))


@router.get("/spaces/{space_id}/sessions")
async def list_sessions(space_id: str) -> Result[list[InterviewSession]]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data=repo.list_sessions(space_id))


@router.post("/spaces/{space_id}/sessions")
async def create_session(space_id: str, request: CreateSessionRequest) -> Result[InterviewSession]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data=repo.create_session(space_id, request.title))


@router.get("/spaces/{space_id}/sessions/{session_id}/reviews")
async def list_reviews(space_id: str, session_id: str) -> Result[list[InterviewReview]]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    ensure_session_in_space(repo, space_id, session_id)
    return Result.ok(data=repo.list_reviews(space_id, session_id))


@router.post("/spaces/{space_id}/sessions/{session_id}/reviews")
async def create_review(space_id: str, session_id: str, request: CreateReviewRequest) -> Result[InterviewReview]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    ensure_session_in_space(repo, space_id, session_id)
    draft = await InterviewReviewDraftService().generate_llm_draft(
        repo.get_profile(space_id),
        request.original_answer,
        llm_client=build_request_llm_client(request.llm_config),
        interviewer_skill=request.interviewer_skill,
        custom_skill=repo.get_interview_skill(request.interviewer_skill),
        codebase_context=build_reference_context(repo, space_id, request.codebase_repo_id),
        revision_instruction=request.revision_instruction,
    )
    suggested_answer = request.suggested_answer or draft.suggested_answer
    critique = request.critique or draft.critique
    return Result.ok(data=repo.create_review(space_id, session_id, draft.original_answer, suggested_answer, critique, draft.token_usage))


@router.put("/reviews/{review_id}/status")
async def update_review_status(review_id: str, request: UpdateReviewStatusRequest) -> Result[InterviewReview]:
    repo = get_repo()
    try:
        return Result.ok(data=repo.update_review_status(review_id, request.status))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Review not found") from exc


@router.get("/spaces/{space_id}/sessions/{session_id}/external-runs")
async def list_external_agent_runs(space_id: str, session_id: str) -> Result[list[ExternalAgentRun]]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    ensure_session_in_space(repo, space_id, session_id)
    return Result.ok(data=repo.list_external_agent_runs(space_id, session_id))


@router.post("/spaces/{space_id}/sessions/{session_id}/external-runs")
async def create_external_agent_run(
    space_id: str,
    session_id: str,
    request: CreateExternalAgentRunRequest,
    background_tasks: BackgroundTasks,
) -> Result[ExternalAgentRun]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    ensure_session_in_space(repo, space_id, session_id)
    run = repo.create_external_agent_run(space_id, session_id, request.repo_path, request.prompt)
    background_tasks.add_task(ExternalAgentRunExecutor(repo).execute, run.run_id)
    return Result.ok(data=run)


@router.post("/reading/split")
async def split_reading(request: SplitReadingRequest) -> Result[SplitReadingResponse]:
    return Result.ok(data=SplitReadingResponse(sentences=split_reading_sentences(request.text)))


@router.post("/reading/explain")
async def explain_reading_sentence(request: ExplainSentenceRequest) -> Result[SentenceExplanation]:
    return Result.ok(data=explain_sentence(request.sentence, request.article_title))


@router.get("/spaces/{space_id}/reading/progress/{article_id}")
async def get_reading_progress(space_id: str, article_id: str) -> Result[ReadingProgress]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    return Result.ok(data=repo.get_reading_progress(space_id, article_id))


@router.put("/spaces/{space_id}/reading/progress/{article_id}")
async def update_reading_progress(
    space_id: str,
    article_id: str,
    request: UpdateReadingProgressRequest,
) -> Result[ReadingProgress]:
    repo = get_repo()
    ensure_space_exists(repo, space_id)
    progress = ReadingProgress(space_id=space_id, article_id=article_id, **request.model_dump())
    return Result.ok(data=repo.update_reading_progress(progress))
