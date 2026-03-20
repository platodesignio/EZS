import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Scientific dark theme palette
        surface: {
          0: "#0a0b0d",
          1: "#111318",
          2: "#181c22",
          3: "#1f242e",
          4: "#262d3a",
        },
        accent: {
          blue: "#3b82f6",
          cyan: "#06b6d4",
          teal: "#14b8a6",
          green: "#22c55e",
          yellow: "#eab308",
          orange: "#f97316",
          red: "#ef4444",
          purple: "#a855f7",
        },
        border: "#2a3040",
        muted: "#4b5563",
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          tertiary: "#64748b",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.625rem",
        xs: "0.75rem",
        sm: "0.8125rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
