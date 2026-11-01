import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Zen_Kaku_Gothic_New } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const latin = Instrument_Sans({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const jp = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Super Divers Watch",
  description: "Veille et collection Dragon Ball Super Divers",
  appleWebApp: { capable: true, title: "Divers Watch", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${latin.variable} ${jp.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
