from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def agent_chat():
    """Placeholder — will route to ReAct / Plan-and-Execute / MultiAgent engine."""
    return {"message": "agent chat endpoint (placeholder)"}
