import { RELIABILITY_LABEL, type Reliability } from "@/lib/format";

const STYLE: Record<Reliability, string> = {
  officiel: "border-gold/40 text-gold",
  boutique: "border-line text-ink",
  estimation: "border-orange/40 text-orange",
  non_verifie: "border-line text-muted",
};

export function ReliabilityBadge({ level }: { level: Reliability }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.72rem] ${STYLE[level]}`}>
      {RELIABILITY_LABEL[level]}
    </span>
  );
}
