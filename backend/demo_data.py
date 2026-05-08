"""
demo_data.py — Generate realistic 24-hour demo input data for Eco Forecast.

Simulates a hot Lahore summer day (June) with authentic diurnal profiles for:
  - Temperature          (32–42 °C, cool pre-dawn, peaks at 15:00)
  - Humidity             (35–65 %, inversely correlated with temperature)
  - Solar radiation      (0 at night, bell curve 06:00–19:00, peak ~850 W/m²)
  - Energy consumption   (Pakistani bimodal pattern: morning + dominant evening peak)

Output:
  data/demo_sequence.json   — 24-element list of hourly feature dicts + metadata

Run from the backend/ directory:

    python demo_data.py
"""

import json
import math
import os

# ---------------------------------------------------------------------------
# Hourly profiles
# ---------------------------------------------------------------------------

def _temperature_curve() -> list:
    """
    Realistic Lahore June temperature in °C.
    Minimum ~32 °C at 04:00, maximum ~42 °C at 15:00.
    Uses a cosine curve shifted to align the trough at 04:00.
    """
    T_min, T_max = 32.0, 42.0
    peak_hour = 15  # 15:00 solar time — typical for inland cities
    trough_hour = 4

    values = []
    for h in range(24):
        # Angle: 0 at trough_hour, π at peak_hour
        phase = math.pi * (h - trough_hour) / (peak_hour - trough_hour)
        # sin² gives a smooth single-peak curve
        frac = math.sin(math.radians((h - trough_hour) * 180 / (peak_hour - trough_hour)))
        if h < trough_hour or h > peak_hour + (24 - peak_hour + trough_hour) // 2:
            frac = max(frac, 0.0)
        # Clamp to [0, 1]
        frac = max(0.0, frac)
        temp = T_min + (T_max - T_min) * (frac ** 2)
        values.append(round(temp, 2))
    return values


def _temperature_curve_v2() -> list:
    """
    More accurate version using a two-sine blend for the nocturnal cool-down.
    Returns a 24-element list of °C values.
    """
    # Anchor points (hour, temp)
    anchors = [
        (0,  35.5), (1,  34.8), (2,  34.0), (3,  33.4), (4,  32.8),
        (5,  33.2), (6,  34.0), (7,  35.5), (8,  37.0), (9,  38.5),
        (10, 39.8), (11, 40.9), (12, 41.5), (13, 41.9), (14, 42.1),
        (15, 42.0), (16, 41.5), (17, 40.8), (18, 39.5), (19, 38.2),
        (20, 37.3), (21, 36.7), (22, 36.2), (23, 35.7),
    ]
    return [t for _, t in anchors]


def _humidity_curve(temps: list) -> list:
    """
    Relative humidity (%) inversely correlated with temperature.
    Range: 35 % (peak heat) – 65 % (pre-dawn cool).
    """
    T_min = min(temps)
    T_max = max(temps)
    values = []
    for t in temps:
        # Normalise temperature to [0, 1] and invert for humidity
        frac = (t - T_min) / (T_max - T_min)
        rh = 65.0 - 30.0 * frac  # 65 % at coolest, 35 % at hottest
        values.append(round(rh, 1))
    return values


def _solar_radiation_curve() -> list:
    """
    Global horizontal irradiance (W/m²).
    Zero at night, smooth bell curve 06:00–19:00 peaking at ~850 W/m² at 12:00.
    """
    sunrise = 6.0   # approximate for Lahore in June
    sunset  = 19.0
    solar_noon = (sunrise + sunset) / 2  # 12.5
    peak_ghi = 850.0

    values = []
    for h in range(24):
        if h < sunrise or h >= sunset:
            values.append(0.0)
        else:
            # Fraction of daylight elapsed
            day_length = sunset - sunrise
            angle = math.pi * (h - sunrise) / day_length
            ghi = peak_ghi * math.sin(angle)
            values.append(round(max(0.0, ghi), 1))
    return values


def _wind_speed_curve() -> list:
    """
    Typical Lahore June wind speed (m/s).
    Calm at night, moderate breeze in the afternoon.
    """
    profile = [
        1.2, 1.0, 0.9, 0.8, 0.9, 1.1,
        1.5, 1.8, 2.2, 2.8, 3.2, 3.5,
        3.8, 4.1, 4.2, 4.0, 3.8, 3.3,
        2.8, 2.2, 1.8, 1.5, 1.3, 1.2,
    ]
    return profile


def _energy_curve() -> list:
    """
    Realistic Pakistani residential + commercial electricity demand (relative kWh).

    Pattern:
      - 01:00–05:00  Low overnight (minimal activity, fans only)
      - 06:00–09:00  Morning ramp (cooking, water heaters, commercial opening)
      - 10:00–13:00  Mid-morning plateau (offices, AC ramp-up)
      - 14:00–17:00  Peak AC hours (hottest part of day)
      - 18:00–19:00  Slight dip (school closures, some AC auto-set)
      - 19:00–22:00  Dominant evening peak (cooking, lighting, social activity)
      - 23:00–00:00  Rapid decline
    """
    profile = [
        # Hour  kWh
        28.5,   # 00  post-evening decline
        22.0,   # 01  low overnight
        18.5,   # 02
        16.8,   # 03
        15.5,   # 04  overnight trough
        16.2,   # 05  early riser / Fajr prayer
        22.0,   # 06  morning ramp begins
        32.5,   # 07  cooking breakfast / AC switches on
        42.0,   # 08  morning peak
        44.5,   # 09  offices + commercial fully open
        46.0,   # 10  mid-morning plateau
        47.2,   # 11
        46.8,   # 12  slight dip — lunch hour / some offices dim lights
        47.5,   # 13  afternoon recovery
        50.2,   # 14  AC peak — hottest hours begin
        52.8,   # 15  absolute temperature peak, maximum AC load
        53.5,   # 16  sustained peak
        52.0,   # 17  minor dip — school closures
        50.5,   # 18  pre-evening
        54.5,   # 19  evening peak begins — cooking + returning workers
        58.0,   # 20  dominant evening peak
        56.5,   # 21
        50.0,   # 22  wind-down
        39.5,   # 23  rapid decline
    ]
    return profile


# ---------------------------------------------------------------------------
# Circular encoding helpers
# ---------------------------------------------------------------------------

def _sin_cos(value: float, period: float):
    angle = 2 * math.pi * value / period
    return round(math.sin(angle), 6), round(math.cos(angle), 6)


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

def generate_demo_sequence() -> list:
    """
    Build a 24-element list of per-hour feature dicts for a Lahore June day.

    Each dict contains the raw features plus all engineered inputs expected
    by Eco Forecast models (circular encodings, lag placeholders, flags).
    """
    temps  = _temperature_curve_v2()
    rh     = _humidity_curve(temps)
    solar  = _solar_radiation_curve()
    wind   = _wind_speed_curve()
    energy = _energy_curve()

    # Simple lag approximations for the demo sequence:
    # lag_1h  = energy from the previous hour
    # lag_24h = 0.95 * today (approximate yesterday's load)
    # lag_168h = 0.97 * today (approximate last week's load)
    lag_scale_24h  = 0.95
    lag_scale_168h = 0.97

    sequence = []
    for h in range(24):
        hour_sin, hour_cos   = _sin_cos(h, 24)
        dow = 3  # Thursday — a typical weekday
        dow_sin, dow_cos     = _sin_cos(dow, 7)
        month = 6  # June
        mon_sin, mon_cos     = _sin_cos(month, 12)

        lag_1h   = energy[h - 1] if h > 0 else energy[-1]
        lag_24h  = round(energy[h] * lag_scale_24h, 2)
        lag_168h = round(energy[h] * lag_scale_168h, 2)

        record = {
            "hour": h,
            # Weather features
            "temperature":    temps[h],
            "humidity":       rh[h],
            "solar_radiation": solar[h],
            "wind_speed":     wind[h],
            # Circular time encodings
            "hour_sin":          hour_sin,
            "hour_cos":          hour_cos,
            "day_of_week_sin":   dow_sin,
            "day_of_week_cos":   dow_cos,
            "month_sin":         mon_sin,
            "month_cos":         mon_cos,
            # Calendar flags
            "is_holiday": 0,
            "is_weekend":  0,
            # Lag features
            "lag_1h":    round(lag_1h, 2),
            "lag_24h":   lag_24h,
            "lag_168h":  lag_168h,
            # Target (actual energy for this demo)
            "energy_kwh": energy[h],
        }
        sequence.append(record)

    return sequence


def build_demo_json() -> dict:
    """Return the full demo payload including metadata and the 24-hour sequence."""
    sequence = generate_demo_sequence()
    return {
        "metadata": {
            "city": "Lahore",
            "season": "summer",
            "month": "June",
            "description": (
                "Realistic synthetic 24-hour input sequence for a hot Lahore summer day. "
                "Temperatures peak at 42 °C around 15:00. Energy demand follows a bimodal "
                "pattern with a morning cooking peak (~09:00) and a dominant evening peak "
                "driven by cooking, lighting, and cooling (~20:00)."
            ),
            "units": {
                "temperature": "°C",
                "humidity": "%",
                "solar_radiation": "W/m²",
                "wind_speed": "m/s",
                "energy_kwh": "kWh",
                "lag_1h": "kWh",
                "lag_24h": "kWh",
                "lag_168h": "kWh",
            },
            "feature_count": 15,
            "timesteps": 24,
        },
        "sequence": sequence,
        # Flat feature matrix shape [24, 15] for direct model input
        "feature_matrix": [
            [
                row["temperature"],
                row["humidity"],
                row["solar_radiation"],
                row["wind_speed"],
                row["hour_sin"],
                row["hour_cos"],
                row["day_of_week_sin"],
                row["day_of_week_cos"],
                row["month_sin"],
                row["month_cos"],
                float(row["is_holiday"]),
                float(row["is_weekend"]),
                row["lag_1h"],
                row["lag_24h"],
                row["lag_168h"],
            ]
            for row in sequence
        ],
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(backend_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    output_path = os.path.join(data_dir, "demo_sequence.json")
    payload = build_demo_json()

    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

    n_docs = len(payload["sequence"])
    print(f"Demo sequence written to {output_path}  ({n_docs} hourly records)")

    # Print a quick summary table
    print(f"\n{'Hour':>4}  {'Temp(°C)':>8}  {'RH(%)':>6}  {'Solar(W/m²)':>11}  {'Energy(kWh)':>11}")
    print("-" * 50)
    for row in payload["sequence"]:
        print(
            f"{row['hour']:>4}  {row['temperature']:>8.1f}  "
            f"{row['humidity']:>6.1f}  {row['solar_radiation']:>11.1f}  "
            f"{row['energy_kwh']:>11.1f}"
        )


if __name__ == "__main__":
    main()
