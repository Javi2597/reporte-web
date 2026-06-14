import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark UI palette
        ink: {
          950: "#0a0b0f",
          900: "#0f1117",
          800: "#161924",
          700: "#1f2330",
          600: "#2a2f3f",
        },
        score: {
          good: "#22c55e",
          mid: "#f59e0b",
          bad: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
