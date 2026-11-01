"use client";
import { useEffect, useState } from "react";

/** Compte à rebours jusqu'à minuit (heure du Japon) le jour de sortie. */
export function Countdown({ date }: { date: string }) {
  const target = Date.parse(`${date}T00:00:00+09:00`);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <div className="h-[4.5rem]" aria-hidden />;

  const diff = Math.max(0, target - now);
  if (diff === 0) return <p className="text-2xl font-semibold text-gold">Disponible au Japon aujourd’hui</p>;

  const s = Math.floor(diff / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: "jours" },
    { v: Math.floor((s % 86400) / 3600), l: "heures" },
    { v: Math.floor((s % 3600) / 60), l: "minutes" },
    { v: s % 60, l: "secondes" },
  ];

  return (
    <div className="flex gap-5 sm:gap-7" role="timer" aria-label={`${parts[0].v} jours et ${parts[1].v} heures avant la sortie`}>
      {parts.map((p, i) => (
        <div key={p.l} className={i === 3 ? "hidden sm:block" : undefined}>
          <div className="font-display tabular text-[2.6rem] font-semibold leading-none tracking-tight sm:text-[3.4rem]">
            {String(p.v).padStart(2, "0")}
          </div>
          <div className="mt-1.5 text-xs text-muted">{p.l}</div>
        </div>
      ))}
    </div>
  );
}
