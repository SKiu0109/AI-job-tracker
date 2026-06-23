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
        canvas: "#f6f7f8",
        ink: "#101418",
        muted: "#65717c",
        subtle: "#8b949e",
        line: "#e5e7eb",
        "line-strong": "#cfd6dd",
        paper: "#f6f7f8",
        surface: "#ffffff",
        "surface-muted": "#fbfcfd",
        accent: "#0f766e",
        "accent-strong": "#0b5f59",
        "accent-soft": "#e6f5f2",
        success: "#047857",
        warn: "#b45309",
        danger: "#b42318"
      },
      borderRadius: {
        app: "0.5rem",
        panel: "0.75rem"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 20, 24, 0.06)",
        panel: "0 14px 40px rgba(16, 20, 24, 0.07)",
        lift: "0 8px 24px rgba(16, 20, 24, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
