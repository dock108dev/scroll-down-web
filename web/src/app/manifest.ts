import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scroll Down MLB",
    short_name: "Scroll Down MLB",
    description:
      "MLB scoreboard for today's games and the prior 48 hours, with spoiler-free play-by-play timelines.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050807",
    theme_color: "#050807",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
