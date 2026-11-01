import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RarityBadge } from "@/components/rarity-badge";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { AVAILABILITY_LABEL, KIND_LABEL, ORIGIN_LABEL, PRODUCT_TYPE_LABEL, cardName, marketSearchLinks } from "@/lib/catalogue";
import { formatDate, formatMoney, formatRelative, jpyToEur, type Currency, type Reliability } from "@/lib/format";
import { getLatestFx } from "@/lib/fx";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASIS: Record<string, string> = {
  ventes_conclues: "Médiane des ventes conclues sur 90 jours",
  annonces: "Plus bas prix affiché sur 30 jours (aucune vente conclue récente)",
  aucune_donnee: "Aucune donnée de prix fiable",
};

export default async function CarteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("cards")
    .select("*, set:card_sets(code, name_ja, name_fr), source:sources(name, url)").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [fx, { data: val }, { data: stats }, { data: hist }, { data: listings }, { data: inProducts }] = await Promise.all([
    getLatestFx(supabase),
    supabase.from("card_valuation").select("*").eq("card_id", id).maybeSingle(),
    supabase.from("card_prices").select("*").eq("card_id", id),
    supabase.from("price_history").select("id, observed_at, kind, price, currency, price_eur, grade_company, grade, url, availability, store:stores(name)")
      .eq("card_id", id).order("observed_at", { ascending: false }).limit(25),
    supabase.from("product_listings").select("id, title, url, price, currency, availability, last_checked_at, store:stores(name)")
      .eq("card_id", id).eq("is_active", true).order("price"),
    supabase.from("product_cards").select("is_exclusive, product:products(id, name_ja, name_fr, type)").eq("card_id", id),
  ]);
  const set = c.set as { code: string; name_ja: string; name_fr: string | null } | null;
  const src = c.source as { name: string; url: string | null } | null;
  const terms = `スーパーダイバーズ ${c.card_number}${c.is_parallel ? " パラレル" : ""}`;

  const stat = (kind: string) => (stats ?? []).find((x) => x.kind === kind);
  const sold = stat("vente_conclue");
  const ask = stat("annonce");

  return (
    <div>
      <PageHeader title={cardName(c)} intro={c.name_fr ? c.name_ja : undefined}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/saisie?onglet=assistee&carte=${encodeURIComponent(c.card_number)}`} className="btn-main px-3 py-2 text-sm">Ajouter un prix</Link>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
            {c.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt={cardName(c)} className="aspect-[5/7] w-full object-cover" />
            ) : (
              <div className="flex aspect-[5/7] items-center justify-center text-sm text-muted">Pas d’image enregistrée</div>
            )}
          </div>
          <dl className="space-y-2 panel p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Numéro</dt><dd className="font-display tabular">{c.card_number}{c.variant ? ` (${c.variant})` : ""}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Rareté</dt><dd><RarityBadge code={c.rarity_code} parallel={c.is_parallel} /></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Série</dt><dd>{set ? <Link href={`/series/${encodeURIComponent(set.code)}`} className="hover:text-gold">{set.code}</Link> : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Personnage</dt><dd className="text-right">{c.character_fr ?? c.character_ja ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Origine</dt><dd>{ORIGIN_LABEL[c.origin]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Fiabilité</dt><dd><ReliabilityBadge level={c.reliability as Reliability} /></dd></div>
            {src?.url && <a href={src.url} target="_blank" rel="noreferrer" className="block pt-1 text-xs text-muted hover:text-gold">Source : {src.name}</a>}
          </dl>
        </div>

        <div className="space-y-6">
          <section className="panel burst p-5">
            <p className="text-sm text-muted">Cote estimée</p>
            <p className="font-display tabular mt-1 text-4xl font-semibold">{val?.valeur_estimee_eur != null ? formatMoney(val.valeur_estimee_eur, "EUR") : "—"}</p>
            <p className="mt-1 text-sm text-muted">{BASIS[val?.base_valorisation ?? "aucune_donnee"]}{val?.nb_ventes_90j ? `, ${val.nb_ventes_90j} vente(s)` : ""}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[["Ventes conclues", sold], ["Prix affichés", ask]].map(([label, x]) => {
                const s = x as Record<string, number | string | null> | undefined;
                return (
                  <div key={label as string} className="rounded-xl border border-line bg-surface/70 p-3 text-sm">
                    <p className="mb-1 font-medium">{label as string}</p>
                    {s ? (
                      <div className="tabular grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted">
                        <span>Min</span><span className="text-ink">{formatMoney(s.prix_min_eur as number, "EUR")}</span>
                        <span>Moyenne</span><span className="text-ink">{formatMoney(s.prix_moyen_eur as number, "EUR")}</span>
                        <span>Max</span><span className="text-ink">{formatMoney(s.prix_max_eur as number, "EUR")}</span>
                        <span>Dernier</span><span className="text-ink">{formatMoney(s.dernier_prix_eur as number, "EUR")}</span>
                        <span>7 jours</span><span className="text-ink">{s.evolution_7j_pct != null ? `${s.evolution_7j_pct} %` : "—"}</span>
                        <span>30 jours</span><span className="text-ink">{s.evolution_30j_pct != null ? `${s.evolution_30j_pct} %` : "—"}</span>
                      </div>
                    ) : <p className="text-muted">Aucune observation.</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Prix convertis au taux BCE du jour de chaque observation. Cartes gradées exclues de ces statistiques.</p>
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold">Annonces actives</h2>
            {listings?.length ? (
              <ul className="divide-y divide-line">
                {listings.map((l) => {
                  const eur = l.currency === "JPY" ? jpyToEur(l.price, fx) : null;
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-gold">
                        <span className="block truncate">{l.title}</span>
                        <span className="text-xs text-muted">{(l.store as unknown as { name: string } | null)?.name} · {AVAILABILITY_LABEL[l.availability]} · vérifié {formatRelative(l.last_checked_at)}</span>
                      </a>
                      <span className="tabular shrink-0 text-right">{formatMoney(l.price, l.currency as Currency)}{eur !== null && <span className="block text-xs text-muted">≈ {formatMoney(eur, "EUR")}</span>}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">Aucune annonce enregistrée.</p>}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold">Historique des prix</h2>
            {hist?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-muted"><tr><th className="py-1.5 font-normal">Date</th><th className="font-normal">Type</th><th className="font-normal">Prix</th><th className="font-normal">En euros</th><th className="font-normal">Origine</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {hist.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2">{formatDate(h.observed_at)}</td>
                        <td>{KIND_LABEL[h.kind]}{h.grade_company ? ` · ${h.grade_company} ${h.grade}` : ""}</td>
                        <td className="tabular">{formatMoney(h.price, h.currency as Currency)}</td>
                        <td className="tabular">{h.price_eur != null ? formatMoney(h.price_eur, "EUR") : <span className="text-muted">taux manquant</span>}</td>
                        <td>{h.url ? <a href={h.url} target="_blank" rel="noreferrer" className="hover:text-gold">{(h.store as unknown as { name: string } | null)?.name ?? "Lien"}</a> : (h.store as unknown as { name: string } | null)?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-muted">Aucun prix relevé pour l’instant.</p>}
          </section>

          {inProducts && inProducts.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 text-lg font-semibold">Présente dans</h2>
              {inProducts.map((pc, i) => {
                const p = pc.product as unknown as { id: string; name_ja: string; name_fr: string | null; type: string };
                return <Link key={i} href={`/produits/${p.id}`} className="block text-sm hover:text-gold">{PRODUCT_TYPE_LABEL[p.type]} · {p.name_fr ?? p.name_ja}{pc.is_exclusive ? " (exclusive)" : ""}</Link>;
              })}
            </section>
          )}

          <section className="panel p-5">
            <h2 className="mb-1 text-lg font-semibold">Chercher cette carte</h2>
            <p className="mb-3 text-sm text-muted">Recherche « {terms} »</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {marketSearchLinks(terms).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1 hover:border-gold">{l.label}</a>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
