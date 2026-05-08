"""
Tips router — AI-driven energy-saving recommendations.
Registered in main.py with prefix="/api/tips".
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("eco_forecast.tips")

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock SHAP feature importance data (used when no real XAI data is available)
# ---------------------------------------------------------------------------

_MOCK_FEATURE_IMPORTANCES = [
    {"feature": "Temperature",       "importance": 0.312},
    {"feature": "Solar_Radiation",   "importance": 0.274},
    {"feature": "lag_1d",            "importance": 0.198},
    {"feature": "rolling_mean_7d",   "importance": 0.187},
    {"feature": "hour_of_day",       "importance": 0.165},
    {"feature": "Humidity",          "importance": 0.143},
    {"feature": "lag_7d",            "importance": 0.121},
    {"feature": "day_of_week",       "importance": 0.094},
    {"feature": "UV_Index",          "importance": 0.072},
    {"feature": "month",             "importance": 0.058},
]

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class FromShapRequest(BaseModel):
    feature_importances: list[dict] = Field(
        ...,
        description='List of {"feature": str, "importance": float} dicts, sorted descending.',
        example=[
            {"feature": "Temperature", "importance": 0.312},
            {"feature": "Solar_Radiation", "importance": 0.274},
        ],
    )
    city: str = Field(default="Lahore", description="Target city for contextual tips.")


# ---------------------------------------------------------------------------
# GET /{city}
# ---------------------------------------------------------------------------


@router.get("/{city}", summary="Get energy-saving tips for a city")
async def get_tips(city: str, request: Request):
    """
    Return actionable energy-saving tips derived from SHAP global feature
    importances. Uses real XAI data when available, otherwise falls back to
    pre-computed mock importances.
    """
    from services.tips_engine import generate_tips

    city_cap = city.capitalize()
    feature_importances = _resolve_feature_importances(request, city_cap)
    tips = generate_tips(feature_importances, city=city_cap, top_n=3)

    return {
        "city": city_cap,
        "tips": tips,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /from-shap
# ---------------------------------------------------------------------------


@router.post("/from-shap", summary="Generate tips from provided SHAP importances")
async def tips_from_shap(body: FromShapRequest):
    """
    Generate energy-saving tips from caller-supplied SHAP feature importances.
    Useful when the front-end has already fetched XAI data and wants matching tips.
    """
    from services.tips_engine import generate_tips

    if not body.feature_importances:
        raise HTTPException(
            status_code=422,
            detail="feature_importances must be a non-empty list.",
        )

    city_cap = body.city.capitalize()
    tips = generate_tips(body.feature_importances, city=city_cap, top_n=3)

    return {
        "city": city_cap,
        "tips": tips,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_feature_importances(request: Request, city: str) -> list[dict]:
    """
    Attempt to obtain real global SHAP importances from the loaded XAI engine.
    Falls back to mock data silently so the endpoint always responds.
    """
    try:
        xai_engines = getattr(request.app.state, "xai_engines", {})
        # Prefer GRU > LSTM > CNN order (highest accuracy first)
        for model_name in ("gru", "lstm", "cnn"):
            engine = xai_engines.get(model_name)
            if engine is not None:
                result = engine.shap_global(n_background_samples=20)
                feature_names = result["feature_names"]
                mean_abs_shap = result["mean_abs_shap"]
                combined = [
                    {"feature": name, "importance": round(float(imp), 6)}
                    for name, imp in zip(feature_names, mean_abs_shap)
                ]
                combined.sort(key=lambda x: x["importance"], reverse=True)
                return combined
    except Exception as exc:
        logger.debug("Could not get real SHAP importances: %s", exc)

    return _MOCK_FEATURE_IMPORTANCES
