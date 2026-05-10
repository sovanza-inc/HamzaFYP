"""
XAIEngine — SHAP and LIME explanations for a single CNN/LSTM/GRU model.

One XAIEngine instance is created per model at startup. If model files are
absent the engine stays unloaded and the routers fall back to mock data.
All heavy imports (shap, lime, tensorflow) are deferred to method call time
so the server starts even when those packages are unavailable.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("eco_forecast.xai_engine")

MODELS_DIR = Path("models")

# Canonical feature names used across the router and XAI engine
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

MODEL_PATHS = {
    "cnn":  MODELS_DIR / "cnn_model.h5",
    "lstm": MODELS_DIR / "lstm_model.h5",
    "gru":  MODELS_DIR / "gru_model.h5",
}


class XAIEngine:
    """
    Wraps a single Keras sequence model and exposes SHAP / LIME explanations.

    Parameters
    ----------
    model_name : str
        One of ``"cnn"``, ``"lstm"``, ``"gru"``.
    """

    def __init__(self, model_name: str = "lstm"):
        self.model_name = model_name.lower()
        self._model: Any = None
        self._background_data: np.ndarray | None = None
        self._loaded = False

    # ------------------------------------------------------------------
    # Public lifecycle
    # ------------------------------------------------------------------

    def load(self) -> None:
        """Load the Keras model from disk. Raises FileNotFoundError if absent."""
        path = MODEL_PATHS.get(self.model_name)
        if path is None:
            raise ValueError(f"Unknown model_name '{self.model_name}'")
        if not path.exists():
            raise FileNotFoundError(
                f"Model file not found: {path}. "
                "Train the models first or place pre-trained .h5 files in models/."
            )
        try:
            import tensorflow as tf  # type: ignore
            self._model = tf.keras.models.load_model(str(path))
            logger.info("XAIEngine loaded model '%s' from '%s'.", self.model_name, path)
        except Exception as exc:
            logger.warning("Could not load model '%s': %s", path, exc)
            self._model = None

        # Try to load background data for SHAP
        bg_path = MODELS_DIR / "background_data.npy"
        if bg_path.exists():
            self._background_data = np.load(str(bg_path))
            logger.info("Loaded SHAP background data: %s", bg_path)
        else:
            logger.warning("No background data at %s — SHAP will use zeros.", bg_path)
            self._background_data = np.zeros((10, 24, len(FEATURE_NAMES)), dtype=np.float32)

        self._loaded = True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _model_predict_flat(self, X_flat: np.ndarray) -> np.ndarray:
        """Reshape flat input back to [batch, timesteps, features] for the model."""
        n_samples = X_flat.shape[0]
        n_features = len(FEATURE_NAMES)
        timesteps = X_flat.shape[1] // n_features
        X_3d = X_flat.reshape(n_samples, timesteps, n_features)
        preds = self._model.predict(X_3d, verbose=0)
        return np.squeeze(preds).reshape(-1, 1)

    # ------------------------------------------------------------------
    # SHAP — global
    # ------------------------------------------------------------------

    def shap_global(self, n_background_samples: int = 50) -> dict[str, Any]:
        """
        Compute mean |SHAP| values over background samples.

        Returns
        -------
        dict with keys "feature_names" and "mean_abs_shap".
        """
        if not self._loaded or self._model is None:
            raise RuntimeError("XAIEngine not loaded or model unavailable.")

        import shap  # type: ignore

        bg = self._background_data[:n_background_samples]
        n, t, f = bg.shape
        bg_flat = bg.reshape(n, t * f)

        explainer = shap.KernelExplainer(self._model_predict_flat, bg_flat)
        shap_values = explainer.shap_values(bg_flat[:10], nsamples=100)

        if isinstance(shap_values, list):
            sv = np.array(shap_values[0])
        else:
            sv = np.array(shap_values)

        # sv shape: [n_instances, t*f] — reshape to [n_instances, t, f] then mean over t
        sv_3d = sv.reshape(sv.shape[0], t, f)
        mean_abs_shap = np.mean(np.abs(sv_3d), axis=(0, 1))

        return {
            "feature_names": FEATURE_NAMES[:f],
            "mean_abs_shap": mean_abs_shap.tolist(),
        }

    # ------------------------------------------------------------------
    # SHAP — local
    # ------------------------------------------------------------------

    def shap_local(
        self,
        input_sequence: list[list[float]],
        instance_idx: int = 0,
    ) -> dict[str, Any]:
        """Compute per-feature SHAP values for one instance."""
        if not self._loaded or self._model is None:
            raise RuntimeError("XAIEngine not loaded or model unavailable.")

        import shap  # type: ignore

        arr = np.array(input_sequence, dtype=np.float32)
        t, f = arr.shape
        bg = self._background_data[:20].reshape(20, t * f)
        instance_flat = arr.reshape(1, t * f)

        explainer = shap.KernelExplainer(self._model_predict_flat, bg)
        sv = explainer.shap_values(instance_flat, nsamples=200)
        if isinstance(sv, list):
            sv = np.array(sv[0])
        sv_3d = sv.reshape(t, f)

        # Aggregate over timesteps (mean)
        sv_per_feature = np.mean(sv_3d, axis=0)
        fv_per_feature = np.mean(arr, axis=0)

        pred = self._model.predict(np.expand_dims(arr, 0), verbose=0)
        prediction = float(np.squeeze(pred))

        base_value = float(explainer.expected_value[0])  \
            if hasattr(explainer.expected_value, "__len__") \
            else float(explainer.expected_value)

        return {
            "feature_names": FEATURE_NAMES[:f],
            "shap_values": sv_per_feature.tolist(),
            "feature_values": fv_per_feature.tolist(),
            "base_value": base_value,
            "prediction": prediction,
        }

    # ------------------------------------------------------------------
    # LIME
    # ------------------------------------------------------------------

    def lime_explain(
        self,
        input_sequence: list[list[float]],
        feature_names: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate LIME explanation for a single prediction instance."""
        if not self._loaded or self._model is None:
            raise RuntimeError("XAIEngine not loaded or model unavailable.")

        import lime.lime_tabular  # type: ignore

        if feature_names is None:
            feature_names = FEATURE_NAMES

        arr = np.array(input_sequence, dtype=np.float32)
        t, f = arr.shape
        instance_flat = arr.reshape(t * f)

        bg_flat = self._background_data[:50].reshape(50, t * f)

        # Repeat feature names for each timestep
        all_feature_names = [feat for _ in range(t) for feat in feature_names[:f]]

        def predict_fn(X: np.ndarray) -> np.ndarray:
            X_3d = X.reshape(-1, t, f)
            preds = self._model.predict(X_3d, verbose=0)
            return np.squeeze(preds).reshape(-1)

        explainer = lime.lime_tabular.LimeTabularExplainer(
            training_data=bg_flat,
            feature_names=all_feature_names,
            mode="regression",
        )
        explanation = explainer.explain_instance(
            data_row=instance_flat,
            predict_fn=predict_fn,
            num_features=len(feature_names),
        )

        lime_list = explanation.as_list()
        explanations = [
            {
                "condition": cond,
                "weight": round(float(w), 6),
                "feature": feature_names[min(i, len(feature_names) - 1)],
            }
            for i, (cond, w) in enumerate(lime_list)
        ]

        pred = float(self._model.predict(np.expand_dims(arr, 0), verbose=0).squeeze())
        intercept = (
            float(explanation.intercept[1])
            if hasattr(explanation.intercept, "__len__")
            else float(explanation.intercept)
        )

        return {
            "explanations": explanations,
            "intercept": round(intercept, 6),
            "prediction_local": round(pred, 6),
        }

    # ------------------------------------------------------------------
    # Legacy helpers (kept for backward compatibility with any existing code)
    # ------------------------------------------------------------------

    def compute_shap(
        self,
        X_background: np.ndarray,
        X_explain: np.ndarray,
    ) -> np.ndarray:
        """Legacy SHAP interface — prefers GradientExplainer, falls back to mock."""
        try:
            if self._model is None:
                raise RuntimeError("Model not loaded.")
            import shap  # type: ignore
            explainer = shap.GradientExplainer(self._model, X_background)
            raw = explainer.shap_values(X_explain)
            sv = raw[0] if isinstance(raw, list) else raw
            if sv.ndim == 4:
                sv = sv[..., 0]
            return sv.astype(np.float32)
        except Exception as exc:
            logger.warning("compute_shap fallback for '%s': %s", self.model_name, exc)
            return self._mock_shap(X_explain)

    def _mock_shap(self, X_explain: np.ndarray) -> np.ndarray:
        rng = np.random.default_rng(seed=42)
        m, t, f = X_explain.shape
        stds = np.array([0.45, 0.30, 0.35, 0.18, 0.12, 0.12, 0.10, 0.10, 0.08, 0.08])
        if f > len(stds):
            stds = np.concatenate([stds, np.full(f - len(stds), 0.05)])
        else:
            stds = stds[:f]
        return (rng.standard_normal((m, t, f)) * stds[np.newaxis, np.newaxis, :]).astype(np.float32)

    def compute_lime(self, X_instance: np.ndarray, feature_names: list) -> dict:
        """Legacy LIME interface."""
        try:
            result = self.lime_explain(
                input_sequence=X_instance.tolist() if hasattr(X_instance, "tolist") else X_instance,
                feature_names=feature_names,
            )
            return {item["feature"]: item["weight"] for item in result["explanations"]}
        except Exception as exc:
            logger.warning("compute_lime fallback for '%s': %s", self.model_name, exc)
            return self._mock_lime(feature_names)

    def _mock_lime(self, feature_names: list) -> dict:
        rng = np.random.default_rng(seed=7)
        base_weights = {
            "Temperature": 0.38, "Solar_Radiation": 0.32, "lag_1d": 0.42,
            "rolling_mean_7d": 0.28, "hour_of_day": 0.20, "Humidity": 0.25,
            "lag_7d": 0.18, "day_of_week": 0.12, "UV_Index": 0.09, "month": 0.06,
        }
        result = {}
        for fname in feature_names:
            base = base_weights.get(fname, 0.05)
            noise = rng.normal(0, base * 0.15)
            sign = 1.0 if rng.random() > 0.35 else -1.0
            result[fname] = float(sign * (base + noise))
        return result

    def get_top_features(self, shap_values: np.ndarray, feature_names: list, top_n: int = 10) -> list:
        arr = np.asarray(shap_values, dtype=np.float32)
        n_feat = min(arr.shape[-1], len(feature_names))
        importance = np.abs(arr[..., :n_feat]).mean(axis=(0, 1))
        ranked = sorted(zip(feature_names[:n_feat], importance.tolist()), key=lambda x: x[1], reverse=True)
        return [{"feature": name, "importance": round(imp, 6)} for name, imp in ranked[:top_n]]

    def get_local_explanations(self, shap_values: np.ndarray, feature_names: list) -> list:
        arr = np.asarray(shap_values, dtype=np.float32)
        if arr.ndim == 3:
            arr = arr[0]
        n_feat = min(arr.shape[-1], len(feature_names))
        mean_shap = arr[:, :n_feat].mean(axis=0)
        explanations = [
            {"feature": n, "shap_value": round(float(v), 6), "direction": "positive" if v >= 0 else "negative"}
            for n, v in zip(feature_names[:n_feat], mean_shap.tolist())
        ]
        explanations.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return explanations
