import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordCrack — Crack the cipher. Beat the clock.",
  description:
    "WordCrack is an hourly 5-letter cipher word puzzle. Everyone gets the same puzzle—race the clock and climb the leaderboards.",
  icons: [{ rel: "icon", url: "/logo.svg" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

