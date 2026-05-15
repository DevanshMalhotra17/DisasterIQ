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
    title="DisasterIQ API",
    description="Real-time flood-to-disease risk prediction using SEIR + XGBoost. "
                "Powered by OpenWeatherMap, USGS flood gauges, and Open-Meteo.",
    version="2.0.0",
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
    print(f"✓ DisasterIQ API ready — {len(models)} XGBoost models loaded")


# Request / Response models

class PredictRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")


class DiseaseRisk(BaseModel):
    disease: str
    risk_level: str  # LOW / MODERATE / HIGH / CRITICAL
    confidence: float
    r0: float
    peak_infected: int
    total_infected: int


class PredictResponse(BaseModel):
    lat: float
    lon: float
    timestamp: str
    climate_summary: dict
    risks: list[DiseaseRisk]
    usgs_flood_detected: bool
    days_since_heavy_rain: int


class AlertSubscribeRequest(BaseModel):
    phone: str = Field(..., description="Phone number with country code, e.g. +15550001234")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    threshold: str = Field("HIGH", description="Minimum risk level to trigger: MODERATE | HIGH | CRITICAL")


class AlertSubscribeResponse(BaseModel):
    status: str
    message: str
    phone: str
    lat: float
    lon: float
    threshold: str


# Core prediction logic

LABEL_MAP = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "CRITICAL"}


def run_prediction(climate: dict) -> PredictResponse:
    features = engineer_features(climate)
    vec = features.to_vector().reshape(1, -1)

    risks = []
    for disease in DISEASES:
        clf = models[disease]
        label_idx = int(clf.predict(vec)[0])
        proba = clf.predict_proba(vec)[0]
        confidence = float(proba[label_idx])

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
            "temp_c": climate.get("temp_c"),
            "humidity_pct": climate.get("humidity_pct"),
            "rain_1h_mm": climate.get("rain_1h_mm"),
            "weather_main": climate.get("weather_main"),
            "forecast_max_rain_mm": climate.get("forecast_max_rain_mm"),
        },
        risks=risks,
        usgs_flood_detected=bool(climate.get("usgs_flood_detected", False)),
        days_since_heavy_rain=int(climate.get("days_since_heavy_rain", 999)),
    )


# Endpoints

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "app": "DisasterIQ",
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
            detail=f"Unknown scenario '{name}'. Valid: {list(MOCK_SCENARIOS.keys())}",
        )
    climate = get_mock_climate_inputs(name)
    return run_prediction(climate)


@app.get("/scenarios")
async def list_scenarios():
    """List available mock scenarios."""
    return {"scenarios": list(MOCK_SCENARIOS.keys())}


@app.post("/alerts/subscribe", response_model=AlertSubscribeResponse)
async def subscribe_alert(req: AlertSubscribeRequest):
    """
    Subscribe a phone number to SMS alerts for a location.
    When risk at lat/lon reaches `threshold`, an SMS is sent via Twilio.

    Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
    Without Twilio credentials the endpoint still succeeds (demo mode).
    """
    valid_thresholds = {"MODERATE", "HIGH", "CRITICAL"}
    if req.threshold not in valid_thresholds:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid threshold '{req.threshold}'. Must be one of: {valid_thresholds}",
        )

    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_FROM_NUMBER")

    if twilio_sid and twilio_token and twilio_from:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            client.messages.create(
                body=(
                    f"DisasterIQ alert set!\n"
                    f"Location: {req.lat:.3f}°, {req.lon:.3f}°\n"
                    f"You'll be notified when risk reaches {req.threshold}.\n"
                    f"Reply STOP to unsubscribe."
                ),
                from_=twilio_from,
                to=req.phone,
            )
            return AlertSubscribeResponse(
                status="ok",
                message="Confirmation SMS sent via Twilio.",
                phone=req.phone,
                lat=req.lat,
                lon=req.lon,
                threshold=req.threshold,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Twilio error: {e}")

    # Demo mode — no Twilio credentials configured
    return AlertSubscribeResponse(
        status="demo",
        message="Alert registered (demo mode — add Twilio credentials to send real SMS).",
        phone=req.phone,
        lat=req.lat,
        lon=req.lon,
        threshold=req.threshold,
    )