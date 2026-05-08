"""
tips_engine.py — Generate actionable energy-saving tips from SHAP feature importances.
No external API needed — rule-based + template system.
"""

TIPS_LIBRARY = {
    "temperature": [
        "Temperature is your top demand driver. Set AC to 26°C instead of 22°C — each degree saves ~8% energy.",
        "Pre-cool your home before 2PM when electricity rates are lower and solar generation is at peak.",
        "Use ceiling fans with AC — allows 4°C higher thermostat setting with same comfort.",
    ],
    "solar_radiation": [
        "High solar radiation means rooftop solar panels would significantly offset your peak demand.",
        "Avoid running heavy appliances during peak solar hours (11AM–3PM) if you're on time-of-use tariff.",
        "Solar radiation predicts AC load — install reflective window film to reduce solar heat gain.",
    ],
    "lag_1d": [
        "Your yesterday's consumption strongly predicts today — shift laundry and dishwashing to off-peak hours (10PM–6AM).",
        "Consistent high consumption pattern detected — consider a smart energy monitor.",
    ],
    "rolling_mean_7d": [
        "Your 7-day average is high — audit your always-on devices (routers, TVs on standby).",
        "Weekly patterns suggest weekend spikes — stagger high-load activities.",
    ],
    "hour_of_day": [
        "Peak demand occurs 7–10 PM in Pakistani households. Delay heavy loads (washing machine, iron) to after 10 PM.",
        "Early morning (5–7 AM) is lowest tariff window — schedule water heater and EV charging here.",
    ],
    "humidity": [
        "High humidity increases AC compressor load. Use dehumidifier mode to reduce energy 15–20%.",
        "Cross-ventilation in the evening reduces humidity and cuts AC runtime.",
    ],
    "lag_7d": [
        "Last week's pattern is repeating — if last week was high, today likely is too. Plan ahead.",
    ],
    "day_of_week": [
        "Weekend consumption is typically 20% higher. Consolidate chores to reduce peak load.",
    ],
    "uv_index": [
        "High UV index means high solar gain through windows — use blackout curtains during 12–4 PM.",
    ],
    "month": [
        "Summer months (Jun–Aug) see 40% higher demand in Lahore. Schedule appliance upgrades in winter.",
    ],
}


def generate_tips(
    feature_importances: list[dict],
    city: str = "Lahore",
    top_n: int = 3,
) -> list[dict]:
    """
    Given feature_importances = [{"feature": str, "importance": float}, ...]
    Returns top_n actionable tips with source feature and priority.
    """
    tips: list[dict] = []
    seen: set[str] = set()

    for fi in feature_importances[:top_n]:
        feat = fi["feature"].lower().replace(" ", "_")
        if feat in TIPS_LIBRARY:
            for tip_text in TIPS_LIBRARY[feat]:
                if tip_text not in seen:
                    seen.add(tip_text)
                    tips.append(
                        {
                            "tip": tip_text,
                            "feature": fi["feature"],
                            "importance": fi["importance"],
                            "priority": (
                                "high"
                                if fi["importance"] > 0.25
                                else "medium"
                                if fi["importance"] > 0.1
                                else "low"
                            ),
                            "icon": _get_icon(feat),
                        }
                    )
                    break  # one tip per feature

    if not tips:
        tips = [
            {
                "tip": "Shift high-load appliances (washing machine, iron) to after 10 PM.",
                "feature": "hour_of_day",
                "importance": 0.165,
                "priority": "high",
                "icon": "clock",
            },
            {
                "tip": "Set AC thermostat to 26°C — each degree lower increases consumption by 8%.",
                "feature": "Temperature",
                "importance": 0.312,
                "priority": "high",
                "icon": "thermometer",
            },
            {
                "tip": "Use natural ventilation in the evenings to reduce AC runtime.",
                "feature": "Humidity",
                "importance": 0.143,
                "priority": "medium",
                "icon": "wind",
            },
        ]

    return tips[:top_n]


def _get_icon(feature: str) -> str:
    icons = {
        "temperature": "thermometer",
        "solar_radiation": "sun",
        "lag_1d": "clock",
        "rolling_mean_7d": "trending-up",
        "hour_of_day": "clock",
        "humidity": "droplets",
        "lag_7d": "calendar",
        "day_of_week": "calendar",
        "uv_index": "sun",
        "month": "calendar",
    }
    return icons.get(feature, "zap")
