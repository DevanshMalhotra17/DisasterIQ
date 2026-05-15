# DisasterIQ

**Real-time disaster & disease outbreak risk intelligence**

DisasterIQ predicts post-disaster disease outbreak risk for any location on Earth. Click anywhere on the map — it fetches live weather, USGS flood gauge readings, and historical precipitation data, then runs a SEIR epidemiological model combined with XGBoost classifiers to predict outbreak risk for 5 diseases in real time.

---

## How it works

```
Click on map
    → Fetch live data (OWM + Open-Meteo + USGS)
    → Engineer 15 epidemiological features
    → Run SEIR simulation per disease
    → XGBoost classifies risk level (LOW → CRITICAL)
    → Return R₀, peak infected, total infected
```

### Data sources
| Source | What we use |
|--------|-------------|
| OpenWeatherMap | Live temperature, humidity, rainfall, weather conditions |
| Open-Meteo | Historical daily precipitation (5-day lookback, free, no key) |
| USGS Water Services | 146+ active river gauge readings for real flood detection |

### ML pipeline
- **4,090 training samples** generated via SEIR simulation across 11 global locations
- **5 XGBoost classifiers** (one per disease), each predicting LOW / MODERATE / HIGH / CRITICAL
- **15 engineered features** including flood risk index, humidity-temperature interaction, days since heavy rain
- **SEIR model** (Susceptible → Exposed → Infected → Recovered) for epidemiological simulation with disease-specific R₀ parameters

### Model performance
| Disease | Accuracy | AUC |
|---------|----------|-----|
| Cholera | 97.7% | 0.998 |
| Dengue | 96.9% | 0.999 |
| Malaria | 96.9% | 0.998 |
| Leptospirosis | 96.0% | 0.997 |
| Salmonella | 97.8% | 0.998 |

### Scenario validation (15/15 correct)
Validated against documented historical outbreaks:

| Scenario | Leptospirosis | Cholera | Malaria |
|----------|--------------|---------|---------|
| Hurricane Harvey (Houston, 2017) | CRITICAL | HIGH | HIGH |
| Chennai Floods (India, 2015) | HIGH | HIGH | CRITICAL |
| Normal baseline | LOW | LOW | HIGH |

---

## Stack

**Frontend**
- Next.js 14 (App Router)
- Leaflet + React-Leaflet (map)
- Recharts (SEIR curves)
- Tailwind CSS

**Backend**
- FastAPI
- XGBoost
- NumPy / Pandas / SciPy
- Loguru

**APIs**
- OpenWeatherMap (current weather + 5-day forecast)
- Open-Meteo (historical precipitation archive)
- USGS Water Services (live flood gauges)
- Twilio (SMS alerts)

**Deployment**
- Frontend: Vercel
- Backend: Railway

---

## Project structure

```
DisasterIQ/
├── backend/
│   ├── main.py           # FastAPI app — /predict, /alerts/subscribe
│   └── __init__.py
├── frontend/
│   ├── app/
│   │   ├── page.tsx      # Main map + panel layout
│   │   ├── layout.tsx    # Metadata, fonts
│   │   └── globals.css   # Design tokens
│   ├── components/
│   │   ├── Map.tsx       # Leaflet map with risk hotspot markers
│   │   ├── RiskPanel.tsx # Sidebar with metrics + disease cards
│   │   └── AlertModal.tsx# SMS alert subscription
│   └── types.ts          # Shared types + risk color helpers
├── ml/
│   ├── data_ingestion.py # OWM + Open-Meteo + USGS fetchers
│   ├── features.py       # Feature engineering (15 features)
│   ├── seir.py           # SEIR epidemiological model
│   ├── train.py          # XGBoost training pipeline
│   ├── evaluate.py       # Model evaluation + bootstrap CI
│   └── models/           # Trained XGBoost model weights
├── requirements.txt
└── railway.json
```

---

## Running locally

**Prerequisites:** Python 3.11+, Node.js 18+

```bash
# Clone
git clone https://github.com/DevanshMalhotra17/Pathogen
cd Pathogen

# Backend
pip install -r requirements.txt
cp .env.example .env   # add your API keys
uvicorn backend.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment variables

```env
OPENWEATHERMAP_API_KEY=your_key   # openweathermap.org
TWILIO_ACCOUNT_SID=               # optional — for SMS alerts
TWILIO_AUTH_TOKEN=                # optional
TWILIO_FROM_NUMBER=               # optional
```

---

## API

Interactive docs at `/docs` on the running backend.

```
GET  /health                        # Status + loaded models
POST /predict                       # { lat, lon } → risk predictions
GET  /predict/scenario/{name}       # houston_harvey | chennai_floods | normal_baseline
GET  /scenarios                     # List available scenarios
POST /alerts/subscribe              # Subscribe phone to SMS alerts
```

**Example request:**
```bash
curl -X POST https://pathogen-production-354d.up.railway.app/predict \
  -H "Content-Type: application/json" \
  -d '{"lat": 29.7604, "lon": -95.3698}'
```

**Example response (Houston, TX):**
```json
{
  "lat": 29.7604,
  "lon": -95.3698,
  "usgs_flood_detected": true,
  "days_since_heavy_rain": 3,
  "risks": [
    {
      "disease": "leptospirosis",
      "risk_level": "CRITICAL",
      "confidence": 99.3,
      "r0": 4.72,
      "peak_infected": 117840,
      "total_infected": 136032
    }
  ]
}
```

---

## Retrain the models

```bash
cd ml
python train.py      # generates ml/models/xgb_*.json
python evaluate.py   # generates ml/models/eval_results.json
```

---

Built for WeatherWise Hack 2026