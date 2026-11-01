import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { PRODUCT_STATUS_LABEL, PRODUCT_TYPE_LABEL } from "@/lib/catalogue";
import { formatDate, formatMoney, jpyToEur, type Currency, type Reliability } from "@/lib/format";
import { getLatestFx } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TYPES = ["advance_pack", "first_pack", "booster", "display", "coffret", "edition_limitee", "evenementiel", "livre"] as const;

export default async function AdvancePacksPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "advance_pack" } = await searchParams;
  const supabase = await createClient();
  const fx = await getLatestFx(supabase);
  const { data: products, error } = await supabase.from("products")
    .select("id, type, name_ja, name_fr, status, official_price_jpy, cards_per_unit, image_url, reliability, set:card_sets(code), product_cards(is_exclusive), product_listings(price, currency, availability, is_active), release_calendar(event_date, precision, is_estimate, region)")
    .eq("type", type).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title={type === "advance_pack" ? "Advance Packs" : PRODUCT_TYPE_LABEL[type] ?? "Produits"}
        intro="Produits scellés suivis séparément des cartes de borne : prix officiel japonais, contenu, cartes exclusives et offres des boutiques.">
        <Link href="/saisie?onglet=produit" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold">Ajouter un produit</Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link key={t} href={`/advance-packs?type=${t}`} className={`rounded-full border px-3 py-1 text-sm ${type === t ? "border-gold text-gold" : "border-line text-muted hover:text-ink"}`}>{PRODUCT_TYPE_LABEL[t]}</Link>
        ))}
      </div>

      {error && <p className="text-down">Lecture impossible : {error.message}</p>}
      {!error && !products?.length && <p className="text-muted">Aucun produit de ce type enregistré. Ajoute-le depuis la saisie avec sa source officielle.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {(products ?? []).map((p) => {
          const exclusive = (p.product_cards as { is_exclusive: boolean }[]).filter((x) => x.is_exclusive).length;
          const offers = (p.product_listings as { price: number | null; currency: Currency; availability: string; is_active: boolean }[])
            .filter((l) => l.is_active && l.price != null)
            .map((l) => ({ ...l, eur: l.currency === "EUR" ? Number(l.price) : l.currency === "JPY" ? jpyToEur(l.price, fx) : null }));
          const cheapest = offers.filter((o) => o.eur != null).sort((a, b) => (a.eur ?? 0) - (b.eur ?? 0))[0];
          const preorders = offers.filter((o) => o.availability === "precommande").length;
          const rel = (p.release_calendar as { event_date: string; precision: string; is_estimate: boolean; region: string }[]).find((r) => r.region === "JP");
          const officialEur = jpyToEur(p.official_price_jpy, fx);
          return (
            <Link key={p.id} href={`/produits/${p.id}`} className="group flex gap-4 panel p-4 panel-hover">
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center text-[0.7rem] text-muted">Sans visuel</div>}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium group-hover:text-gold">{p.name_fr ?? p.name_ja}</p>
                  <ReliabilityBadge level={p.reliability as Reliability} />
                </div>
                <p className="text-sm text-muted">{PRODUCT_STATUS_LABEL[p.status]}{(p.set as unknown as { code: string } | null)?.code ? ` · ${(p.set as unknown as { code: string }).code}` : ""}{rel ? ` · ${formatDate(rel.event_date, rel.precision)}${rel.is_estimate ? " (estimation)" : ""}` : ""}</p>
                <p className="tabular text-sm">
                  {p.official_price_jpy ? <>Prix officiel {formatMoney(p.official_price_jpy, "JPY")}{officialEur !== null && <span className="text-muted"> ≈ {formatMoney(officialEur, "EUR")}</span>}</> : <span className="text-muted">Prix officiel non renseigné</span>}
                </p>
                <p className="text-sm text-muted">
                  {p.cards_per_unit ? `${p.cards_per_unit} cartes` : "Contenu non renseigné"}
                  {exclusive ? ` · ${exclusive} exclusive${exclusive > 1 ? "s" : ""}` : ""}
                  {` · ${offers.length} offre${offers.length > 1 ? "s" : ""}`}
                  {preorders ? ` dont ${preorders} en précommande` : ""}
                  {cheapest?.eur != null ? ` · dès ${formatMoney(cheapest.eur, "EUR")}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
