import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OYSTER AI — Your Self-Growing AI Business Ecosystem",
    short_name: "Oyster AI",
    description: "Build. Grow. Earn. Set it once. Let it grow.",
    start_url: "/",
    display: "standalone",
    background_color: "#050716",
    theme_color: "#050716",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}