import Link from "next/link";
import { cardName } from "@/lib/catalogue";
import { formatMoney } from "@/lib/format";
import { RarityBadge } from "./rarity-badge";

export type CardRow = {
  id: string; card_number: string; variant: string; is_parallel: boolean;
  name_ja: string; name_fr: string | null; character_ja?: string | null; character_fr?: string | null;
  rarity_code: string | null; image_url: string | null;
  set?: { code: string } | null;
};

export function CardTile({ card, value }: { card: CardRow; value?: number | null }) {
  return (
    <Link href={`/cartes/${card.id}`} className="group block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-gold/60">
      <div className="relative aspect-[5/7] bg-surface-2">
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
            <span className="font-display tabular text-lg text-muted">{card.card_number}</span>
            <span className="text-xs text-muted">Pas d’image enregistrée</span>
          </div>
        )}
        <div className="absolute left-2 top-2"><RarityBadge code={card.rarity_code} parallel={card.is_parallel} /></div>
      </div>
      <div className="space-y-0.5 p-3">
        <p className="truncate text-sm font-medium group-hover:text-gold">{cardName(card)}</p>
        <p className="font-display tabular text-xs text-muted">{card.card_number}{card.variant ? ` · ${card.variant}` : ""}</p>
        <p className="tabular text-xs">{value != null ? formatMoney(value, "EUR") : <span className="text-muted">Pas de cote</span>}</p>
      </div>
    </Link>
  );
}
