"use client";

import type { PredictResponse, DiseaseRisk, RiskLevel } from "@/types";
import { RISK_COLOR, RISK_BG, RISK_BORDER, RISK_ORDER, worstRisk } from "@/types";
import { useState } from "react";

const DISEASE_ICON: Record<string, string> = {
    cholera: "💧",
    dengue: "🦟",
    malaria: "🦟",
    leptospirosis: "🐭",
    salmonella: "🦠",
};

function RiskBadge({ level }: { level: RiskLevel }) {
    return (
        <span
            style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 20,
                fontWeight: 500,
                letterSpacing: "0.03em",
                background: RISK_BG[level],
                color: RISK_COLOR[level],
                border: `1px solid ${RISK_BORDER[level]}`,
            }}
        >
            {level}
        </span>
    );
}

function MetricCard({
    icon,
    label,
    value,
    sub,
}: {
    icon: string;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div
            style={{
                background: "var(--bg-elevated)",
                borderRadius: 10,
                padding: "10px 12px",
                border: "1px solid var(--border)",
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                }}
            >
                <span>{icon}</span> {label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>{value}</div>
            {sub && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

function DiseaseCard({ risk }: { risk: DiseaseRisk }) {
    const [expanded, setExpanded] = useState(false);
    const level = risk.risk_level as RiskLevel;
    const pct = (RISK_ORDER.indexOf(level) / 3) * 100;
    const confidencePct = ((RISK_ORDER.indexOf(level) + 1) / 4) * 100;

    return (
        <div
            onClick={() => setExpanded(!expanded)}
            style={{
                background: expanded ? RISK_BG[level] : "var(--bg-elevated)",
                border: `1px solid ${expanded ? RISK_BORDER[level] : "var(--border)"}`,
                borderRadius: 10,
                padding: "11px 14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>{DISEASE_ICON[risk.disease] ?? "🦠"}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", textTransform: "capitalize" }}>
                        {risk.disease}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RiskBadge level={level} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-mono)" }}>
                        {expanded ? "▲" : "▼"}
                    </span>
                </div>
            </div>

            {/* Confidence bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                    style={{
                        flex: 1,
                        height: 3,
                        background: "rgba(255,255,255,0.07)",
                        borderRadius: 2,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${confidencePct}%`,
                            background: RISK_COLOR[level],
                            borderRadius: 2,
                            transition: "width 0.5s ease",
                        }}
                    />
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "var(--font-mono)",
                        minWidth: 36,
                        textAlign: "right",
                    }}
                >
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)", minWidth: 60, textAlign: "right" }}>
                        {risk.confidence.toFixed(1)}% conf.
                    </span>
                </span>
            </div>

            {expanded && (
                <div
                    className="animate-fade-in"
                    style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: `1px solid ${RISK_BORDER[level]}`,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        textAlign: "center",
                    }}
                >
                    {[
                        { label: "R₀", value: risk.r0.toFixed(2) },
                        { label: "Peak infected", value: risk.peak_infected.toLocaleString() },
                        { label: "Total infected", value: risk.total_infected.toLocaleString() },
                    ].map((s) => (
                        <div key={s.label}>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "var(--font-mono)" }}>
                                {s.value}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface Props {
    prediction: PredictResponse | null;
    loading: boolean;
    coords: { lat: number; lon: number } | null;
    onSetAlert?: () => void;
}

export default function RiskPanel({ prediction, loading, coords, onSetAlert }: Props) {
    if (!coords && !loading) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    padding: "0 32px",
                    textAlign: "center",
                }}
            >
                <div style={{ fontSize: 40, marginBottom: 16 }}>🌍</div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
                    Click anywhere on the map
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
                    DisasterIQ fetches live weather, USGS flood gauges, and historical rain data, then runs
                    SEIR + XGBoost models to predict outbreak risk for 5 diseases.
                </p>
                <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                    {["Cholera", "Dengue", "Malaria", "Leptospirosis", "Salmonella"].map((d) => (
                        <div
                            key={d}
                            style={{
                                background: "var(--bg-elevated)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                padding: "10px 12px",
                                fontSize: 12,
                                color: "rgba(255,255,255,0.5)",
                                textAlign: "center",
                            }}
                        >
                            {DISEASE_ICON[d.toLowerCase()] ?? "🦠"} {d}
                        </div>
                    ))}
                </div>
                <p style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                    OWM · USGS · Open-Meteo · SEIR · XGBoost
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                <div
                    style={{
                        width: 40,
                        height: 40,
                        border: "3px solid var(--border-strong)",
                        borderTopColor: "var(--teal)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                    }}
                />
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>Analyzing risk factors…</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                        OWM · Open-Meteo · USGS
                    </div>
                </div>
                {coords && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-mono)" }}>
                        {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
                    </div>
                )}
            </div>
        );
    }

    if (!prediction) return null;

    const c = prediction.climate_summary;
    const worst = worstRisk(prediction.risks);
    const sorted = [...prediction.risks].sort(
        (a, b) =>
            RISK_ORDER.indexOf(b.risk_level as RiskLevel) -
            RISK_ORDER.indexOf(a.risk_level as RiskLevel)
    );

    return (
        <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Location header */}
            <div
                style={{
                    padding: "14px 16px 12px",
                    borderBottom: "1px solid var(--border)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>
                        📍 {prediction.lat.toFixed(3)}°, {prediction.lon.toFixed(3)}°
                    </span>
                    <RiskBadge level={worst} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {prediction.usgs_flood_detected && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(55,138,221,0.15)", color: "#85b7eb", border: "1px solid rgba(55,138,221,0.3)" }}>
                            🌊 Flood alert
                        </span>
                    )}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--bg-elevated)", color: "rgba(255,255,255,0.4)", border: "1px solid var(--border)" }}>
                        {prediction.days_since_heavy_rain === 999
                            ? "No recent heavy rain"
                            : `Heavy rain ${prediction.days_since_heavy_rain}d ago`}
                    </span>
                </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    <MetricCard icon="🌡️" label="Temperature" value={c?.temp_c != null ? `${c.temp_c.toFixed(1)}°C` : "N/A"} sub={c?.temp_c != null ? `Feels like ${c.temp_c.toFixed(0)}°` : undefined} />
                    <MetricCard icon="💧" label="Humidity" value={c?.humidity_pct != null ? `${c.humidity_pct}%` : "N/A"} sub={c?.weather_main ?? undefined} />
                    <MetricCard icon="🌊" label="USGS gauges" value={prediction.usgs_flood_detected ? "⚠️ Active" : "Active"} sub="Live flood monitoring" />
                    <MetricCard icon="🌧️" label="Rain history" value={prediction.days_since_heavy_rain === 999 ? "None" : `${prediction.days_since_heavy_rain}d`} sub="Since heavy rain" />
                </div>
                {/* Forecast rain bar */}
                {c.forecast_max_rain_mm > 0 && (
                    <div
                        style={{
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: "10px 14px",
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>⛈️ Forecast rain (5d max)</span>
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#fff", fontFamily: "var(--font-mono)" }}>
                                {c.forecast_max_rain_mm.toFixed(1)} mm
                            </span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                            <div
                                style={{
                                    height: "100%",
                                    width: `${Math.min((c.forecast_max_rain_mm / 100) * 100, 100)}%`,
                                    background: "linear-gradient(90deg, #378add, #5dcaa5)",
                                    borderRadius: 2,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Disease cards */}
                <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Outbreak risk · 5 diseases
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sorted.map((r) => (
                        <DiseaseCard key={r.disease} risk={r} />
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div
                style={{
                    padding: "10px 16px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <button
                    onClick={onSetAlert}
                    style={{
                        background: "var(--teal)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    🔔 Set SMS alert
                </button>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    OWM · USGS · Open-Meteo
                </span>
            </div>
        </div>
    );
}