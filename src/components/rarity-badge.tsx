const STYLE: Record<string, string> = {
  GDR: "border-[var(--r-gdr)] text-[var(--r-gdr)] bg-[color-mix(in_oklab,var(--r-gdr)_14%,transparent)]",
  SEC: "border-[var(--r-sec)] text-[var(--r-sec)] bg-[linear-gradient(100deg,color-mix(in_oklab,var(--r-sec)_18%,transparent),color-mix(in_oklab,var(--ki)_18%,transparent))]",
  EXR: "border-[var(--r-exr)] text-[var(--r-exr)] bg-[color-mix(in_oklab,var(--r-exr)_12%,transparent)]",
  PUR: "border-[var(--r-pur)] text-[var(--r-pur)] bg-[color-mix(in_oklab,var(--r-pur)_12%,transparent)]",
};

export function RarityBadge({ code, parallel = false }: { code: string | null; parallel?: boolean }) {
  if (!code && !parallel) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {code && (
        <span className={`font-display inline-flex items-center rounded-md border px-1.5 py-0.5 text-[0.72rem] font-semibold ${STYLE[code] ?? "border-line text-muted"}`}>
          {code}
        </span>
      )}
      {parallel && (
        <span className="inline-flex items-center rounded-md border border-ki/50 px-1.5 py-0.5 text-[0.72rem] text-ki">Parallèle</span>
      )}
    </span>
  );
}
