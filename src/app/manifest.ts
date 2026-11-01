import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Super Divers Watch",
    short_name: "Divers Watch",
    description: "Veille et collection Dragon Ball Super Divers",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0f13",
    theme_color: "#0f0f13",
    lang: "fr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
