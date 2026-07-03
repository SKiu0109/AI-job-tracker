import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
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
        danger: "#CC3B3B",
        // Internal app foundation tokens - additive, used by new primitives.
        "app-bg": "var(--app-bg)",
        "app-surface": "var(--app-surface)",
        "app-surface-subtle": "var(--app-surface-subtle)",
        "app-surface-muted": "var(--app-surface-muted)",
        "app-surface-hover": "var(--app-surface-hover)",
        "app-surface-solid": "var(--app-surface-solid)",
        "app-surface-raised": "var(--app-surface-raised)",
        "app-chrome": "var(--app-chrome)",
        "app-text-primary": "var(--app-text-primary)",
        "app-text-secondary": "var(--app-text-secondary)",
        "app-text-tertiary": "var(--app-text-tertiary)",
        "app-border": "var(--app-border)",
        "app-border-soft": "var(--app-border-soft)",
        "app-border-strong": "var(--app-border-strong)",
        "app-accent": "var(--app-accent)",
        "app-accent-hover": "var(--app-accent-hover)",
        "app-accent-soft": "var(--app-accent-soft)",
        "app-accent-purple": "var(--app-accent-purple)",
        "app-success": "var(--app-success)",
        "app-success-soft": "var(--app-success-soft)",
        "app-success-border": "var(--app-success-border)",
        "app-warning": "var(--app-warning)",
        "app-warning-soft": "var(--app-warning-soft)",
        "app-warning-border": "var(--app-warning-border)",
        "app-danger": "var(--app-danger)",
        "app-danger-soft": "var(--app-danger-soft)",
        "app-danger-border": "var(--app-danger-border)",
        "app-info": "var(--app-info)",
        "app-info-soft": "var(--app-info-soft)",
        "app-info-border": "var(--app-info-border)",
        "app-paper": "var(--app-paper)",
        "app-paper-muted": "var(--app-paper-muted)",
        "app-overlay": "var(--app-overlay)"
      },
      borderRadius: {
        // Apple-inspired radius scale: softer containers, still compact controls.
        xs: "0.375rem",      // 6px — tiny badges and inline affordances
        sm: "0.625rem",      // 10px — buttons, inputs, segmented controls
        md: "0.75rem",       // 12px — small tiles and nested surfaces
        app: "0.75rem",      // 12px — existing app chip/control shorthand
        lg: "1rem",          // 16px — standard cards and panels
        xl: "1.25rem",       // 20px — popovers and featured panels
        "2xl": "1.5rem",     // 24px — sheets and large containers
        full: "9999px",      // pill badges, tags
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.03)",
        sm: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        md: "0 4px 12px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
        lg: "0 10px 28px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)",
        panel: "0 18px 50px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        // App panel shadows backed by CSS variables
        border: "var(--app-shadow-border)",
        "app-card": "var(--app-shadow-card)",
        "app-panel": "var(--app-shadow-elevated)",
        "app-elevated": "var(--app-shadow-elevated)",
        "app-floating": "var(--app-shadow-floating)",
        "app-focus": "var(--app-shadow-focus)",
        "app-accent": "var(--app-shadow-accent)",
        "app-accent-hover": "var(--app-shadow-accent-hover)"
      }
    }
  },
  plugins: []
};

export default config;
