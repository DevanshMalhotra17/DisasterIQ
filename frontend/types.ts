export interface DiseaseRisk {
    disease: string;
    risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    confidence: number;
    r0: number;
    peak_infected: number;
    total_infected: number;
}

export interface PredictResponse {
    lat: number;
    lon: number;
    timestamp: string;
    climate_summary: {
        temp_c: number;
        humidity_pct: number;
        rain_1h_mm: number;
        weather_main: string;
        forecast_max_rain_mm: number;
    };
    risks: DiseaseRisk[];
    usgs_flood_detected: boolean;
    days_since_heavy_rain: number;
}