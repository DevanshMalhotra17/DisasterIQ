MOCK_SCENARIOS = {
    # Houston during Hurricane Harvey (Aug 2017)
    "houston_harvey": {
        "lat": 29.7604,
        "lon": -95.3698,
        "timestamp": "2017-08-27T12:00:00",
        "temp_c": 29.4,
        "temp_feels_like": 35.2,
        "humidity_pct": 97,
        "pressure_hpa": 979,
        "wind_speed_ms": 18.5,
        "weather_id": 502,
        "weather_main": "Rain",
        "rain_1h_mm": 62.3,
        "rain_3h_mm": 187.0,
        "visibility_m": 400,
        "forecast_max_rain_mm": 250.0,
        "forecast_avg_temp_c": 28.9,
        "forecast_max_precip_prob": 1.0,
        "days_since_heavy_rain": 0,
        "firms_event_count": 3,
    },

    # Chennai floods (Dec 2015)
    "chennai_floods": {
        "lat": 13.0827,
        "lon": 80.2707,
        "timestamp": "2015-12-02T08:00:00",
        "temp_c": 26.1,
        "temp_feels_like": 31.0,
        "humidity_pct": 95,
        "pressure_hpa": 1005,
        "wind_speed_ms": 7.2,
        "weather_id": 501,
        "weather_main": "Rain",
        "rain_1h_mm": 45.0,
        "rain_3h_mm": 120.0,
        "visibility_m": 800,
        "forecast_max_rain_mm": 180.0,
        "forecast_avg_temp_c": 27.0,
        "forecast_max_precip_prob": 0.95,
        "days_since_heavy_rain": 1,
        "firms_event_count": 1,
    },

    # Normal day — low risk baseline
    "normal_baseline": {
        "lat": 40.7128,
        "lon": -74.0060,
        "timestamp": "2024-06-15T12:00:00",
        "temp_c": 22.0,
        "temp_feels_like": 22.5,
        "humidity_pct": 55,
        "pressure_hpa": 1015,
        "wind_speed_ms": 3.1,
        "weather_id": 800,
        "weather_main": "Clear",
        "rain_1h_mm": 0.0,
        "rain_3h_mm": 0.0,
        "visibility_m": 10000,
        "forecast_max_rain_mm": 2.0,
        "forecast_avg_temp_c": 21.5,
        "forecast_max_precip_prob": 0.1,
        "days_since_heavy_rain": 14,
        "firms_event_count": 0,
    },
}


def get_mock_climate_inputs(scenario: str = "houston_harvey") -> dict:
    if scenario not in MOCK_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Choose from: {list(MOCK_SCENARIOS.keys())}")
    return MOCK_SCENARIOS[scenario].copy()


if __name__ == "__main__":
    for name, data in MOCK_SCENARIOS.items():
        print(f"\n--- {name} ---")
        for k, v in data.items():
            print(f"  {k}: {v}")