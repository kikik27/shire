import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/site/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://shire.work"),
  title: {
    default: "Shire — Your AI copilot for hiring, settled onchain",
    template: "%s · Shire",
  },
  description:
    "Shire is an AI-powered hiring marketplace. AI finds the jobs and the talent, you approve the important moves, and stablecoin escrow on Celo protects both sides.",
  openGraph: {
    title: "Shire — Your AI copilot for hiring",
    description:
      "AI finds jobs and talent. You approve. Stablecoin escrow on Celo settles.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
