import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Literata, Syne } from "next/font/google";

import "./room.css";
import "./styles.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const body = Literata({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Revenant — Personality Bank",
  description: "A live parlor for generated personas on Orbis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
