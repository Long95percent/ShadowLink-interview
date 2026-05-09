"""Codebase technical profile API endpoints."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.codebase.models import CodebaseProfile, CodebaseProfileStatus
from app.codebase.repository import CodebaseRepository
from app.codebase.schemas import CodebaseProfileDetail, CreateCodebaseProfileRequest, GenerateCodebaseDocRequest
from app.codebase.service import CodebaseProfileService
from app.config import settings
from app.models.common import Result

router = APIRouter()


def get_repo() -> CodebaseRepository:
    return CodebaseRepository(Path(settings.data_dir) / "codebase")


def get_service(repo: CodebaseRepository) -> CodebaseProfileService:
    return CodebaseProfileService(repo)


def get_profile_detail(repo: CodebaseRepository, repo_id: str) -> CodebaseProfileDetail:
    try:
        profile = repo.get_profile(repo_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Codebase profile not found") from exc
    return CodebaseProfileDetail(profile=profile, doc=repo.get_doc(repo_id))


async def generate_doc_task(repo_id: str, prompt: str) -> None:
    repo = get_repo()
    await get_service(repo).generate_doc(repo_id, prompt)


@router.get("/profiles")
async def list_profiles() -> Result[list[CodebaseProfile]]:
    return Result.ok(data=get_repo().list_profiles())


@router.post("/profiles")
async def create_profile(request: CreateCodebaseProfileRequest) -> Result[CodebaseProfileDetail]:
    repo = get_repo()
    profile = repo.create_profile(request.name.strip(), request.repo_path.strip())
    return Result.ok(data=CodebaseProfileDetail(profile=profile, doc=None))


@router.get("/profiles/{repo_id}")
async def get_profile(repo_id: str) -> Result[CodebaseProfileDetail]:
    repo = get_repo()
    return Result.ok(data=get_profile_detail(repo, repo_id))


@router.post("/profiles/{repo_id}/generate")
async def generate_profile_doc(
    repo_id: str,
    request: GenerateCodebaseDocRequest,
    background_tasks: BackgroundTasks,
) -> Result[CodebaseProfileDetail]:
    repo = get_repo()
    get_profile_detail(repo, repo_id)
    repo.mark_status(repo_id, status=CodebaseProfileStatus.RUNNING)
    background_tasks.add_task(generate_doc_task, repo_id, request.prompt)
    return Result.ok(data=get_profile_detail(repo, repo_id), message="Codebase technical doc generation started")
