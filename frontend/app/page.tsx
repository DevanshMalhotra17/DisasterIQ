"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import RiskPanel from "@/components/RiskPanel";
import AlertModal from "@/components/AlertModal";
import type { PredictResponse } from "@/types";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function Home() {
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  async function handleMapClick(lat: number, lon: number) {
    setCoords({ lat, lon });
    setLoading(true);
    setPrediction(null);
    try {
      const res = await fetch(`${API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      });
      const data: PredictResponse = await res.json();
      setPrediction(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#0b1120" }}>
      {/* Navbar */}
      <nav
        style={{
          height: 52,
          background: "#0f1729",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
          flexShrink: 0,
          zIndex: 1000,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "#1d9e75",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
            DisasterIQ
          </span>
        </div>

        {/* Nav pills */}
        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {["Live map", "Scenarios", "Forecast", "Alerts"].map((tab, i) => (
            <button
              key={tab}
              style={{
                fontSize: 12,
                padding: "4px 11px",
                borderRadius: 20,
                border: i === 0 ? "1px solid rgba(29,158,117,0.5)" : "1px solid rgba(255,255,255,0.08)",
                background: i === 0 ? "rgba(29,158,117,0.15)" : "transparent",
                color: i === 0 ? "#5dcaa5" : "rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                background: "#1d9e75",
                borderRadius: "50%",
              }}
            />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Live · 3 APIs</span>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <Map
            onMapClick={handleMapClick}
            coords={coords}
            prediction={prediction}
            loading={loading}
          />

          {/* Loading pill */}
          {loading && (
            <div
              style={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                background: "#1d9e75",
                color: "#fff",
                padding: "7px 18px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              Analyzing risk…
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: 360,
            flexShrink: 0,
            background: "#0f1729",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <RiskPanel
            prediction={prediction}
            loading={loading}
            coords={coords}
            onSetAlert={() => setShowAlert(true)}
          />
        </div>
      </div>

      {/* Alert modal */}
      {showAlert && (
        <AlertModal coords={coords} onClose={() => setShowAlert(false)} />
      )}
    </main>
  );
}