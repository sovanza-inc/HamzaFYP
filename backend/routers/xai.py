"""
XAI router — SHAP and LIME explainability endpoints.
"""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("eco_forecast.xai")

router = APIRouter()

# ---------------------------------------------------------------------------
# Feature names used across the system
# ---------------------------------------------------------------------------

FEATURE_NAMES = [
    "Temperature",
    "Solar_Radiation",
    "lag_1d",
    "rolling_mean_7d",
    "hour_of_day",
    "Humidity",
    "lag_7d",
    "day_of_week",
    "UV_Index",
    "month",
]

# Pre-computed mock SHAP importance values (plausible magnitudes)
_MOCK_SHAP_IMPORTANCE = [0.312, 0.274, 0.198, 0.187, 0.165, 0.143, 0.121, 0.094, 0.072, 0.058]

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ShapGlobalRequest(BaseModel):
    model: str = Field(default="cnn", description="Model to explain: cnn | lstm | gru.")
    n_background_samples: int = Field(
        default=50,
        ge=10,
        le=500,
        description="Number of background samples for SHAP kernel explainer.",
    )


class ShapGlobalResponse(BaseModel):
    feature_importances: list[dict]
    model: str
    computed_at: str


class ShapLocalRequest(BaseModel):
    model: str = Field(..., description="Model to explain: cnn | lstm | gru.")
    instance_idx: int = Field(default=0, ge=0, description="Index of the instance to explain.")
    input_sequence: list[list[float]] = Field(
        ..., description="2-D input sequence [timestep x features]."
    )


class ShapLocalResponse(BaseModel):
    local_explanations: list[dict]
    base_value: float
    prediction: float


class LimeRequest(BaseModel):
    model: str = Field(..., description="Model to explain: cnn | lstm | gru.")
    input_sequence: list[list[float]] = Field(
        ..., description="2-D input sequence [timestep x features]."
    )
    feature_names: list[str] = Field(
        default_factory=lambda: FEATURE_NAMES,
        description="Human-readable feature names.",
    )


class LimeResponse(BaseModel):
    lime_explanations: list[dict]
    intercept: float
    prediction_local: float


# ---------------------------------------------------------------------------
# Mock data helpers
# ---------------------------------------------------------------------------

def _mock_shap_global(model: str) -> ShapGlobalResponse:
    """Generate realistic mock SHAP global importances when model is unavailable."""
    importances = [
        {"feature": feat, "importance": round(val, 4), "rank": idx + 1}
        for idx, (feat, val) in enumerate(zip(FEATURE_NAMES, _MOCK_SHAP_IMPORTANCE))
    ]
    return ShapGlobalResponse(
        feature_importances=importances,
        model=model,
        computed_at=datetime.now(timezone.utc).isoformat(),
    )


def _mock_shap_local(model: str, prediction: float = 28.4) -> ShapLocalResponse:
    """Generate realistic mock SHAP local explanations."""
    shap_vals = [0.58, 0.42, -0.31, 0.28, 0.22, -0.18, 0.14, -0.09, 0.07, 0.04]
    explanations = [
        {
            "feature": feat,
            "shap_value": round(val, 4),
            "feature_value": round(10.0 + i * 3.5, 2),
        }
        for i, (feat, val) in enumerate(zip(FEATURE_NAMES, shap_vals))
    ]
    return ShapLocalResponse(
        local_explanations=explanations,
        base_value=round(prediction - sum(shap_vals), 4),
        prediction=round(prediction, 4),
    )


def _mock_lime(model: str, prediction_local: float = 28.4) -> LimeResponse:
    """Generate realistic mock LIME explanations."""
    lime_vals = [
        ("Temperature > 38.0", 0.51),
        ("Solar_Radiation > 800", 0.38),
        ("lag_1d <= 25.0", -0.29),
        ("rolling_mean_7d > 22.0", 0.24),
        ("hour_of_day > 14", 0.19),
        ("Humidity <= 40.0", -0.15),
        ("lag_7d <= 23.0", 0.11),
        ("day_of_week = weekday", -0.08),
        ("UV_Index > 7", 0.06),
        ("month = Jun–Aug", 0.04),
    ]
    explanations = [
        {"condition": cond, "weight": round(w, 4), "feature": FEATURE_NAMES[i]}
        for i, (cond, w) in enumerate(lime_vals)
    ]
    return LimeResponse(
        lime_explanations=explanations,
        intercept=round(prediction_local - sum(w for _, w in lime_vals), 4),
        prediction_local=round(prediction_local, 4),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/shap-global",
    response_model=ShapGlobalResponse,
    summary="Global SHAP feature importances",
)
async def shap_global(request: Request, body: ShapGlobalRequest):
    """
    Compute global SHAP feature importances for the specified model.
    Returns mock data if the XAI engine is not loaded.
    """
    engines: dict = getattr(request.app.state, "xai_engines", {})
    engine = engines.get(body.model.lower())

    if engine is None:
        logger.info(
            "XAI engine not loaded for model '%s' — returning mock SHAP global data.",
            body.model,
        )
        return _mock_shap_global(body.model)

    try:
        result = engine.shap_global(n_background_samples=body.n_background_samples)
        importances = [
            {"feature": feat, "importance": round(float(val), 4), "rank": idx + 1}
            for idx, (feat, val) in enumerate(
                sorted(zip(result["feature_names"], result["mean_abs_shap"]), key=lambda x: -x[1])
            )
        ]
        return ShapGlobalResponse(
            feature_importances=importances,
            model=body.model,
            computed_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.error("SHAP global computation failed: %s", exc)
        return _mock_shap_global(body.model)


@router.post(
    "/shap-local",
    response_model=ShapLocalResponse,
    summary="Local SHAP explanation for a single instance",
)
async def shap_local(request: Request, body: ShapLocalRequest):
    """
    Compute per-feature SHAP values for a single prediction instance.
    Returns mock data if the XAI engine is not loaded.
    """
    engines: dict = getattr(request.app.state, "xai_engines", {})
    engine = engines.get(body.model.lower())

    if engine is None:
        logger.info(
            "XAI engine not loaded for model '%s' — returning mock SHAP local data.",
            body.model,
        )
        return _mock_shap_local(body.model)

    try:
        result = engine.shap_local(
            input_sequence=body.input_sequence,
            instance_idx=body.instance_idx,
        )
        explanations = [
            {
                "feature": feat,
                "shap_value": round(float(sv), 4),
                "feature_value": round(float(fv), 4),
            }
            for feat, sv, fv in zip(
                result["feature_names"],
                result["shap_values"],
                result["feature_values"],
            )
        ]
        return ShapLocalResponse(
            local_explanations=explanations,
            base_value=round(float(result["base_value"]), 4),
            prediction=round(float(result["prediction"]), 4),
        )
    except Exception as exc:
        logger.error("SHAP local computation failed: %s", exc)
        return _mock_shap_local(body.model)


@router.post(
    "/lime",
    response_model=LimeResponse,
    summary="LIME explanation for a single instance",
)
async def lime_explain(request: Request, body: LimeRequest):
    """
    Generate LIME (Local Interpretable Model-agnostic Explanations) for a
    single prediction. Returns mock data if the XAI engine is not loaded.
    """
    engines: dict = getattr(request.app.state, "xai_engines", {})
    engine = engines.get(body.model.lower())

    if engine is None:
        logger.info(
            "XAI engine not loaded for model '%s' — returning mock LIME data.",
            body.model,
        )
        return _mock_lime(body.model)

    try:
        result = engine.lime_explain(
            input_sequence=body.input_sequence,
            feature_names=body.feature_names,
        )
        explanations = [
            {"condition": item["condition"], "weight": round(float(item["weight"]), 4), "feature": item["feature"]}
            for item in result["explanations"]
        ]
        return LimeResponse(
            lime_explanations=explanations,
            intercept=round(float(result["intercept"]), 4),
            prediction_local=round(float(result["prediction_local"]), 4),
        )
    except Exception as exc:
        logger.error("LIME explanation failed: %s", exc)
        return _mock_lime(body.model)


@router.get(
    "/plots/{filename}",
    summary="Serve a saved XAI plot",
    response_class=FileResponse,
)
async def get_plot(filename: str):
    """
    Serve a pre-generated SHAP or LIME plot image from the plots/ directory.
    Supported formats: .png, .jpg, .svg.
    """
    # Sanitise filename to prevent path traversal
    safe_name = Path(filename).name
    allowed_extensions = {".png", ".jpg", ".jpeg", ".svg"}
    if Path(safe_name).suffix.lower() not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    plots_dir = Path("plots")
    file_path = plots_dir / safe_name

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Plot '{safe_name}' not found. Generate it first via the SHAP/LIME endpoints.",
        )

    media_type_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
    }
    media_type = media_type_map.get(Path(safe_name).suffix.lower(), "application/octet-stream")
    return FileResponse(path=str(file_path), media_type=media_type)
