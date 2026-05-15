"use client";

import { useState } from "react";

interface Props {
    coords: { lat: number; lon: number } | null;
    onClose: () => void;
}

type Step = "form" | "sending" | "done" | "error";

export default function AlertModal({ coords, onClose }: Props) {
    const [phone, setPhone] = useState("");
    const [threshold, setThreshold] = useState<"MODERATE" | "HIGH" | "CRITICAL">("HIGH");
    const [step, setStep] = useState<Step>("form");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleSubmit() {
        if (!phone.trim() || !coords) return;
        setStep("sending");
        try {
            const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
            const res = await fetch(`${API}/alerts/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    lat: coords.lat,
                    lon: coords.lon,
                    threshold,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            setStep("done");
        } catch (e: unknown) {
            setErrorMsg(e instanceof Error ? e.message : "Unknown error");
            setStep("error");
        }
    }

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    padding: 24,
                    width: "100%",
                    maxWidth: 380,
                }}
            >
                {step === "form" && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>
                                    🔔 Set SMS alert
                                </h2>
                                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                                    Get notified when risk escalates at this location
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>

                        {coords && (
                            <div
                                style={{
                                    background: "rgba(29,158,117,0.1)",
                                    border: "1px solid rgba(29,158,117,0.25)",
                                    borderRadius: 8,
                                    padding: "8px 12px",
                                    marginBottom: 16,
                                    fontSize: 12,
                                    color: "#5dcaa5",
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                📍 {coords.lat.toFixed(4)}°, {coords.lon.toFixed(4)}°
                            </div>
                        )}

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
                                Phone number (with country code)
                            </label>
                            <input
                                type="tel"
                                placeholder="+1 555 000 0000"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                style={{
                                    width: "100%",
                                    background: "#1a2235",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 8,
                                    padding: "9px 12px",
                                    fontSize: 14,
                                    color: "#fff",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
                                Alert when risk reaches
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                                {(["MODERATE", "HIGH", "CRITICAL"] as const).map((lvl) => {
                                    const colors: Record<string, string> = {
                                        MODERATE: "#1d9e75",
                                        HIGH: "#ef9f27",
                                        CRITICAL: "#e24b4a",
                                    };
                                    const active = threshold === lvl;
                                    return (
                                        <button
                                            key={lvl}
                                            onClick={() => setThreshold(lvl)}
                                            style={{
                                                flex: 1,
                                                padding: "7px 0",
                                                borderRadius: 8,
                                                fontSize: 11,
                                                fontWeight: 500,
                                                cursor: "pointer",
                                                border: `1px solid ${active ? colors[lvl] : "rgba(255,255,255,0.1)"}`,
                                                background: active ? `${colors[lvl]}22` : "transparent",
                                                color: active ? colors[lvl] : "rgba(255,255,255,0.4)",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {lvl}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!phone.trim()}
                            style={{
                                width: "100%",
                                background: phone.trim() ? "#1d9e75" : "rgba(255,255,255,0.08)",
                                color: phone.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                                border: "none",
                                borderRadius: 8,
                                padding: "10px 0",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: phone.trim() ? "pointer" : "not-allowed",
                                transition: "all 0.2s ease",
                            }}
                        >
                            Subscribe to alerts
                        </button>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12 }}>
                            Powered by Twilio · No spam, unsubscribe anytime
                        </p>
                    </>
                )}

                {step === "sending" && (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                border: "3px solid rgba(255,255,255,0.1)",
                                borderTopColor: "#1d9e75",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                                margin: "0 auto 16px",
                            }}
                        />
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Setting up alert…</p>
                    </div>
                )}

                {step === "done" && (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Alert set!</h3>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                            You'll receive an SMS when {threshold.toLowerCase()} risk is detected at this location.
                        </p>
                        <button
                            onClick={onClose}
                            style={{
                                marginTop: 20,
                                background: "#1d9e75",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 24px",
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            Done
                        </button>
                    </div>
                )}

                {step === "error" && (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
                            Couldn't set alert
                        </h3>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>{errorMsg}</p>
                        <button
                            onClick={() => setStep("form")}
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 24px",
                                fontSize: 13,
                                cursor: "pointer",
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}