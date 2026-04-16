from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api.v1 import health_router, agent_router, rag_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: initialise shared resources (LLM clients, RAG index, gRPC server)
    yield
    # Shutdown: release resources


app = FastAPI(
    title="ShadowLink AI Service",
    version="0.1.0",
    description="Agent orchestration, RAG pipeline, and tool execution service",
    lifespan=lifespan,
)

app.include_router(health_router.router, tags=["health"])
app.include_router(agent_router.router, prefix="/v1/agent", tags=["agent"])
app.include_router(rag_router.router, prefix="/v1/rag", tags=["rag"])


@app.get("/")
async def root():
    return {"service": "shadowlink-ai", "version": settings.version}
