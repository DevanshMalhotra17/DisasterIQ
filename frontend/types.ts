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

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export const RISK_ORDER: RiskLevel[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export const RISK_COLOR: Record<RiskLevel, string> = {
    LOW: "#5f6b7a",
    MODERATE: "#1d9e75",
    HIGH: "#ef9f27",
    CRITICAL: "#e24b4a",
};

export const RISK_BG: Record<RiskLevel, string> = {
    LOW: "rgba(95,107,122,0.12)",
    MODERATE: "rgba(29,158,117,0.12)",
    HIGH: "rgba(239,159,39,0.12)",
    CRITICAL: "rgba(226,75,74,0.12)",
};

export const RISK_BORDER: Record<RiskLevel, string> = {
    LOW: "rgba(95,107,122,0.25)",
    MODERATE: "rgba(29,158,117,0.3)",
    HIGH: "rgba(239,159,39,0.3)",
    CRITICAL: "rgba(226,75,74,0.35)",
};

export function worstRisk(risks: DiseaseRisk[]): RiskLevel {
    return risks.reduce<RiskLevel>((max, r) => {
        return RISK_ORDER.indexOf(r.risk_level as RiskLevel) >
            RISK_ORDER.indexOf(max)
            ? (r.risk_level as RiskLevel)
            : max;
    }, "LOW");
}