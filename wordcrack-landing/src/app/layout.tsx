import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindShift — Unscramble the word. Beat the clock.",
  description:
    "MindShift is an hourly 5-letter word game with two modes: Cipher and Scramble. Everyone gets the same puzzles—race the clock and climb the leaderboards.",
  icons: [{ rel: "icon", url: "/logo.svg" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

