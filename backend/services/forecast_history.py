"""
forecast_history.py — Persist and retrieve forecast run records.
Entries are stored in data/forecast_history.json (up to 100 kept).
"""

import json
import os
from datetime import datetime, timezone

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "forecast_history.json")


def log_forecast(city: str, model: str, predicted_kwh: float, r2: float) -> None:
    """Append a forecast run to the history file. Keeps last 100 entries."""
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    try:
        history = _load()
        history.append(
            {
                "city": city,
                "model": model,
                "predicted_kwh": round(predicted_kwh, 3),
                "r2": r2,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        # Keep last 100
        history = history[-100:]
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
    except Exception:
        pass


def get_history(limit: int = 50) -> list:
    """Return the most recent *limit* forecast entries."""
    return _load()[-limit:]


def clear_history() -> None:
    """Delete the history file entirely."""
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)


def _load() -> list:
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE) as f:
            return json.load(f)
    except Exception:
        return []
