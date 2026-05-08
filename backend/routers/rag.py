"""
RAG router — energy advisory chatbot powered by FAISS + Anthropic Claude.
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("eco_forecast.rag")

router = APIRouter()

# ---------------------------------------------------------------------------
# Feedback storage
# ---------------------------------------------------------------------------

FEEDBACK_FILE = Path("rag_feedback.json")


def _load_feedback() -> list[dict]:
    if FEEDBACK_FILE.exists():
        try:
            with FEEDBACK_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save_feedback(entries: list[dict]) -> None:
    with FEEDBACK_FILE.open("w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RAGQuery(BaseModel):
    question: str = Field(..., min_length=3, description="User question about energy forecasting.")
    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Previous conversation turns: [{role: str, content: str}, ...]",
    )
    context_filter: str | None = Field(
        default=None,
        description="Optional topic filter, e.g. 'solar', 'load_shedding', 'efficiency'.",
    )


class RAGResponse(BaseModel):
    answer: str
    sources: list[dict[str, Any]]
    question: str
    model_used: str


class FeedbackRequest(BaseModel):
    question: str = Field(..., description="Original question that was asked.")
    answer: str = Field(..., description="Answer that was given by the system.")
    rating: int = Field(..., ge=1, le=5, description="User rating from 1 (poor) to 5 (excellent).")
    comment: str | None = Field(default=None, description="Optional free-text comment.")


class IndexRebuildResponse(BaseModel):
    status: str
    documents_indexed: int
    rebuilt_at: str


class RAGStatusResponse(BaseModel):
    index_built: bool
    document_count: int
    last_updated: str


# ---------------------------------------------------------------------------
# Fallback answer when RAG is not available
# ---------------------------------------------------------------------------

_NO_RAG_ANSWER = (
    "The RAG advisory service is currently unavailable because the ANTHROPIC_API_KEY "
    "environment variable has not been set. Please add it to your .env file "
    "(see .env.example) and restart the server. "
    "Once configured, this assistant can answer detailed questions about energy "
    "consumption, load forecasting methodology, climate impacts on energy demand in "
    "Pakistani cities, and energy efficiency recommendations."
)

_NO_RAG_SOURCES: list[dict] = []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/query", response_model=RAGResponse, summary="Ask the energy advisory chatbot")
async def rag_query(request: Request, body: RAGQuery):
    """
    Submit a natural-language question to the RAG-powered energy advisory chatbot.
    The system retrieves relevant documents from the FAISS knowledge base and uses
    Anthropic Claude to generate a grounded, cited answer.
    """
    rag = getattr(request.app.state, "rag", None)

    if rag is None:
        logger.warning("RAG engine not available — returning fallback answer.")
        return RAGResponse(
            answer=_NO_RAG_ANSWER,
            sources=_NO_RAG_SOURCES,
            question=body.question,
            model_used="unavailable",
        )

    try:
        import asyncio
        # RAGEngine.answer() is synchronous — run it in a thread pool to avoid
        # blocking the event loop during the Anthropic API call.
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: rag.answer(
                question=body.question,
                history=body.conversation_history,
                context_filter=body.context_filter,
            ),
        )
        return RAGResponse(
            answer=result["answer"],
            sources=result.get("sources", []),
            question=body.question,
            model_used=result.get("model_used", "claude"),
        )
    except Exception as exc:
        logger.error("RAG query failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"RAG query failed: {exc}. Ensure ANTHROPIC_API_KEY is set correctly.",
        ) from exc


@router.post("/index", response_model=IndexRebuildResponse, summary="Rebuild FAISS knowledge base")
async def rebuild_index(request: Request):
    """
    Rebuild the FAISS vector index from the knowledge base documents.
    This operation may take several seconds. Existing queries are unaffected
    until the new index is fully built and swapped in.
    """
    rag = getattr(request.app.state, "rag", None)

    if rag is None:
        raise HTTPException(
            status_code=503,
            detail="RAG engine is not initialised. Check server logs for startup errors.",
        )

    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def _rebuild():
            rag.build_knowledge_base()
            return rag.build_index()

        doc_count: int = await loop.run_in_executor(None, _rebuild)
        rebuilt_at = datetime.now(timezone.utc).isoformat()
        logger.info("FAISS index rebuilt with %d documents.", doc_count)
        return IndexRebuildResponse(
            status="success",
            documents_indexed=doc_count,
            rebuilt_at=rebuilt_at,
        )
    except Exception as exc:
        logger.error("Index rebuild failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Index rebuild failed: {exc}") from exc


@router.get("/status", response_model=RAGStatusResponse, summary="RAG engine status")
async def rag_status(request: Request):
    """
    Return the current status of the RAG engine: whether the index is built,
    how many documents are indexed, and when it was last updated.
    """
    rag = getattr(request.app.state, "rag", None)

    index_path = Path("rag_index") / "faiss.index"

    if rag is None:
        return RAGStatusResponse(
            index_built=False,
            document_count=0,
            last_updated="never",
        )

    index_built = index_path.exists()
    document_count = getattr(rag, "document_count", 0)

    if index_built:
        stat = index_path.stat()
        last_updated = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    else:
        last_updated = "never"

    return RAGStatusResponse(
        index_built=index_built,
        document_count=document_count,
        last_updated=last_updated,
    )


@router.post("/feedback", summary="Submit answer quality feedback")
async def submit_feedback(body: FeedbackRequest):
    """
    Store user feedback on a RAG answer. Feedback is persisted to a local JSON
    file and can be used to evaluate and improve the RAG pipeline.
    """
    entries = _load_feedback()
    entry = {
        "question": body.question,
        "answer": body.answer,
        "rating": body.rating,
        "comment": body.comment,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    entries.append(entry)

    try:
        _save_feedback(entries)
        logger.info("Feedback stored (rating=%d).", body.rating)
    except OSError as exc:
        logger.error("Could not write feedback file: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save feedback.") from exc

    return {
        "status": "accepted",
        "total_feedback_entries": len(entries),
        "submitted_at": entry["submitted_at"],
    }
