"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import RiskPanel from "@/components/RiskPanel";
import type { PredictResponse } from "@/types";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Home() {
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  async function handleMapClick(lat: number, lon: number) {
    setCoords({ lat, lon });
    setLoading(true);
    setPrediction(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
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
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Map */}
      <div className="flex-1 relative">
        <Map onMapClick={handleMapClick} coords={coords} prediction={prediction} />

        {/* Header overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl px-6 py-3 text-center">
          <h1 className="text-white font-bold text-lg tracking-tight">
            Pathogen Risk Monitor
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Click anywhere on the map to predict disease outbreak risk
          </p>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-medium animate-pulse">
            Analyzing risk factors...
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-[420px] h-full overflow-y-auto bg-gray-900 border-l border-gray-800">
        <RiskPanel prediction={prediction} loading={loading} coords={coords} />
      </div>
    </main>
  );
}