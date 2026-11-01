"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && theme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
    >
      {isLight ? <Moon size={17} aria-hidden /> : <Sun size={17} aria-hidden />}
      {isLight ? "Passer en mode sombre" : "Passer en mode clair"}
    </button>
  );
}
