import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Background hierarchy — Notion-inspired warm neutral
        "bg-primary": "#F7F6F4",
        "bg-secondary": "#FCFBFA",
        "bg-tertiary": "#FFFFFF",
        "bg-hover": "#F2F0ED",
        "bg-active": "#EDEBE8",
        // Text hierarchy — warm near-black
        "text-primary": "#1A1A1C",
        "text-secondary": "#6B6865",
        "text-tertiary": "#A09D99",
        // Border — whisper-weight
        border: "#E8E5E0",
        "border-strong": "#D5D2CD",
        // Accent — calmer blue, less "hyperlink"
        accent: "#0066CC",
        "accent-hover": "#0055B3",
        "accent-strong": "#004D99",
        "accent-subtle": "rgba(0, 102, 204, 0.08)",
        // Semantic score tokens — softer palette
        "score-high": "#1AAE4A",
        "score-high-bg": "rgba(26, 174, 74, 0.08)",
        "score-high-border": "rgba(26, 174, 74, 0.2)",
        "score-mid": "#DD8A00",
        "score-mid-bg": "rgba(221, 138, 0, 0.08)",
        "score-mid-border": "rgba(221, 138, 0, 0.2)",
        "score-low": "#CC3B3B",
        "score-low-bg": "rgba(204, 59, 59, 0.08)",
        "score-low-border": "rgba(204, 59, 59, 0.2)",
        success: "#1AAE4A",
        warn: "#DD8A00",
        danger: "#CC3B3B"
      },
      borderRadius: {
        app: "0.5rem",
        panel: "0.75rem",
        lg: "1rem",
        xl: "1.25rem"
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.03)",
        sm: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        md: "0 4px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
        lg: "0 10px 28px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
        panel: "0 18px 50px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        // Whisper border — Notion-style ultra-thin ring shadow
        ring: "0 0 0 1px rgba(0,0,0,0.07)"
      }
    }
  },
  plugins: []
};

export default config;
