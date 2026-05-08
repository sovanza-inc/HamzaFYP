"""
weather_fetcher.py — Fetch real-time hourly weather data for Pakistani cities
using the Open-Meteo free API (no API key required).

If the API is unreachable or returns an error, ``get_weather`` falls back to
synthetic data generated from per-city typical values.

The returned DataFrame columns match the feature names produced by
DataPreprocessor so that a live window can be fed directly to EnsemblePredictor.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# City coordinates  (lat, lon)
# ---------------------------------------------------------------------------
CITY_COORDS: dict[str, tuple[float, float]] = {
    "Lahore":    (31.5,  74.3),
    "Karachi":   (24.8,  67.0),
    "Islamabad": (33.7,  73.1),
    "Multan":    (30.2,  71.4),
    "Peshawar":  (34.0,  71.5),
    "Skardu":    (35.3,  75.6),
}

# Open-Meteo endpoint
_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Mapping from Open-Meteo variable names -> DataPreprocessor column names
_VAR_MAP: dict[str, str] = {
    "temperature_2m":        "temperature",
    "relative_humidity_2m":  "humidity",
    "precipitation":         "precipitation",
    "wind_speed_10m":        "wind_speed",
    "shortwave_radiation":   "solar_radiation",
    "uv_index":              "uv_index",
}

# Open-Meteo variables to request
_HOURLY_VARS = list(_VAR_MAP.keys())


# ---------------------------------------------------------------------------
# Typical city weather defaults (used for synthetic fallback)
# ---------------------------------------------------------------------------
_CITY_DEFAULTS: dict[str, dict] = {
    "Lahore": {
        "temperature":    32.0,
        "humidity":       60.0,
        "dew":            20.0,
        "precipitation":  0.5,
        "wind_speed":     12.0,
        "wind_direction": 180.0,
        "pressure":       1005.0,
        "solar_radiation": 500.0,
        "solar_energy":    1.8,
        "uv_index":        6.0,
    },
    "Karachi": {
        "temperature":    33.0,
        "humidity":       70.0,
        "dew":            24.0,
        "precipitation":  0.1,
        "wind_speed":     15.0,
        "wind_direction": 225.0,
        "pressure":       1008.0,
        "solar_radiation": 580.0,
        "solar_energy":    2.1,
        "uv_index":        7.0,
    },
    "Islamabad": {
        "temperature":    26.0,
        "humidity":       55.0,
        "dew":            16.0,
        "precipitation":  2.0,
        "wind_speed":     10.0,
        "wind_direction": 150.0,
        "pressure":       900.0,
        "solar_radiation": 450.0,
        "solar_energy":    1.6,
        "uv_index":        5.5,
    },
    "Multan": {
        "temperature":    38.0,
        "humidity":       40.0,
        "dew":            18.0,
        "precipitation":  0.2,
        "wind_speed":     8.0,
        "wind_direction": 200.0,
        "pressure":       1002.0,
        "solar_radiation": 620.0,
        "solar_energy":    2.2,
        "uv_index":        8.0,
    },
    "Peshawar": {
        "temperature":    30.0,
        "humidity":       45.0,
        "dew":            17.0,
        "precipitation":  1.0,
        "wind_speed":     9.0,
        "wind_direction": 160.0,
        "pressure":       960.0,
        "solar_radiation": 480.0,
        "solar_energy":    1.7,
        "uv_index":        6.0,
    },
    "Skardu": {
        "temperature":    15.0,
        "humidity":       35.0,
        "dew":            5.0,
        "precipitation":  0.3,
        "wind_speed":     6.0,
        "wind_direction": 90.0,
        "pressure":       620.0,
        "solar_radiation": 700.0,
        "solar_energy":    2.5,
        "uv_index":        9.0,
    },
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_city_defaults(city: str) -> dict:
    """
    Return typical (annual-average) weather values for *city*.

    Parameters
    ----------
    city : str  — one of the six supported Pakistani cities

    Returns
    -------
    dict of {feature_name: float}
    """
    city_cap = city.capitalize()
    if city_cap not in _CITY_DEFAULTS:
        # Unknown city — use Lahore as a reasonable fallback
        return dict(_CITY_DEFAULTS["Lahore"])
    return dict(_CITY_DEFAULTS[city_cap])


async def get_weather(city: str, hours: int = 24) -> pd.DataFrame:
    """
    Fetch the next *hours* hours of forecast data for *city* from Open-Meteo.

    Parameters
    ----------
    city  : str  — one of the six supported Pakistani cities
    hours : int  — number of future hours to retrieve (default 24)

    Returns
    -------
    pd.DataFrame
        Index  : DatetimeIndex (UTC)
        Columns: temperature, humidity, dew, precipitation, wind_speed,
                 wind_direction, pressure, solar_radiation, solar_energy,
                 uv_index  (columns that are not returned by the API are
                 filled with city-default values)
    """
    city_cap = city.capitalize()
    if city_cap not in CITY_COORDS:
        raise ValueError(
            f"Unsupported city '{city}'. "
            f"Supported cities: {', '.join(CITY_COORDS.keys())}"
        )

    lat, lon = CITY_COORDS[city_cap]

    params = {
        "latitude":          lat,
        "longitude":         lon,
        "hourly":            ",".join(_HOURLY_VARS),
        "forecast_days":     max(1, (hours // 24) + 1),
        "timezone":          "Asia/Karachi",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(_OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()

        df = _parse_open_meteo_response(data, city_cap, hours)
        return df

    except Exception as exc:
        print(
            f"[weather_fetcher] WARNING — Open-Meteo API call failed for '{city}': {exc}. "
            "Returning synthetic fallback data."
        )
        return _synthetic_weather(city_cap, hours)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_open_meteo_response(data: dict, city: str, hours: int) -> pd.DataFrame:
    """Parse Open-Meteo JSON into a clean DataFrame."""
    hourly = data.get("hourly", {})
    times  = hourly.get("time", [])

    if not times:
        raise ValueError("Open-Meteo returned no hourly data.")

    df = pd.DataFrame({"datetime": pd.to_datetime(times)})
    df = df.set_index("datetime")

    for api_var, col_name in _VAR_MAP.items():
        values = hourly.get(api_var)
        if values:
            df[col_name] = values
        else:
            df[col_name] = np.nan

    # Fill columns that Open-Meteo doesn't provide with city defaults
    defaults = get_city_defaults(city)
    for col in ("dew", "wind_direction", "pressure", "solar_energy"):
        if col not in df.columns or df[col].isna().all():
            df[col] = defaults.get(col, 0.0)

    # Trim to requested number of hours
    df = df.iloc[:hours]

    # Forward-fill any remaining NaN, then use defaults as final fallback
    df = df.ffill()
    for col in df.columns:
        df[col] = df[col].fillna(defaults.get(col, 0.0))

    return df.astype(float)


def _synthetic_weather(city: str, hours: int) -> pd.DataFrame:
    """
    Generate a synthetic weather DataFrame seeded from city-typical values,
    with small random noise to simulate realistic variation.
    """
    defaults = get_city_defaults(city)
    now      = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
    idx      = pd.date_range(start=now, periods=hours, freq="1H")

    rng = np.random.default_rng(seed=42)

    rows = {}
    for col, base in defaults.items():
        noise = rng.normal(0, base * 0.05, size=hours)  # 5 % std dev
        rows[col] = np.clip(base + noise, 0, None)

    # Add realistic diurnal cycle to temperature and solar_radiation
    hour_arr = np.array([t.hour for t in idx])
    rows["temperature"]    += 5 * np.sin(np.pi * (hour_arr - 6) / 12)
    rows["solar_radiation"] *= np.clip(np.sin(np.pi * (hour_arr - 6) / 12), 0, 1)
    rows["solar_energy"]    *= np.clip(np.sin(np.pi * (hour_arr - 6) / 12), 0, 1)
    rows["uv_index"]        *= np.clip(np.sin(np.pi * (hour_arr - 6) / 12), 0, 1)

    df = pd.DataFrame(rows, index=idx)
    df.index.name = "datetime"
    return df.astype(float)


# ---------------------------------------------------------------------------
# Synchronous convenience wrapper (for non-async callers)
# ---------------------------------------------------------------------------

def get_weather_sync(city: str, hours: int = 24) -> pd.DataFrame:
    """Synchronous wrapper around ``get_weather``. Use in scripts/tests."""
    return asyncio.run(get_weather(city, hours))


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    city = sys.argv[1] if len(sys.argv) > 1 else "Lahore"
    print(f"\nFetching 24-hour weather forecast for {city}...")
    df = get_weather_sync(city, hours=24)
    print(df.to_string())
