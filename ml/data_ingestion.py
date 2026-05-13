import os
import requests
import pandas as pd
from datetime import datetime, timedelta, UTC
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from loguru import logger

load_dotenv()

OWM_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")
OWM_BASE    = "https://api.openweathermap.org/data/2.5"

MOCK_SCENARIOS = {
    "houston_harvey": {
        "lat": 29.7604, "lon": -95.3698,
        "timestamp": "2017-08-27T12:00:00",
        "temp_c": 29.4, "temp_feels_like": 35.2,
        "humidity_pct": 97, "pressure_hpa": 979, "wind_speed_ms": 18.5,
        "weather_id": 502, "weather_main": "Rain",
        "rain_1h_mm": 62.3, "rain_3h_mm": 187.0, "visibility_m": 400,
        "forecast_max_rain_mm": 250.0, "forecast_avg_temp_c": 28.9,
        "forecast_max_precip_prob": 1.0, "days_since_heavy_rain": 0,
        "usgs_gauge_count": 8, "usgs_max_gauge_ft": 42.3, "usgs_flood_detected": True,
    },
    "chennai_floods": {
        "lat": 13.0827, "lon": 80.2707,
        "timestamp": "2015-12-02T08:00:00",
        "temp_c": 26.1, "temp_feels_like": 31.0,
        "humidity_pct": 95, "pressure_hpa": 1005, "wind_speed_ms": 7.2,
        "weather_id": 501, "weather_main": "Rain",
        "rain_1h_mm": 45.0, "rain_3h_mm": 120.0, "visibility_m": 800,
        "forecast_max_rain_mm": 180.0, "forecast_avg_temp_c": 27.0,
        "forecast_max_precip_prob": 0.95, "days_since_heavy_rain": 1,
        "usgs_gauge_count": 0, "usgs_max_gauge_ft": 0.0, "usgs_flood_detected": False,
    },
    "normal_baseline": {
        "lat": 40.7128, "lon": -74.0060,
        "timestamp": "2024-06-15T12:00:00",
        "temp_c": 22.0, "temp_feels_like": 22.5,
        "humidity_pct": 55, "pressure_hpa": 1015, "wind_speed_ms": 3.1,
        "weather_id": 800, "weather_main": "Clear",
        "rain_1h_mm": 0.0, "rain_3h_mm": 0.0, "visibility_m": 10000,
        "forecast_max_rain_mm": 2.0, "forecast_avg_temp_c": 21.5,
        "forecast_max_precip_prob": 0.1, "days_since_heavy_rain": 14,
        "usgs_gauge_count": 2, "usgs_max_gauge_ft": 4.1, "usgs_flood_detected": False,
    },
}


def get_mock_climate_inputs(scenario: str = "houston_harvey") -> dict:
    if scenario not in MOCK_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Choose from: {list(MOCK_SCENARIOS.keys())}")
    return MOCK_SCENARIOS[scenario].copy()


def fetch_current_weather(lat: float, lon: float) -> dict:
    resp = requests.get(f"{OWM_BASE}/weather",
        params={"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric"}, timeout=10)
    resp.raise_for_status()
    raw = resp.json()
    return {
        "lat": lat, "lon": lon,
        "timestamp": datetime.now(UTC).isoformat(),
        "temp_c": raw["main"]["temp"],
        "temp_feels_like": raw["main"]["feels_like"],
        "humidity_pct": raw["main"]["humidity"],
        "pressure_hpa": raw["main"]["pressure"],
        "wind_speed_ms": raw["wind"]["speed"],
        "weather_id": raw["weather"][0]["id"],
        "weather_main": raw["weather"][0]["main"],
        "rain_1h_mm": raw.get("rain", {}).get("1h", 0.0),
        "rain_3h_mm": raw.get("rain", {}).get("3h", 0.0),
        "visibility_m": raw.get("visibility", 10000),
    }


def fetch_forecast(lat: float, lon: float, days: int = 5) -> pd.DataFrame:
    resp = requests.get(f"{OWM_BASE}/forecast",
        params={"lat": lat, "lon": lon, "appid": OWM_API_KEY, "units": "metric", "cnt": days * 8}, timeout=10)
    resp.raise_for_status()
    rows = []
    for entry in resp.json()["list"]:
        rows.append({
            "forecast_time": entry["dt_txt"],
            "temp_c": entry["main"]["temp"],
            "humidity_pct": entry["main"]["humidity"],
            "rain_3h_mm": entry.get("rain", {}).get("3h", 0.0),
            "weather_main": entry["weather"][0]["main"],
            "weather_id": entry["weather"][0]["id"],
            "pop": entry.get("pop", 0.0),
        })
    df = pd.DataFrame(rows)
    df["forecast_time"] = pd.to_datetime(df["forecast_time"])
    logger.info(f"Fetched {len(df)} forecast entries for ({lat}, {lon})")
    return df


def fetch_historical_rain(lat: float, lon: float, days_back: int = 5) -> pd.DataFrame:
    """Use Open-Meteo archive API — free, no key required."""
    end_date   = (datetime.now(UTC) - timedelta(days=1)).strftime("%Y-%m-%d")
    start_date = (datetime.now(UTC) - timedelta(days=days_back)).strftime("%Y-%m-%d")
    try:
        resp = requests.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat, "longitude": lon,
                "start_date": start_date, "end_date": end_date,
                "daily": "precipitation_sum",
                "timezone": "UTC",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        df = pd.DataFrame({
            "date": pd.to_datetime(data["daily"]["time"]).date,
            "rain_mm": data["daily"]["precipitation_sum"],
        })
        df["rain_mm"] = df["rain_mm"].fillna(0.0)
        logger.info(f"Open-Meteo: {len(df)} days of rain history for ({lat}, {lon})")
        return df
    except Exception as e:
        logger.warning(f"Open-Meteo historical rain failed: {e}")
        return pd.DataFrame(columns=["date", "rain_mm"])


def fetch_flood_data(lat: float, lon: float, radius_km: float = 100.0) -> dict:
    """USGS Water Services — real-time river gauge data, free, no key required."""
    try:
        delta = radius_km / 111.0
        resp = requests.get(
            "https://waterservices.usgs.gov/nwis/iv/",
            params={
                "format": "json",
                "bBox": f"{round(lon-delta,2)},{round(lat-delta,2)},{round(lon+delta,2)},{round(lat+delta,2)}",
                "parameterCd": "00065",  # gauge height in feet
                "siteStatus": "active",
            },
            timeout=30,
        )
        resp.raise_for_status()
        sites = resp.json().get("value", {}).get("timeSeries", [])
        flood_stages = []
        for site in sites:
            values = site.get("values", [{}])[0].get("value", [])
            if values:
                try:
                    flood_stages.append(float(values[-1]["value"]))
                except (ValueError, TypeError):
                    pass
        logger.info(f"USGS: {len(flood_stages)} active gauge readings near ({lat}, {lon})")
        return {
            "usgs_gauge_count":   len(flood_stages),
            "usgs_max_gauge_ft":  max(flood_stages) if flood_stages else 0.0,
            "usgs_flood_detected": any(g > 30.0 for g in flood_stages),
        }
    except Exception as e:
        logger.warning(f"USGS flood data failed: {e}")
        return {"usgs_gauge_count": 0, "usgs_max_gauge_ft": 0.0, "usgs_flood_detected": False}


def fetch_all_climate_inputs(lat: float, lon: float) -> dict:
    logger.info(f"Fetching all climate inputs for ({lat}, {lon})")
    current     = fetch_current_weather(lat, lon)
    forecast_df = fetch_forecast(lat, lon, days=5)
    hist_df     = fetch_historical_rain(lat, lon, days_back=5)
    flood       = fetch_flood_data(lat, lon)

    heavy = hist_df[hist_df["rain_mm"] > 20.0]
    days_since = (datetime.now(UTC).date() - heavy["date"].max()).days if not heavy.empty else 999

    return {
        **current,
        "forecast_max_rain_mm":     float(forecast_df["rain_3h_mm"].max()),
        "forecast_avg_temp_c":      float(forecast_df["temp_c"].mean()),
        "forecast_max_precip_prob": float(forecast_df["pop"].max()),
        "days_since_heavy_rain":    days_since,
        "usgs_gauge_count":         flood["usgs_gauge_count"],
        "usgs_max_gauge_ft":        flood["usgs_max_gauge_ft"],
        "usgs_flood_detected":      flood["usgs_flood_detected"],
    }


if __name__ == "__main__":
    result = fetch_all_climate_inputs(lat=29.7604, lon=-95.3698)
    for k, v in result.items():
        print(f"  {k}: {v}")