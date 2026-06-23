import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Job Tracker",
    short_name: "Job Tracker",
    description:
      "Bilingual AI job search analytics platform for Chinese-speaking international students.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf8",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
