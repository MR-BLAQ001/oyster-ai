import type { Metadata, Viewport } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "OYSTER AI — Build. Grow. Earn.",
  description: "Your Self-Growing AI Business Ecosystem",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "OYSTER AI",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#050716",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}