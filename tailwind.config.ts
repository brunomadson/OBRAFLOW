import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:  "#3B82F6",
          green: "#10B981",
          purple:"#8B5CF6",
          orange:"#F97316",
          red:   "#EF4444",
          yellow:"#F59E0B",
          indigo:"#6366F1",
          cyan:  "#06B6D4",
          gray:  "#6B7280",
        },
        slate: {
          950: "#0F172A",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 4px rgba(0,0,0,0.06)",
        "card-hover": "0 6px 20px rgba(0,0,0,0.12)",
        modal: "0 24px 80px rgba(0,0,0,0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
