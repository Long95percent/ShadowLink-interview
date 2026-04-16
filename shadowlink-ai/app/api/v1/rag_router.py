from fastapi import APIRouter

router = APIRouter()


@router.post("/query")
async def rag_query():
    """Placeholder — will execute the 9-step RAG pipeline."""
    return {"message": "RAG query endpoint (placeholder)"}


@router.post("/ingest")
async def rag_ingest():
    """Placeholder — will handle document ingestion and indexing."""
    return {"message": "RAG ingest endpoint (placeholder)"}
