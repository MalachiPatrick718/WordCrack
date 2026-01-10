import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Match WordCrack app theme (`WordCrack/src/theme/colors.ts`)
        ink: "#0B1220",
        navy: "#2D5A8A",
        blue: "#4A90D9",
        sky: "#74C0FC",
        yellow: "#FFD93D",
        orange: "#FF9F43",
        green: "#26DE81",
        red: "#FC5C65",
        // Brighter glass cards + borders
        card: "rgba(255,255,255,0.10)",
        border: "rgba(255,255,255,0.16)",
      },
      boxShadow: {
        glow: "0 0 52px rgba(74,144,217,0.34)",
      },
    },
  },
  plugins: [],
} satisfies Config;

