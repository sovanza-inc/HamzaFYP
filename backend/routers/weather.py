"""
Weather router — current conditions and 24-hour forecast for Pakistani cities.
Registered in main.py with prefix="/api/weather".
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("eco_forecast.weather")

router = APIRouter()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _derive_condition(
    temperature: float,
    solar_radiation: float,
    precipitation: float,
) -> str:
    """Derive a human-readable weather condition string."""
    if precipitation > 0:
        return "Rainy"
    if solar_radiation > 500:
        return "Sunny"
    if temperature > 38:
        return "Very Hot"
    if temperature > 30:
        return "Hot"
    if temperature < 15:
        return "Cold"
    return "Clear"


def _feels_like(temperature: float, humidity: float) -> float:
    """Simple feels-like adjustment based on humidity."""
    return round(temperature + 2.0 if humidity > 70 else temperature - 1.0, 2)


# ---------------------------------------------------------------------------
# GET /current/{city}
# ---------------------------------------------------------------------------

@router.get("/current/{city}", summary="Current weather conditions for a city")
async def current_weather(city: str):
    """
    Return the current weather conditions for *city*.
    Fetches from Open-Meteo; falls back to city defaults if the API is unreachable.
    """
    from services.weather_fetcher import get_weather, get_city_defaults

    city_cap = city.capitalize()

    try:
        weather_df = await get_weather(city=city_cap, hours=1)
        row = weather_df.iloc[0]

        temperature = float(row.get("temperature", 0.0))
        humidity = float(row.get("humidity", 0.0))
        solar_radiation = float(row.get("solar_radiation", 0.0))
        wind_speed = float(row.get("wind_speed", 0.0))
        precipitation = float(row.get("precipitation", 0.0))
        uv_index = float(row.get("uv_index", 0.0))

    except Exception as exc:
        logger.warning("Weather fetch failed for '%s': %s — using city defaults.", city_cap, exc)
        defaults = get_city_defaults(city_cap)
        temperature = defaults.get("temperature", 30.0)
        humidity = defaults.get("humidity", 60.0)
        solar_radiation = defaults.get("solar_radiation", 500.0)
        wind_speed = defaults.get("wind_speed", 10.0)
        precipitation = defaults.get("precipitation", 0.0)
        uv_index = defaults.get("uv_index", 6.0)

    return {
        "city": city_cap,
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
        "solar_radiation": round(solar_radiation, 2),
        "wind_speed": round(wind_speed, 2),
        "precipitation": round(precipitation, 2),
        "uv_index": round(uv_index, 2),
        "feels_like": _feels_like(temperature, humidity),
        "condition": _derive_condition(temperature, solar_radiation, precipitation),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /forecast/{city}
# ---------------------------------------------------------------------------

@router.get("/forecast/{city}", summary="24-hour hourly weather forecast for a city")
async def weather_forecast(city: str):
    """
    Return a 24-hour hourly weather forecast for *city*, suitable for charting.
    Fetches from Open-Meteo; falls back to synthetic city-default data on failure.
    """
    from services.weather_fetcher import get_weather, get_city_defaults

    city_cap = city.capitalize()

    try:
        weather_df = await get_weather(city=city_cap, hours=24)
    except Exception as exc:
        logger.warning(
            "Weather forecast fetch failed for '%s': %s — using city defaults.",
            city_cap,
            exc,
        )
        # Build synthetic hourly list from defaults
        defaults = get_city_defaults(city_cap)
        hourly = [
            {
                "hour": h,
                "temperature": round(defaults.get("temperature", 30.0), 2),
                "humidity": round(defaults.get("humidity", 60.0), 2),
                "solar_radiation": round(defaults.get("solar_radiation", 500.0), 2),
            }
            for h in range(24)
        ]
        return {"city": city_cap, "hourly": hourly}

    hourly = []
    for h, (_, row) in enumerate(weather_df.iterrows()):
        hourly.append(
            {
                "hour": h,
                "temperature": round(float(row.get("temperature", 0.0)), 2),
                "humidity": round(float(row.get("humidity", 0.0)), 2),
                "solar_radiation": round(float(row.get("solar_radiation", 0.0)), 2),
            }
        )

    return {"city": city_cap, "hourly": hourly}
