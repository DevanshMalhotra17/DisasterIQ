"use client";

import { MapContainer, TileLayer, useMapEvents, Marker, Popup, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { PredictResponse } from "@/types";

// Fix default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RISK_COLORS: Record<string, string> = {
    LOW: "#22c55e",
    MODERATE: "#f59e0b",
    HIGH: "#ef4444",
    CRITICAL: "#7c3aed",
};

function getRiskColor(prediction: PredictResponse | null): string {
    if (!prediction) return "#3b82f6";
    const levels = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
    const worst = prediction.risks.reduce((max, r) =>
        levels.indexOf(r.risk_level) > levels.indexOf(max) ? r.risk_level : max,
        "LOW"
    );
    return RISK_COLORS[worst];
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface Props {
    onMapClick: (lat: number, lon: number) => void;
    coords: { lat: number; lon: number } | null;
    prediction: PredictResponse | null;
}

export default function Map({ onMapClick, coords, prediction }: Props) {
    const color = getRiskColor(prediction);

    return (
        <MapContainer
            center={[20, 0]}
            zoom={2}
            className="w-full h-full"
            style={{ background: "#0f172a" }}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <ClickHandler onMapClick={onMapClick} />

            {coords && (
                <>
                    {/* Outer pulse ring */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={40}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.08, weight: 1 }}
                    />
                    {/* Inner ring */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={20}
                        pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}
                    />
                    {/* Center dot */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={6}
                        pathOptions={{ color: "#fff", fillColor: color, fillOpacity: 1, weight: 2 }}
                    >
                        {prediction && (
                            <Popup>
                                <div className="text-xs font-mono">
                                    <div className="font-bold mb-1">
                                        {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
                                    </div>
                                    {prediction.risks.map((r) => (
                                        <div key={r.disease} style={{ color: RISK_COLORS[r.risk_level] }}>
                                            {r.disease}: {r.risk_level}
                                        </div>
                                    ))}
                                </div>
                            </Popup>
                        )}
                    </CircleMarker>
                </>
            )}
        </MapContainer>
    );
}