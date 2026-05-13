import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import xgboost as xgb
import numpy as np

from ml.data_ingestion import fetch_all_climate_inputs, get_mock_climate_inputs, MOCK_SCENARIOS
from ml.features import engineer_features
from ml.seir import run_seir

app = FastAPI(
    title="Pathogen Risk API",
    description="Real-time flood-to-disease risk prediction using SEIR + XGBoost",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DISEASES = ["cholera", "dengue", "malaria", "leptospirosis", "salmonella"]
MODELS_DIR = Path(__file__).parent.parent / "ml" / "models"

def load_models() -> dict[str, xgb.XGBClassifier]:
    models = {}
    for disease in DISEASES:
        path = MODELS_DIR / f"xgb_{disease}.json"
        if not path.exists():
            raise FileNotFoundError(f"Model not found: {path}. Run ml/train.py first.")
        clf = xgb.XGBClassifier()
        clf.load_model(str(path))
        models[disease] = clf
    return models

models: dict[str, xgb.XGBClassifier] = {}

@app.on_event("startup")
async def startup_event():
    global models
    models = load_models()
    print(f"✓ Loaded {len(models)} XGBoost models")

class PredictRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90,  description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")

class DiseaseRisk(BaseModel):
    disease:    str
    risk_level: str   # LOW / MODERATE / HIGH / CRITICAL
    confidence: float
    r0:         float
    peak_infected: int
    total_infected: int

class PredictResponse(BaseModel):
    lat:       float
    lon:       float
    timestamp: str
    climate_summary: dict
    risks: list[DiseaseRisk]
    usgs_flood_detected: bool
    days_since_heavy_rain: int

LABEL_MAP = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "CRITICAL"}

def run_prediction(climate: dict) -> PredictResponse:
    # Feature engineering
    features = engineer_features(climate)
    vec = features.to_vector().reshape(1, -1)

    risks = []
    for disease in DISEASES:
        clf = models[disease]
        label_idx = int(clf.predict(vec)[0])
        proba     = clf.predict_proba(vec)[0]
        confidence = float(proba[label_idx])

        # SEIR simulation for this disease
        seir_result = run_seir(disease, features, population=500_000, days=90)

        risks.append(DiseaseRisk(
            disease=disease,
            risk_level=LABEL_MAP[label_idx],
            confidence=round(confidence * 100, 1),
            r0=round(seir_result.r0, 2),
            peak_infected=int(seir_result.peak_infected),
            total_infected=int(seir_result.total_infected),
        ))

    return PredictResponse(
        lat=climate["lat"],
        lon=climate["lon"],
        timestamp=climate["timestamp"],
        climate_summary={
            "temp_c":           climate.get("temp_c"),
            "humidity_pct":     climate.get("humidity_pct"),
            "rain_1h_mm":       climate.get("rain_1h_mm"),
            "weather_main":     climate.get("weather_main"),
            "forecast_max_rain_mm": climate.get("forecast_max_rain_mm"),
        },
        risks=risks,
        usgs_flood_detected=bool(climate.get("usgs_flood_detected", False)),
        days_since_heavy_rain=int(climate.get("days_since_heavy_rain", 999)),
    )

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": list(models.keys()),
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """
    Fetch live weather + flood data for a lat/lon and return
    disease risk predictions for all 5 pathogens.
    """
    try:
        climate = fetch_all_climate_inputs(req.lat, req.lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data ingestion failed: {e}")

    return run_prediction(climate)


@app.get("/predict/scenario/{name}", response_model=PredictResponse)
async def predict_scenario(name: str):
    """
    Run prediction against a named mock scenario.
    Valid names: houston_harvey, chennai_floods, normal_baseline
    """
    if name not in MOCK_SCENARIOS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown scenario '{name}'. Valid: {list(MOCK_SCENARIOS.keys())}"
        )
    climate = get_mock_climate_inputs(name)
    return run_prediction(climate)


@app.get("/scenarios")
async def list_scenarios():
    """List available mock scenarios."""
    return {"scenarios": list(MOCK_SCENARIOS.keys())}