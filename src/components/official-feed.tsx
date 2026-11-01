import Link from "next/link";
import { formatDate } from "@/lib/format";

export type FeedItem = { id: string; kind: string; title: string; url: string; image_url: string | null; published_at: string | null; tags: string[] };

export const FEED_KIND: Record<string, string> = {
  nouvelle_serie: "Nouvelle série", visuels: "Visuels", advance_pack: "Advance Pack", produit: "Produit",
  evenement: "Événement", annonce: "Jeu",
};

/** Vignettes des actualités officielles : l'image reste hébergée sur le site officiel, un clic ouvre l'article. */
export function OfficialFeed({ items, compact = false }: { items: FeedItem[]; compact?: boolean }) {
  if (!items.length) return <p className="bubble text-sm text-muted">Aucune actualité officielle lue pour l’instant.</p>;
  return (
    <div className={compact ? "-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {items.map((it) => (
        <a key={it.id} href={it.url} target="_blank" rel="noreferrer"
          className={`panel panel-hover group block overflow-hidden ${compact ? "w-[260px] shrink-0 snap-start sm:w-[300px]" : ""}`}>
          <div className="relative aspect-[16/9] bg-surface-2 tone">
            {it.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            )}
            <span className="font-display absolute left-2 top-2 -rotate-2 bg-orange px-1.5 py-0.5 text-xs text-[#141414]">{FEED_KIND[it.kind] ?? "Actu"}</span>
          </div>
          <div className="space-y-1 p-3">
            <p className="text-xs text-muted">{it.published_at ? formatDate(it.published_at) : ""}{it.tags.find((t) => /弾/.test(t)) ? ` · ${it.tags.find((t) => /弾/.test(t))}` : ""}</p>
            <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-gold">{it.title}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export function FeedHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xl">{title}</h2>
      {href && <Link href={href} className="text-sm text-muted hover:text-gold">Tout voir</Link>}
    </div>
  );
}
