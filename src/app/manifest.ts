import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Offerwise",
    short_name: "Offerwise",
    description:
      "Multilingual job search workspace for tracking roles, decisions, resumes, and follow-ups.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F7F6F4",
    theme_color: "#F7F6F4",
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
