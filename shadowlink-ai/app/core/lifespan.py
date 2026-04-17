"""Application lifespan management: startup and shutdown hooks.

Initializes all core subsystems in order:
  1. LLM Client
  2. Tool Registry (6 built-in tools)
  3. MCP Client (external tool servers)
  4. Memory Systems (short-term, long-term, episodic, semantic)
  5. RAG Engine (embeddings + FAISS + reranker)
  6. Agent Engine (DIRECT + REACT + PLAN_EXECUTE + SUPERVISOR strategies)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import structlog
from fastapi import FastAPI

from app.config import settings
from app.core.dependencies import set_resource

logger = structlog.get_logger("lifespan")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan context manager."""
    await logger.ainfo("startup_begin", env=settings.env, version=settings.version)

    # ── Ensure data directories ──
    for dir_path in [
        settings.data_dir,
        settings.rag.faiss_index_path,
        settings.memory.long_term_storage_path,
        settings.file_processing.upload_dir,
    ]:
        Path(dir_path).mkdir(parents=True, exist_ok=True)

    # ── 1. Initialize LLM Client ──
    from app.llm.client import LLMClient

    llm_client = LLMClient()
    llm_client.initialize()
    set_resource("llm_client", llm_client)
    await logger.ainfo("llm_client_ready", model=settings.llm.model, base_url=settings.llm.base_url)

    # ── 2. Initialize Tool Registry ──
    from app.mcp.registry import ToolRegistry
    from app.tools.code_executor import CodeExecutorTool
    from app.tools.file_ops import FileReadTool
    from app.tools.knowledge_search import KnowledgeSearchTool
    from app.tools.local_search import LocalSearchTool
    from app.tools.system_tools import CalculatorTool, CurrentTimeTool
    from app.tools.web_search import WebSearchTool

    tool_registry = ToolRegistry()

    builtin_tools = [
        CurrentTimeTool(),
        CalculatorTool(),
        WebSearchTool(),
        CodeExecutorTool(),
        FileReadTool(),
        KnowledgeSearchTool(),
        LocalSearchTool(),
    ]

    for tool in builtin_tools:
        tool_registry.register(tool.to_tool_info(), tool)

    set_resource("tool_registry", tool_registry)
    await logger.ainfo("tool_registry_ready", tools=tool_registry.tool_count)

    # ── 3. Initialize MCP Client ──
    from app.mcp.client import MCPClient

    mcp_client = MCPClient()
    set_resource("mcp_client", mcp_client)
    await logger.ainfo("mcp_client_ready")

    # ── 4. Initialize Memory Systems (Letta-inspired 3-layer + semantic) ──
    from app.agent.memory.short_term import ShortTermMemory
    from app.agent.memory.long_term import LongTermMemory
    from app.agent.memory.episodic import EpisodicMemory
    from app.agent.memory.semantic import SemanticMemory

    short_term_memory = ShortTermMemory(
        max_messages=settings.memory.short_term_max_messages,
    )
    long_term_memory = LongTermMemory(
        storage_path=settings.memory.long_term_storage_path,
    )
    episodic_memory = EpisodicMemory(
        storage_path=settings.memory.long_term_storage_path,
    )
    semantic_memory = SemanticMemory(
        storage_path=settings.memory.long_term_storage_path,
    )

    set_resource("short_term_memory", short_term_memory)
    set_resource("long_term_memory", long_term_memory)
    set_resource("episodic_memory", episodic_memory)
    set_resource("semantic_memory", semantic_memory)
    await logger.ainfo(
        "memory_ready",
        short_term_max=settings.memory.short_term_max_messages,
        long_term_entries=len(long_term_memory._memories),
        episodic_episodes=len(episodic_memory._episodes),
        semantic_nodes=semantic_memory.node_count,
    )

    # ── 5. Initialize RAG Engine ──
    from app.rag.engine import RAGEngine

    rag_engine = RAGEngine()
    set_resource("rag_engine", rag_engine)
    await logger.ainfo("rag_engine_ready")

    # ── 6. Initialize Agent Engine — all 4 strategies ──
    from app.agent.engine import AgentEngine, DirectExecutor
    from app.agent.react.executor import ReactExecutor
    from app.agent.plan_execute.stream_executor import PlanExecuteExecutor
    from app.agent.multi_agent.executor import SupervisorExecutor
    from app.models.agent import AgentStrategy

    agent_engine = AgentEngine()

    # DIRECT: simple LLM call (fast, no tools)
    direct_executor = DirectExecutor(llm_client=llm_client)
    agent_engine.register_strategy(AgentStrategy.DIRECT, direct_executor)

    # REACT: reasoning loop with tools
    react_executor = ReactExecutor(llm_client=llm_client, tools=builtin_tools)
    agent_engine.register_strategy(AgentStrategy.REACT, react_executor)

    # PLAN_EXECUTE: plan → step-by-step execution → replan on failure
    plan_executor = PlanExecuteExecutor(llm_client=llm_client, tools=builtin_tools)
    agent_engine.register_strategy(AgentStrategy.PLAN_EXECUTE, plan_executor)

    # SUPERVISOR: multi-agent expert delegation
    supervisor_executor = SupervisorExecutor(llm_client=llm_client, tools=builtin_tools)
    agent_engine.register_strategy(AgentStrategy.SUPERVISOR, supervisor_executor)

    set_resource("agent_engine", agent_engine)
    await logger.ainfo(
        "agent_engine_ready",
        strategies=list(agent_engine._strategy_executors.keys()),
    )

    await logger.ainfo("startup_complete", message="All resources initialized")

    yield  # ── Application runs here ──

    # ── Shutdown ──
    await logger.ainfo("shutdown_begin")

    # Persist RAG indices
    if rag_engine and rag_engine._index_manager:
        rag_engine._index_manager.save_all()
        await logger.ainfo("rag_indices_saved")

    # Persist long-term memory
    long_term_memory._save()
    episodic_memory._save()

    # Disconnect MCP servers
    await mcp_client.disconnect_all()

    await logger.ainfo("shutdown_complete")
