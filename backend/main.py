"""
Eco Forecast API — Smart Energy Consumption Forecasting for Pakistani Cities
Main FastAPI application entry point.
"""

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eco_forecast")

# ---------------------------------------------------------------------------
# Lifespan — load heavy ML / RAG resources once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- EnsemblePredictor ----
    # EnsemblePredictor loads all Keras models in __init__; no separate .load() needed.
    try:
        from services.ensemble_predictor import EnsemblePredictor
        app.state.predictor = EnsemblePredictor(models_dir="models/")
        logger.info("EnsemblePredictor loaded successfully.")
    except Exception as exc:
        logger.warning("EnsemblePredictor could not be loaded: %s", exc)
        app.state.predictor = None

    # ---- XAI Engines ----
    app.state.xai_engines = {}
    try:
        from services.xai_engine import XAIEngine
        for _model_name in ("cnn", "lstm", "gru"):
            try:
                engine = XAIEngine(model_name=_model_name)
                engine.load()
                app.state.xai_engines[_model_name] = engine
                logger.info("XAIEngine loaded for model '%s'.", _model_name)
            except Exception as exc:
                logger.warning("XAIEngine failed for model '%s': %s", _model_name, exc)
                app.state.xai_engines[_model_name] = None
    except Exception as exc:
        logger.warning("XAIEngine module could not be imported: %s", exc)

    # ---- RAG Engine ----
    try:
        from services.rag_engine import RAGEngine
        rag = RAGEngine()
        index_path = os.path.join("rag_index", "faiss.index")
        if not os.path.exists(index_path):
            logger.info("FAISS index not found — building knowledge base …")
            rag.build_knowledge_base()
            rag.build_index()
            logger.info("FAISS index built and saved.")
        else:
            rag.load_index()
            logger.info("RAGEngine loaded existing FAISS index.")
        app.state.rag = rag
    except Exception as exc:
        logger.warning("RAGEngine could not be initialised: %s", exc)
        app.state.rag = None

    yield  # application runs here

    logger.info("Eco Forecast API shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Eco Forecast API",
    version="1.0.0",
    description=(
        "Smart Energy Consumption Forecasting for Pakistani Cities. "
        "Powered by CNN, LSTM, GRU ensemble models with SHAP/LIME explainability "
        "and a RAG-based energy advisory chatbot."
    ),
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from routers.forecast import router as forecast_router  # noqa: E402
from routers.xai import router as xai_router            # noqa: E402
from routers.rag import router as rag_router            # noqa: E402

app.include_router(forecast_router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(xai_router,      prefix="/api/xai",      tags=["Explainability"])
app.include_router(rag_router,      prefix="/api/rag",      tags=["RAG Chatbot"])

# ---------------------------------------------------------------------------
# Root / Health / Demo
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
async def health_check():
    """Return API liveness and component readiness."""
    return {
        "status": "ok",
        "models_loaded": app.state.predictor is not None,
        "rag_ready": app.state.rag is not None,
        "version": "1.0.0",
    }


@app.get("/api/demo", tags=["Demo"])
async def demo_forecast():
    """
    Return a hardcoded, realistic 24-hour summer energy forecast for Lahore
    (no model required — useful for front-end development and demos).
    """
    # Realistic hourly kWh values for a hot Lahore summer day:
    # Low demand at night, morning ramp-up, peak in afternoon, evening plateau.
    predictions = [
        8.2,  9.1,  8.7,  8.4,  8.9,  10.3,
        13.5, 17.2, 21.8, 26.4, 30.1, 33.7,
        36.5, 38.9, 40.2, 41.8, 43.1, 44.6,
        42.3, 38.7, 34.2, 28.5, 21.3, 14.7,
    ]
    total = sum(predictions)
    return {
        "predictions": predictions,
        "city": "Lahore",
        "model": "ensemble",
        "predicted_kwh": round(total / len(predictions), 3),
        "confidence_interval": {
            "lower": round((total / len(predictions)) * 0.85, 3),
            "upper": round((total / len(predictions)) * 1.15, 3),
        },
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to Eco Forecast API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }
