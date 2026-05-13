"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { PredictResponse, DiseaseRisk } from "@/types";
import { useState } from "react";

const RISK_COLORS: Record<string, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#ef4444",
    CRITICAL: "#7c3aed",
};

const RISK_BG: Record<string, string> = {
    LOW: "bg-green-950 border-green-800",
    MODERATE: "bg-yellow-950 border-yellow-800",
    HIGH: "bg-red-950 border-red-800",
    CRITICAL: "bg-purple-950 border-purple-800",
};

const DISEASE_ICONS: Record<string, string> = {
    cholera: "💧",
    dengue: "🦟",
    malaria: "🦟",
    leptospirosis: "🐀",
    salmonella: "🦠",
};

function RiskBadge({ level }: { level: string }) {
    return (
        <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: RISK_COLORS[level] + "33", color: RISK_COLORS[level] }}
        >
            {level}
        </span>
    );
}

function DiseaseCard({ risk }: { risk: DiseaseRisk }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={`rounded-xl border p-4 cursor-pointer transition-all ${RISK_BG[risk.risk_level]}`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{DISEASE_ICONS[risk.disease] ?? "🦠"}</span>
                    <span className="text-white font-semibold capitalize">{risk.disease}</span>
                </div>
                <div className="flex items-center gap-2">
                    <RiskBadge level={risk.risk_level} />
                    <span className="text-gray-400 text-xs">{risk.confidence}%</span>
                    <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
                </div>
            </div>

            {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-3 gap-3 text-center">
                    <div>
                        <div className="text-gray-400 text-xs">R₀</div>
                        <div className="text-white font-bold">{risk.r0}</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Peak Infected</div>
                        <div className="text-white font-bold">{risk.peak_infected.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Total Infected</div>
                        <div className="text-white font-bold">{risk.total_infected.toLocaleString()}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ClimateBar({ label, value, unit, max }: { label: string; value: number; unit: string; max: number }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className="text-white">{value}{unit}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

interface Props {
    prediction: PredictResponse | null;
    loading: boolean;
    coords: { lat: number; lon: number } | null;
}

export default function RiskPanel({ prediction, loading, coords }: Props) {
    if (!coords && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="text-5xl mb-4">🗺️</div>
                <h2 className="text-white font-bold text-xl mb-2">Click anywhere on the map</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                    Pathogen will fetch real-time weather, flood gauge, and historical rain data,
                    then run SEIR + XGBoost models to predict outbreak risk for 5 diseases.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-2 w-full">
                    {["Cholera", "Dengue", "Malaria", "Leptospirosis"].map((d) => (
                        <div key={d} className="bg-gray-800 rounded-lg p-3 text-center">
                            <div className="text-gray-300 text-xs font-medium">{d}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                    <div className="text-white font-semibold">Fetching live data...</div>
                    <div className="text-gray-400 text-sm mt-1">
                        OWM · Open-Meteo · USGS
                    </div>
                </div>
                {coords && (
                    <div className="text-gray-500 text-xs font-mono">
                        {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
                    </div>
                )}
            </div>
        );
    }

    if (!prediction) return null;

    const c = prediction.climate_summary;
    const worstRisk = prediction.risks.reduce((max, r) => {
        const levels = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
        return levels.indexOf(r.risk_level) > levels.indexOf(max.risk_level) ? r : max;
    });

    return (
        <div className="p-4 space-y-4">
            {/* Location header */}
            <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs font-mono">
                        {prediction.lat.toFixed(4)}, {prediction.lon.toFixed(4)}
                    </span>
                    <RiskBadge level={worstRisk.risk_level} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                    {prediction.usgs_flood_detected && (
                        <span className="text-xs bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full">
                            Flood Detected
                        </span>
                    )}
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                        {prediction.days_since_heavy_rain === 999 ? "No recent rain" : `Rain ${prediction.days_since_heavy_rain}d ago`}
                    </span>
                </div>
            </div>

            {/* Climate summary */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
                    Climate Conditions
                </h3>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Weather</span>
                    <span className="text-white">{c.weather_main}</span>
                </div>
                <ClimateBar label="Temperature" value={c.temp_c} unit="°C" max={50} />
                <ClimateBar label="Humidity" value={c.humidity_pct} unit="%" max={100} />
                <ClimateBar label="Rain (1h)" value={c.rain_1h_mm} unit="mm" max={100} />
                <ClimateBar label="Forecast Rain" value={c.forecast_max_rain_mm} unit="mm" max={200} />
            </div>

            {/* Disease risk cards */}
            <div className="space-y-2">
                <h3 className="text-gray-300 text-xs font-semibold uppercase tracking-wider px-1">
                    Disease Risk Assessment
                </h3>
                {prediction.risks
                    .sort((a, b) => {
                        const levels = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
                        return levels.indexOf(b.risk_level) - levels.indexOf(a.risk_level);
                    })
                    .map((risk) => (
                        <DiseaseCard key={risk.disease} risk={risk} />
                    ))}
            </div>

            <p className="text-gray-600 text-xs text-center pb-2">
                Powered by SEIR + XGBoost · OWM · USGS · Open-Meteo
            </p>
        </div>
    );
}