"""Weather tool for the advisory RAG pipeline.

Uses Open-Meteo API (free, no API key required) to fetch current weather
and forecast data for a given location in Kenya.

The agent calls this tool to tie advisory responses with the farmer's
local climatic conditions.

Usage:
    from engines.weather import get_weather
    result = get_weather(location="Nakuru")
"""

from typing import Any
from langchain_core.tools import tool

# Kenyan towns with known lat/lon
KENYA_TOWNS: dict[str, tuple[float, float]] = {
    "nairobi": (-1.286389, 36.817223),
    "nakuru": (-0.303099, 36.080026),
    "eldoret": (0.514277, 35.269779),
    "kisumu": (-0.102212, 34.761711),
    "mombasa": (-4.043477, 39.668205),
    "kitale": (1.015724, 35.002181),
    "nyeri": (-0.416944, 36.951111),
    "meru": (0.050000, 37.650000),
    "naivasha": (-0.717619, 36.431007),
    "thika": (-1.038279, 37.069418),
    "machakos": (-1.517667, 37.263414),
    "malindi": (-3.220000, 40.120000),
    "laisamis": (1.583333, 37.833333),
    "marsabit": (2.333333, 37.983333),
    "garissa": (-0.455000, 39.640000),
    "kakamega": (0.282731, 34.751863),
    "baringo": (0.600000, 35.750000),
    "nanyuki": (0.016667, 37.066667),
    "nanyuki": (0.016667, 37.066667),
    "kericho": (-0.366667, 35.283333),
    "homa bay": (-0.527336, 34.457150),
    "busia": (0.460000, 34.110000),
    "kiambu": (-1.171389, 36.827778),
    "muranga": (-0.716667, 37.150000),
    "embu": (-0.533333, 37.450000),
    "makueni": (-1.800000, 37.616667),
    "kitui": (-1.366667, 37.983333),
    "taita taveta": (-3.400000, 38.583333),
    "kwale": (-4.166667, 39.450000),
    "lamu": (-2.269444, 40.900000),
    "isiolo": (0.350000, 37.583333),
    "wajir": (1.750000, 40.066667),
    "mandera": (3.916667, 41.866667),
    "turkana": (3.150000, 35.600000),
    "west pokot": (1.500000, 35.000000),
    "samburu": (1.000000, 37.000000),
    "trans nzoia": (1.000000, 35.000000),
    "uasin gishu": (0.514277, 35.269779),
    "elgeyo marakwet": (0.800000, 35.500000),
    "nandi": (0.100000, 35.100000),
    "bomet": (-0.783333, 35.350000),
    "nyamira": (-0.566667, 34.933333),
    "migori": (-1.066667, 34.466667),
    "siaya": (0.100000, 34.300000),
    "vihiga": (0.050000, 34.700000),
    "kilifi": (-3.633333, 39.850000),
    "tana river": (-2.000000, 40.000000),
    "nairobi": (-1.286389, 36.817223),
}

# Precipitation thresholds (mm) for advice categories
RAIN_LIGHT = 2.0
RAIN_MODERATE = 10.0
RAIN_HEAVY = 30.0

# Temperature thresholds (°C)
TEMP_HEAT_WARN = 32.0
TEMP_COLD_WARN = 10.0


def _geocode_location(location: str) -> tuple[float, float] | None:
    """Resolve location name to (lat, lon). First checks Kenya towns dict,
    then falls back to geopy Nominatim."""
    key = location.strip().lower()
    if key in KENYA_TOWNS:
        return KENYA_TOWNS[key]

    # Try geopy as fallback
    try:
        from geopy.geocoders import Nominatim
        from geopy.extra.rate_limiter import RateLimiter

        geolocator = Nominatim(user_agent="sokosense-advisory")
        geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1)
        loc = geocode(f"{location}, Kenya")
        if loc:
            return (loc.latitude, loc.longitude)
    except Exception:
        pass
    return None


def _fetch_weather(lat: float, lon: float) -> dict[str, Any]:
    """Fetch current weather + 3-day forecast from Open-Meteo (no API key)."""
    import httpx

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "weather_code",
        ],
        "timezone": "Africa/Nairobi",
        "forecast_days": 3,
    }

    try:
        resp = httpx.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
    except Exception as exc:
        return {
            "error": f"Weather API request failed: {exc}",
            "location": {"lat": lat, "lon": lon},
        }

    current = data.get("current", {})
    daily = data.get("daily", {})

    # Map WMO weather codes to human-readable conditions
    wmo_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }

    def code_to_text(code: int | None) -> str:
        if code is None:
            return "Unknown"
        return wmo_codes.get(code, f"Code {code}")

    result: dict[str, Any] = {
        "location": {"lat": lat, "lon": lon},
        "current": {
            "temperature_c": current.get("temperature_2m"),
            "apparent_temperature_c": current.get("apparent_temperature"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "precipitation_mm": current.get("precipitation"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "condition": code_to_text(current.get("weather_code")),
        },
        "forecast": [],
    }

    if daily.get("time"):
        for i in range(len(daily["time"])):
            day = {
                "date": daily["time"][i],
                "temp_max_c": daily["temperature_2m_max"][i],
                "temp_min_c": daily["temperature_2m_min"][i],
                "precipitation_mm": daily["precipitation_sum"][i],
                "precip_probability_pct": daily["precipitation_probability_max"][i],
                "condition": code_to_text(daily["weather_code"][i]),
            }
            result["forecast"].append(day)

    return result


def _weatheradvice(weather: dict[str, Any]) -> str:
    """Generate farming-relevant advice from weather data."""
    advice_parts = []

    current = weather.get("current", {})
    forecast = weather.get("forecast", [])

    # Current conditions
    temp = current.get("temperature_c")
    precip = current.get("precipitation_mm", 0) or 0
    humidity = current.get("humidity_pct")

    if temp is not None:
        if temp >= TEMP_HEAT_WARN:
            advice_parts.append(
                f" Heat warning: {temp}°C — irrigate crops in the evening, "
                "apply mulch to retain soil moisture, and provide shade for seedlings."
            )
        elif temp <= TEMP_COLD_WARN:
            advice_parts.append(
                f" Cold: {temp}°C — delay planting for temperature-sensitive crops; "
                "use polythene covers for seedlings at night."
            )
        else:
            advice_parts.append(
                f" Temperature at {temp}°C — favourable for most farming activities."
            )

    if precip > 0:
        if precip >= RAIN_HEAVY:
            advice_parts.append(
                f" Heavy precipitation ({precip}mm currently) — avoid applying "
                "fertiliser or pesticides; ensure drainage channels are clear."
            )
        elif precip >= RAIN_MODERATE:
            advice_parts.append(
                f" Moderate rain ({precip}mm) — good soil moisture; "
                "top-dress if you haven't recently."
            )
        elif precip >= RAIN_LIGHT:
            advice_parts.append(
                f" Light precipitation ({precip}mm) — light irrigation still recommended."
            )
    else:
        advice_parts.append(
            " No current precipitation — good for harvesting, spraying, "
            "and field preparation."
        )

    if humidity is not None:
        if humidity > 80:
            advice_parts.append(
                " High humidity (>80%) — monitor for fungal diseases; "
                "consider preventive fungicide spray (e.g. Mancozeb) for susceptible crops."
            )
        elif humidity < 30:
            advice_parts.append(
                " Low humidity (<30%) — increase irrigation frequency; "
                "watch for aphid infestations."
            )

    # Forecast summary
    if forecast:
        rain_days = [d for d in forecast if (d.get("precipitation_mm") or 0) > 2.0]

        if rain_days:
            total_rain = sum(d.get("precipitation_mm", 0) or 0 for d in rain_days)
            days_str = ", ".join(d["date"] for d in rain_days)
            advice_parts.append(
                f" Forecast: {len(rain_days)} day(s) of rain expected "
                f"({days_str}, ~{total_rain:.0f}mm total). "
                "Plan field activities around dry windows."
            )
        else:
            advice_parts.append(
                " Forecast: No significant rain expected in the next 3 days — "
                "ideal for planting, spraying, and harvesting."
            )

    if not advice_parts:
        return "No specific weather advice available for this location."

    return "\n\n".join(advice_parts)


@tool
def get_farmer_weather(location: str) -> str:
    """Fetch current weather + 3-day forecast for a Kenyan location and
    return farming-relevant advice based on conditions.

    Call this whenever the user mentions a location or asks about weather,
    spraying conditions, planting timing, or disease risk related to climate.

    Args:
        location: Town or county name in Kenya (e.g. 'Nakuru', 'Meru', 'Nairobi').
    """
    coords = _geocode_location(location)
    if coords is None:
        return (
            f" Could not resolve location '{location}'. "
            f"Please provide a known Kenyan town or county name."
        )

    lat, lon = coords
    weather_data = _fetch_weather(lat, lon)

    if "error" in weather_data:
        return weather_data["error"]

    # Format the output
    current = weather_data["current"]
    forecast = weather_data["forecast"]

    lines = [
        f" **Weather for {location.title()}**",
        f"   Current: {current.get('condition', 'N/A')}",
        f"   Temperature: {current.get('temperature_c', 'N/A')}°C "
        f"(feels like {current.get('apparent_temperature_c', 'N/A')}°C)",
        f"   Humidity: {current.get('humidity_pct', 'N/A')}%",
        f"   Wind: {current.get('wind_speed_kmh', 'N/A')} km/h",
        f"   Precipitation now: {current.get('precipitation_mm', 0)} mm",
        "",
        " **3-Day Forecast:**",
    ]

    for day in forecast:
        lines.append(
            f"   {day['date']}: {day['condition']} | "
            f"{day['temp_min_c']}–{day['temp_max_c']}°C | "
            f"Rain: {day['precipitation_mm']}mm ({day['precip_probability_pct']}%)"
        )

    lines.append("")
    lines.append(" **Farming Advice:**")
    lines.append(_weatheradvice(weather_data))

    return "\n".join(lines)
