import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ROI Cyber-Validator — Cyber Risk Prediction Platform",
  description:
    "Safe, simulated attack scenarios against your security tools, estimating probability of success and annual financial loss exposure.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={ibmPlexSans.variable} data-theme="light">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
