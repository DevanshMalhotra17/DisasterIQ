import numpy as np
from dataclasses import dataclass, field
from typing import Dict

REGION_VULNERABILITY = {
    (30, -95): {"sanitation_index": 0.72, "pop_density": 1300, "water_body_dist_km": 2.1},
    (13, 80):  {"sanitation_index": 0.51, "pop_density": 26800, "water_body_dist_km": 0.8},
    (41, -74): {"sanitation_index": 0.94, "pop_density": 10200, "water_body_dist_km": 1.2},
}

DEFAULT_VULNERABILITY = {
    "sanitation_index": 0.50,
    "pop_density": 5000,
    "water_body_dist_km": 5.0,
}


def get_vulnerability(lat: float, lon: float) -> dict:
    key = (round(lat), round(lon))
    return REGION_VULNERABILITY.get(key, DEFAULT_VULNERABILITY)


def weather_id_to_flood_severity(weather_id: int) -> float:
    if 200 <= weather_id <= 232:   return 0.6
    elif 300 <= weather_id <= 321: return 0.1
    elif weather_id == 500:        return 0.2
    elif weather_id == 501:        return 0.4
    elif weather_id == 502:        return 0.7
    elif weather_id == 503:        return 0.85
    elif weather_id == 504:        return 1.0
    elif weather_id == 511:        return 0.3
    elif 520 <= weather_id <= 531: return 0.5
    elif 600 <= weather_id <= 622: return 0.1
    elif 900 <= weather_id <= 902: return 0.95
    else:                          return 0.0


@dataclass
class PathogenFeatures:
    flood_severity: float
    temp_normalized: float
    humidity_normalized: float
    rain_intensity: float
    days_since_rain_inv: float
    forecast_rain_risk: float
    sanitation_inv: float
    pop_density_normalized: float
    water_proximity: float
    active_disaster: float

    cholera_score: float = field(init=False)
    dengue_score: float = field(init=False)
    malaria_score: float = field(init=False)
    leptospirosis_score: float = field(init=False)
    salmonella_score: float = field(init=False)

    def __post_init__(self):
        self.cholera_score = self._cholera()
        self.dengue_score = self._dengue()
        self.malaria_score = self._malaria()
        self.leptospirosis_score = self._leptospirosis()
        self.salmonella_score = self._salmonella()

    def _cholera(self) -> float:
        return float(np.clip(
            0.35 * self.flood_severity +
            0.30 * self.sanitation_inv +
            0.20 * self.rain_intensity +
            0.10 * self.pop_density_normalized +
            0.05 * self.water_proximity,
            0.0, 1.0
        ))

    def _dengue(self) -> float:
        temp_in_range = max(0.0, 1.0 - abs(self.temp_normalized - 0.55) * 2)
        return float(np.clip(
            0.30 * temp_in_range +
            0.25 * self.humidity_normalized +
            0.25 * self.days_since_rain_inv +
            0.15 * self.flood_severity +
            0.05 * self.pop_density_normalized,
            0.0, 1.0
        ))

    def _malaria(self) -> float:
        temp_in_range = max(0.0, 1.0 - abs(self.temp_normalized - 0.48) * 2.5)
        humidity_factor = 1.0 if self.humidity_normalized > 0.6 else self.humidity_normalized
        return float(np.clip(
            0.30 * temp_in_range +
            0.25 * humidity_factor +
            0.25 * self.days_since_rain_inv +
            0.15 * self.water_proximity +
            0.05 * self.sanitation_inv,
            0.0, 1.0
        ))

    def _leptospirosis(self) -> float:
        return float(np.clip(
            0.40 * self.flood_severity +
            0.25 * self.water_proximity +
            0.20 * self.temp_normalized +
            0.10 * self.rain_intensity +
            0.05 * self.sanitation_inv,
            0.0, 1.0
        ))

    def _salmonella(self) -> float:
        return float(np.clip(
            0.40 * self.temp_normalized +
            0.30 * self.flood_severity +
            0.20 * self.sanitation_inv +
            0.10 * self.humidity_normalized,
            0.0, 1.0
        ))

    def to_dict(self) -> Dict[str, float]:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}

    def to_vector(self) -> np.ndarray:
        return np.array([
            self.flood_severity, self.temp_normalized, self.humidity_normalized,
            self.rain_intensity, self.days_since_rain_inv, self.forecast_rain_risk,
            self.sanitation_inv, self.pop_density_normalized,
            self.water_proximity, self.active_disaster,
        ])


def engineer_features(climate: dict) -> PathogenFeatures:
    vuln = get_vulnerability(climate["lat"], climate["lon"])

    weather_severity = weather_id_to_flood_severity(climate.get("weather_id", 800))
    rain_norm = min(climate.get("rain_3h_mm", 0.0) / 200.0, 1.0)
    flood_severity = float(np.clip((weather_severity * 0.5) + (rain_norm * 0.5), 0.0, 1.0))

    temp_normalized = float(np.clip(climate.get("temp_c", 20.0) / 50.0, 0.0, 1.0))
    humidity_normalized = climate.get("humidity_pct", 50) / 100.0
    rain_intensity = min(climate.get("rain_1h_mm", 0.0) / 100.0, 1.0)

    days_since = climate.get("days_since_heavy_rain", 999)
    days_since_rain_inv = float(np.clip(1.0 - (days_since / 30.0), 0.0, 1.0))

    forecast_rain_risk = float(np.clip(
        (min(climate.get("forecast_max_rain_mm", 0.0) / 200.0, 1.0) * 0.6) +
        (climate.get("forecast_max_precip_prob", 0.0) * 0.4),
        0.0, 1.0
    ))

    sanitation_inv = 1.0 - vuln["sanitation_index"]
    pop_density_normalized = min(vuln["pop_density"] / 30000.0, 1.0)
    water_proximity = float(np.clip(1.0 - (vuln["water_body_dist_km"] / 20.0), 0.0, 1.0))
    active_disaster = min(climate.get("firms_event_count", 0) / 10.0, 1.0)

    return PathogenFeatures(
        flood_severity=flood_severity,
        temp_normalized=temp_normalized,
        humidity_normalized=humidity_normalized,
        rain_intensity=rain_intensity,
        days_since_rain_inv=days_since_rain_inv,
        forecast_rain_risk=forecast_rain_risk,
        sanitation_inv=sanitation_inv,
        pop_density_normalized=pop_density_normalized,
        water_proximity=water_proximity,
        active_disaster=active_disaster,
    )


if __name__ == "__main__":
    from data_ingestion import get_mock_climate_inputs

    for scenario in ["houston_harvey", "chennai_floods", "normal_baseline"]:
        climate = get_mock_climate_inputs(scenario)
        f = engineer_features(climate)
        print(f"\n{'='*50}\nScenario: {scenario}\n{'='*50}")
        print(f"  flood_severity:      {f.flood_severity:.3f}")
        print(f"  temp_normalized:     {f.temp_normalized:.3f}")
        print(f"  humidity_normalized: {f.humidity_normalized:.3f}")
        print(f"  sanitation_inv:      {f.sanitation_inv:.3f}")
        print(f"Disease Risk Scores")
        print(f"  Cholera:        {f.cholera_score:.3f}")
        print(f"  Dengue:         {f.dengue_score:.3f}")
        print(f"  Malaria:        {f.malaria_score:.3f}")
        print(f"  Leptospirosis:  {f.leptospirosis_score:.3f}")
        print(f"  Salmonella:     {f.salmonella_score:.3f}")