"use client";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" themes={["dark", "light"]} enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
