import Link from "next/link";
import { notFound } from "next/navigation";
import { CardTile, type CardRow } from "@/components/card-tile";
import { PageHeader } from "@/components/page-header";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { AVAILABILITY_LABEL, EVENT_LABEL, KIND_LABEL, PRODUCT_STATUS_LABEL, PRODUCT_TYPE_LABEL, marketSearchLinks } from "@/lib/catalogue";
import { formatDate, formatMoney, formatRelative, jpyToEur, type Currency, type Reliability } from "@/lib/format";
import { getLatestFx } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProduitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("products")
    .select("*, set:card_sets(code, name_ja, name_fr), source:sources(name, url)").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [fx, { data: listings }, { data: pcs }, { data: hist }, { data: rels }, { data: val }] = await Promise.all([
    getLatestFx(supabase),
    supabase.from("product_listings").select("id, title, url, price, currency, shipping_cost, availability, last_checked_at, store:stores(name)").eq("product_id", id).eq("is_active", true),
    supabase.from("product_cards").select("is_exclusive, card:cards(id, card_number, variant, is_parallel, name_ja, name_fr, rarity_code, image_url)").eq("product_id", id),
    supabase.from("price_history").select("id, observed_at, kind, price, currency, price_eur, url, store:stores(name)").eq("product_id", id).order("observed_at", { ascending: false }).limit(25),
    supabase.from("release_calendar").select("id, event_type, event_date, precision, is_estimate, region").eq("product_id", id).order("event_date"),
    supabase.from("product_valuation").select("*").eq("product_id", id).maybeSingle(),
  ]);
  const set = p.set as { code: string } | null;
  const src = p.source as { name: string; url: string | null } | null;
  const offers = (listings ?? []).map((l) => ({ ...l, eur: l.currency === "EUR" ? Number(l.price) : l.currency === "JPY" ? jpyToEur(l.price, fx) : null }))
    .sort((a, b) => (a.eur ?? Infinity) - (b.eur ?? Infinity));
  const cards = (pcs ?? []).map((x) => ({ ...(x.card as unknown as CardRow), exclusive: x.is_exclusive }));
  const officialEur = jpyToEur(p.official_price_jpy, fx);

  return (
    <div>
      <PageHeader title={p.name_fr ?? p.name_ja} intro={p.name_fr ? p.name_ja : undefined}>
        <Link href="/saisie?onglet=assistee" className="btn-main px-3 py-2 text-sm">Ajouter une offre</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" className="w-full object-cover" />
            ) : <div className="flex aspect-square items-center justify-center text-sm text-muted">Sans visuel</div>}
          </div>
          <dl className="space-y-2 panel p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Type</dt><dd>{PRODUCT_TYPE_LABEL[p.type]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Statut</dt><dd>{PRODUCT_STATUS_LABEL[p.status]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Série</dt><dd>{set ? <Link href={`/series/${encodeURIComponent(set.code)}`} className="hover:text-gold">{set.code}</Link> : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Prix officiel</dt><dd className="tabular text-right">{p.official_price_jpy ? formatMoney(p.official_price_jpy, "JPY") : "—"}{officialEur !== null && <span className="block text-xs text-muted">≈ {formatMoney(officialEur, "EUR")}</span>}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Cartes par unité</dt><dd>{p.cards_per_unit ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Code JAN</dt><dd className="tabular">{p.jan_code ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Fiabilité</dt><dd><ReliabilityBadge level={p.reliability as Reliability} /></dd></div>
            {src?.url && <a href={src.url} target="_blank" rel="noreferrer" className="block pt-1 text-xs text-muted hover:text-gold">Source : {src.name}</a>}
          </dl>
        </div>

        <div className="space-y-6">
          <section className="panel burst p-5">
            <p className="text-sm text-muted">Valeur estimée</p>
            <p className="font-display tabular mt-1 text-4xl font-semibold">{val?.valeur_estimee_eur != null ? formatMoney(val.valeur_estimee_eur, "EUR") : "—"}</p>
            <p className="mt-1 text-sm text-muted">{val?.base_valorisation === "ventes_conclues" ? "Médiane des ventes conclues sur 90 jours" : val?.base_valorisation === "annonces" ? "Plus bas prix affiché sur 30 jours" : "Aucune donnée de prix fiable"}</p>
            {rels?.length ? (
              <div className="mt-4 space-y-1 text-sm">
                {rels.map((r) => <p key={r.id}>{EVENT_LABEL[r.event_type]} · {r.region === "JP" ? "Japon" : "France"} · {formatDate(r.event_date, r.precision)}{r.is_estimate ? " (estimation)" : ""}</p>)}
              </div>
            ) : <p className="mt-4 text-sm text-muted">Date de sortie non renseignée.</p>}
          </section>

          {p.contents && (
            <section className="panel p-5">
              <h2 className="mb-2 text-lg font-semibold">Contenu</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed">{p.contents}</p>
            </section>
          )}

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold">Offres des boutiques</h2>
            {offers.length ? (
              <ul className="divide-y divide-line">
                {offers.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-gold">
                      <span className="block truncate">{(l.store as unknown as { name: string } | null)?.name ?? "Boutique"}</span>
                      <span className="text-xs text-muted">{AVAILABILITY_LABEL[l.availability]} · vérifié {formatRelative(l.last_checked_at)}{l.shipping_cost ? ` · port ${formatMoney(l.shipping_cost, l.currency as Currency)}` : ""}</span>
                    </a>
                    <span className="tabular shrink-0 text-right">{formatMoney(l.price, l.currency as Currency)}{l.currency !== "EUR" && l.eur !== null && <span className="block text-xs text-muted">≈ {formatMoney(l.eur, "EUR")}</span>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucune offre enregistrée.</p>}
          </section>

          {cards.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 text-lg font-semibold">Cartes incluses</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {cards.map((c) => <CardTile key={c.id} card={c} />)}
              </div>
            </section>
          )}

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold">Historique des prix</h2>
            {hist?.length ? (
              <ul className="divide-y divide-line text-sm">
                {hist.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 py-2">
                    <span>{formatDate(h.observed_at)} · {KIND_LABEL[h.kind]}{(h.store as unknown as { name: string } | null)?.name ? ` · ${(h.store as unknown as { name: string }).name}` : ""}</span>
                    <span className="tabular">{formatMoney(h.price, h.currency as Currency)}{h.currency !== "EUR" && h.price_eur != null ? ` (≈ ${formatMoney(h.price_eur, "EUR")})` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Aucun prix relevé.</p>}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold">Chercher ce produit</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {marketSearchLinks(p.jan_code ?? `スーパーダイバーズ ${p.name_ja}`).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 hover:border-gold">{l.label}</a>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
