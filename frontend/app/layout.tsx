import type { Metadata } from "next";
import { Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "DisasterIQ — Real-Time Outbreak Risk Intelligence",
  description:
    "Click anywhere on the map to get real-time flood, weather, and disease outbreak risk powered by SEIR + XGBoost models, USGS flood gauges, and live weather data.",
  openGraph: {
    title: "DisasterIQ",
    description: "Real-time disaster & disease outbreak risk intelligence",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[#0b1120] text-white antialiased">
        {children}
      </body>
    </html>
  );
}