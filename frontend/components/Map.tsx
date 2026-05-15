"use client";

import {
    MapContainer,
    TileLayer,
    useMapEvents,
    CircleMarker,
    Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PredictResponse } from "@/types";
import { RISK_COLOR, worstRisk } from "@/types";

function ClickHandler({
    onMapClick,
}: {
    onMapClick: (lat: number, lon: number) => void;
}) {
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
    loading: boolean;
}

export default function Map({ onMapClick, coords, prediction, loading }: Props) {
    const level = prediction ? worstRisk(prediction.risks) : null;
    const color = level ? RISK_COLOR[level] : "#1d9e75";

    return (
        <MapContainer
            center={[20, 0]}
            zoom={2}
            className="w-full h-full"
            style={{ background: "#0b1120" }}
            zoomControl={true}
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            {/* Country outlines only — cleaner look */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_matter_only_labels/{z}/{x}/{y}{r}.png"
                attribution=""
                opacity={0.5}
            />

            <ClickHandler onMapClick={onMapClick} />

            {coords && (
                <>
                    {/* Outermost glow ring */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={50}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.04,
                            weight: 0.5,
                            opacity: 0.3,
                        }}
                    />
                    {/* Mid ring */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={28}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.08,
                            weight: 1,
                            opacity: 0.5,
                        }}
                    />
                    {/* Inner ring */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={14}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: loading ? 0.2 : 0.15,
                            weight: 1.5,
                            opacity: 0.8,
                        }}
                    />
                    {/* Center dot */}
                    <CircleMarker
                        center={[coords.lat, coords.lon]}
                        radius={5}
                        pathOptions={{
                            color: "#fff",
                            fillColor: color,
                            fillOpacity: 1,
                            weight: 2,
                        }}
                    >
                        {prediction && (
                            <Popup>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, minWidth: 160 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#fff" }}>
                                        {coords.lat.toFixed(3)}°, {coords.lon.toFixed(3)}°
                                    </div>
                                    {prediction.risks
                                        .sort(
                                            (a, b) =>
                                                ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(b.risk_level) -
                                                ["LOW", "MODERATE", "HIGH", "CRITICAL"].indexOf(a.risk_level)
                                        )
                                        .map((r) => (
                                            <div
                                                key={r.disease}
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                    marginBottom: 3,
                                                    color: RISK_COLOR[r.risk_level as keyof typeof RISK_COLOR],
                                                }}
                                            >
                                                <span style={{ textTransform: "capitalize", color: "rgba(255,255,255,0.7)" }}>
                                                    {r.disease}
                                                </span>
                                                <span style={{ fontWeight: 700 }}>{r.risk_level}</span>
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