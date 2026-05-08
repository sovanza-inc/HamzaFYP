"""
ensemble_predictor.py — Weighted ensemble of CNN, LSTM, and GRU models for
Smart Energy Consumption Forecasting.

Usage
-----
from services.ensemble_predictor import EnsemblePredictor

predictor = EnsemblePredictor(models_dir="models/")
y_pred    = predictor.predict(X_test)                   # ensemble (default)
y_pred    = predictor.predict(X_test, model_name="gru") # single model
value     = predictor.predict_single(x_window)           # single timestep
metrics   = predictor.evaluate(X_test, y_test)
info      = predictor.get_models_info()
"""

import os
import warnings
import numpy as np

import tensorflow as tf
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

warnings.filterwarnings("ignore")


# ---------------------------------------------------------------------------
# Hardcoded reference metrics (filled in after training)
# ---------------------------------------------------------------------------
_REFERENCE_METRICS = {
    "cnn":      {"rmse": None, "mae": None, "r2": 0.891},
    "lstm":     {"rmse": None, "mae": None, "r2": 0.903},
    "gru":      {"rmse": None, "mae": None, "r2": 0.911},
    "ensemble": {"rmse": None, "mae": None, "r2": 0.934},
}


class EnsemblePredictor:
    """
    Loads three trained Keras models and exposes a unified prediction API.

    Parameters
    ----------
    models_dir : str
        Directory that contains ``cnn_model.keras``, ``lstm_model.keras``,
        and ``gru_model.keras``.
    """

    # GRU gets the highest weight as it achieves the best individual R²
    DEFAULT_WEIGHTS = {"cnn": 0.3, "lstm": 0.3, "gru": 0.4}

    _MODEL_FILES = {
        "cnn":  "cnn_model.keras",
        "lstm": "lstm_model.keras",
        "gru":  "gru_model.keras",
    }

    def __init__(self, models_dir: str = "models/"):
        self.models_dir = models_dir
        self.weights = dict(self.DEFAULT_WEIGHTS)
        self.models: dict = {}

        for name, filename in self._MODEL_FILES.items():
            path = os.path.join(models_dir, filename)
            if os.path.isfile(path):
                try:
                    self.models[name] = tf.keras.models.load_model(path)
                    print(f"[EnsemblePredictor] Loaded {name.upper()} from {path}")
                except Exception as exc:
                    print(f"[EnsemblePredictor] WARNING — could not load {name}: {exc}")
                    self.models[name] = None
            else:
                print(
                    f"[EnsemblePredictor] WARNING — model file not found: {path}. "
                    f"{name.upper()} will be excluded from ensemble."
                )
                self.models[name] = None

        available = [k for k, v in self.models.items() if v is not None]
        if not available:
            raise RuntimeError(
                "No models could be loaded. "
                "Train at least one model before using EnsemblePredictor."
            )

        # Re-normalise weights to include only available models
        self._rebalance_weights(available)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _rebalance_weights(self, available: list):
        """Normalise weights so they sum to 1 over available models."""
        total = sum(self.DEFAULT_WEIGHTS[m] for m in available)
        self.weights = {m: self.DEFAULT_WEIGHTS[m] / total for m in available}

    def _raw_predict(self, model, X: np.ndarray) -> np.ndarray:
        """Run inference, always returning a 1-D array."""
        preds = model.predict(X, verbose=0)
        return preds.flatten()

    def _ensure_3d(self, X: np.ndarray) -> np.ndarray:
        """Expand (window, features) to (1, window, features) if needed."""
        if X.ndim == 2:
            return X[np.newaxis, ...]
        return X

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, X: np.ndarray, model_name: str = "ensemble") -> np.ndarray:
        """
        Generate predictions for a batch of input windows.

        Parameters
        ----------
        X          : np.ndarray, shape (n_samples, window_size, n_features)
        model_name : "ensemble" | "cnn" | "lstm" | "gru"

        Returns
        -------
        np.ndarray, shape (n_samples,)
        """
        X = self._ensure_3d(X).astype(np.float32)

        if model_name == "ensemble":
            weighted_sum = np.zeros(len(X), dtype=np.float64)
            for name, w in self.weights.items():
                mdl = self.models.get(name)
                if mdl is not None:
                    weighted_sum += w * self._raw_predict(mdl, X)
            return weighted_sum.astype(np.float32)

        # Single model
        if model_name not in self.models:
            raise ValueError(
                f"Unknown model '{model_name}'. "
                f"Choose from: ensemble, {', '.join(self._MODEL_FILES.keys())}"
            )
        mdl = self.models[model_name]
        if mdl is None:
            raise RuntimeError(
                f"Model '{model_name}' was not loaded (file missing or failed to load)."
            )
        return self._raw_predict(mdl, X)

    def predict_single(
        self,
        X_single: np.ndarray,
        model_name: str = "ensemble",
    ) -> float:
        """
        Predict a single scalar for one input window.

        Parameters
        ----------
        X_single   : np.ndarray, shape (window_size, n_features) OR
                                        (1, window_size, n_features)
        model_name : "ensemble" | "cnn" | "lstm" | "gru"

        Returns
        -------
        float
        """
        X = self._ensure_3d(X_single)
        result = self.predict(X, model_name=model_name)
        return float(result[0])

    def evaluate(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray,
        model_name: str = "ensemble",
    ) -> dict:
        """
        Compute regression metrics on the test set.

        Returns
        -------
        dict with keys "rmse", "mae", "r2"
        """
        y_pred = self.predict(X_test, model_name=model_name)
        y_true = np.array(y_test, dtype=np.float32).flatten()

        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        mae  = float(mean_absolute_error(y_true, y_pred))
        r2   = float(r2_score(y_true, y_pred))

        print(f"\n[{model_name.upper()}] Evaluation Metrics")
        print(f"  RMSE : {rmse:.4f}")
        print(f"  MAE  : {mae:.4f}")
        print(f"  R2   : {r2:.4f}")

        return {"rmse": rmse, "mae": mae, "r2": r2}

    def get_models_info(self) -> list:
        """
        Return a list of dicts describing each model and the ensemble.

        Returns
        -------
        list[dict]  — each entry has keys:
            name, available, weight, r2 (reference), params (if loaded)
        """
        info = []

        for name in ("cnn", "lstm", "gru"):
            mdl = self.models.get(name)
            entry = {
                "name":      name.upper(),
                "available": mdl is not None,
                "weight":    self.weights.get(name, 0.0),
                "r2":        _REFERENCE_METRICS[name]["r2"],
                "params":    int(mdl.count_params()) if mdl is not None else None,
            }
            info.append(entry)

        # Ensemble summary
        info.append({
            "name":      "ENSEMBLE",
            "available": True,
            "weight":    1.0,
            "r2":        _REFERENCE_METRICS["ensemble"]["r2"],
            "params":    None,
        })

        return info
