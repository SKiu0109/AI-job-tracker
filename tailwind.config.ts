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
        ink: "#17211f",
        muted: "#647067",
        line: "#dbe4df",
        paper: "#f8faf8",
        accent: "#0f766e",
        "accent-soft": "#dff4ef",
        warn: "#b7791f",
        danger: "#b42318"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(23, 33, 31, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
