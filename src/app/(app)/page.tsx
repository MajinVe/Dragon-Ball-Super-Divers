import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { RarityBadge } from "@/components/rarity-badge";
import { Empty, Panel } from "@/components/panel";
import { ReliabilityBadge } from "@/components/reliability-badge";
import {
  formatDate, formatMoney, formatRelative, jpyToEur,
  type Currency, type FxRate, type Reliability,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Listing = {
  title: string; url: string; price: number | null; currency: Currency;
  availability: string; store: { name: string } | null;
};

const EVENT_LABEL: Record<string, string> = {
  sortie_set: "Sortie de série",
  sortie_produit: "Sortie de produit",
  ouverture_precommande: "Ouverture des précommandes",
  evenement: "Événement",
};

const PRODUCT_STATUS: Record<string, string> = {
  annonce: "Annoncé", precommande: "Précommande", disponible: "Disponible", epuise: "Épuisé",
};

function Price({ amount, currency, fx }: { amount: number | null; currency: Currency; fx: FxRate }) {
  const eur = currency === "JPY" ? jpyToEur(amount, fx) : null;
  return (
    <span className="tabular text-right">
      {formatMoney(amount, currency)}
      {eur !== null && <span className="block text-xs text-muted">≈ {formatMoney(eur, "EUR")}</span>}
    </span>
  );
}

function Failed({ message }: { message: string }) {
  return <p className="text-sm text-down">Lecture impossible : {message}</p>;
}

export default async function Dashboard() {
  const supabase = await createClient();

  const [releases, announcements, newListings, priceMoves, preorders, advancePacks, cards, fx, collection] =
    await Promise.all([
      supabase.from("upcoming_releases")
        .select("id, event_type, event_date, precision, is_estimate, reliability, region, set_name, set_code, product_name, source_name, source_url")
        .limit(5),
      supabase.from("announcements")
        .select("id, title_fr, title_ja, url, published_at, detected_at, reliability")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(5),
      supabase.from("market_events")
        .select("id, created_at, listing:product_listings(title, url, price, currency, availability, store:stores(name))")
        .eq("type", "nouveau_listing").order("created_at", { ascending: false }).limit(6),
      supabase.from("market_events")
        .select("id, type, created_at, old_price, new_price, currency, listing:product_listings(title, url, price, currency, availability, store:stores(name))")
        .in("type", ["variation_prix", "retour_stock"]).order("created_at", { ascending: false }).limit(6),
      supabase.from("product_listings")
        .select("id, title, url, price, currency, availability, store:stores(name)")
        .eq("availability", "precommande").eq("is_active", true)
        .order("last_checked_at", { ascending: false }).limit(5),
      supabase.from("products")
        .select("id, name_fr, name_ja, status, official_price_jpy, reliability")
        .eq("type", "advance_pack").order("created_at", { ascending: false }).limit(4),
      supabase.from("cards")
        .select("id, card_number, name_fr, name_ja, rarity_code, reliability")
        .order("created_at", { ascending: false }).limit(6),
      supabase.from("fx_rates").select("rate_date, jpy_per_eur").order("rate_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("my_collection").select("quantite, investi_eur, valeur_totale_eur, base_valorisation"),
    ]);
  const { data: settings } = await supabase.from("user_settings").select("hero_image_url").maybeSingle();
  const heroImage = settings?.hero_image_url ?? null;

  const rate: FxRate = fx.data ? { rate_date: fx.data.rate_date, jpy_per_eur: Number(fx.data.jpy_per_eur) } : null;
  const next = releases.data?.[0];
  const later = releases.data?.slice(1) ?? [];

  const owned = collection.data ?? [];
  const totalCards = owned.reduce((s, r) => s + Number(r.quantite ?? 0), 0);
  const totalValue = owned.reduce((s, r) => s + Number(r.valeur_totale_eur ?? 0), 0);
  const invested = owned.reduce((s, r) => s + Number(r.investi_eur ?? 0), 0);
  const unvalued = owned.filter((r) => r.base_valorisation === "aucune_donnee").length;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Tableau de bord</h1>

      <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
        {/* Prochaine sortie */}
        <section className="panel panel-hero burst p-6 sm:p-8">
          {heroImage && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--surface)_0%,color-mix(in_oklab,var(--surface)_85%,transparent)_45%,transparent_100%)]" />
            </>
          )}
          <span aria-hidden className="sfx pointer-events-none absolute bottom-5 right-6 hidden text-[4.2rem] md:block xl:text-[5rem]">ゴォッ!!</span>
          <div className="relative">
            <p className="inline-block -rotate-2 bg-ink px-2 py-0.5 font-display text-sm text-bg">Prochaine sortie</p>
            {releases.error ? (
              <Failed message={releases.error.message} />
            ) : next ? (
              <>
                <h2 className="mt-2 max-w-[18ch] text-[1.8rem] leading-tight sm:text-[2.4rem]">
                  {next.set_name ?? next.product_name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>{EVENT_LABEL[next.event_type]}</span>
                  <span aria-hidden>/</span>
                  <span>{next.region === "JP" ? "Japon" : "France"}, {formatDate(next.event_date, next.precision)}</span>
                  <ReliabilityBadge level={next.is_estimate ? "estimation" : (next.reliability as Reliability)} />
                </div>
                <div className="mt-7">
                  {next.precision === "jour" ? (
                    <Countdown date={next.event_date} />
                  ) : (
                    <p className="text-sm text-muted">Date annoncée au {next.precision} : pas de compte à rebours tant que le jour exact n’est pas connu.</p>
                  )}
                </div>
                {next.source_url && (
                  <a href={next.source_url} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm text-muted underline-offset-4 hover:text-gold hover:underline">
                    Source : {next.source_name}
                  </a>
                )}
              </>
            ) : (
              <>
                <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight">Aucune sortie enregistrée</h2>
                <p className="mt-3 max-w-[46ch] leading-relaxed text-muted">
                  Ajoute la prochaine sortie officielle depuis la saisie : le compte à rebours démarrera automatiquement.
                </p>
              </>
            )}
            {later.length > 0 && (
              <ul className="mt-7 space-y-2 border-t border-line pt-4 text-sm">
                {later.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{r.set_name ?? r.product_name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted">
                      {formatDate(r.event_date, r.precision)}
                      {r.is_estimate && <ReliabilityBadge level="estimation" />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="grid gap-5">
          {/* Collection */}
          <Panel title="Ma collection" href="/collection" linkLabel="Ouvrir">
            {collection.error ? <Failed message={collection.error.message} /> : totalCards === 0 ? (
              <Empty>Aucune carte enregistrée. L’ajout et l’import CSV arrivent avec le module Collection.</Empty>
            ) : (
              <div>
                <p className="tabular text-3xl font-semibold tracking-tight">{formatMoney(totalValue, "EUR")}</p>
                <p className="mt-1 text-sm text-muted">
                  {totalCards} carte{totalCards > 1 ? "s" : ""}, {formatMoney(invested, "EUR")} investis
                  {unvalued > 0 && `, ${unvalued} sans cote disponible`}
                </p>
              </div>
            )}
          </Panel>

          {/* Taux de change */}
          <Panel title="Taux JPY / EUR">
            {rate ? (
              <div>
                <p className="tabular text-2xl font-semibold">1 € = {rate.jpy_per_eur.toLocaleString("fr-FR")} ¥</p>
                <p className="mt-1 text-sm text-muted">
                  Taux de référence BCE du {formatDate(rate.rate_date)}. 1 000 ¥ ≈ {formatMoney(1000 / rate.jpy_per_eur, "EUR")}.
                </p>
              </div>
            ) : (
              <Empty>Aucun taux enregistré. Il est récupéré chaque jour à 16 h (UTC) auprès de la BCE ; les prix en yens ne sont pas convertis d’ici là.</Empty>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Dernières annonces" href="/saisie?onglet=annonce" linkLabel="Ajouter">
          {announcements.error ? <Failed message={announcements.error.message} /> : announcements.data?.length ? (
            <ul className="divide-y divide-line">
              {announcements.data.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                  <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-gold">
                    <span className="line-clamp-2">{a.title_fr ?? a.title_ja}</span>
                    <span className="text-xs text-muted">{formatRelative(a.published_at ?? a.detected_at)}</span>
                  </a>
                  <ReliabilityBadge level={a.reliability as Reliability} />
                </li>
              ))}
            </ul>
          ) : <Empty>Aucune annonce enregistrée pour l’instant.</Empty>}
        </Panel>

        <Panel title="Advance Packs" href="/advance-packs">
          {advancePacks.error ? <Failed message={advancePacks.error.message} /> : advancePacks.data?.length ? (
            <ul className="divide-y divide-line">
              {advancePacks.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/produits/${p.id}`} className="min-w-0 hover:text-gold">
                    <span className="block truncate">{p.name_fr ?? p.name_ja}</span>
                    <span className="text-xs text-muted">
                      {PRODUCT_STATUS[p.status]}
                      {p.official_price_jpy && `, ${formatMoney(p.official_price_jpy, "JPY")} prix officiel`}
                    </span>
                  </Link>
                  <ReliabilityBadge level={p.reliability as Reliability} />
                </li>
              ))}
            </ul>
          ) : <Empty>Aucun Advance Pack enregistré. Ajoute-le depuis la saisie, onglet Produit.</Empty>}
        </Panel>

        <Panel title="Nouveautés en boutique" href="/boutiques">
          {newListings.error ? <Failed message={newListings.error.message} /> : newListings.data?.length ? (
            <ul className="divide-y divide-line">
              {newListings.data.map((e) => {
                const l = e.listing as unknown as Listing | null;
                if (!l) return null;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-gold">
                      <span className="block truncate">{l.title}</span>
                      <span className="text-xs text-muted">{l.store?.name}, {formatRelative(e.created_at)}</span>
                    </a>
                    <Price amount={l.price} currency={l.currency} fx={rate} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty>Aucun produit détecté. La surveillance des boutiques sera branchée à l’étape 6.</Empty>}
        </Panel>

        <Panel title="Mouvements de prix et retours en stock" href="/prix">
          {priceMoves.error ? <Failed message={priceMoves.error.message} /> : priceMoves.data?.length ? (
            <ul className="divide-y divide-line">
              {priceMoves.data.map((e) => {
                const l = e.listing as unknown as Listing | null;
                const down = e.old_price !== null && e.new_price !== null && Number(e.new_price) < Number(e.old_price);
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate">{l?.title ?? "Annonce supprimée"}</span>
                      <span className="text-xs text-muted">{l?.store?.name}, {formatRelative(e.created_at)}</span>
                    </span>
                    {e.type === "retour_stock" ? (
                      <span className="shrink-0 text-sm text-up">De retour en stock</span>
                    ) : (
                      <span className={`tabular shrink-0 text-sm ${down ? "text-up" : "text-down"}`}>
                        {formatMoney(e.old_price, e.currency as Currency)} vers {formatMoney(e.new_price, e.currency as Currency)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <Empty>Aucun mouvement enregistré.</Empty>}
        </Panel>

        <Panel title="Précommandes ouvertes" href="/boutiques">
          {preorders.error ? <Failed message={preorders.error.message} /> : preorders.data?.length ? (
            <ul className="divide-y divide-line">
              {preorders.data.map((l) => {
                const store = l.store as unknown as { name: string } | null;
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 hover:text-gold">
                      <span className="block truncate">{l.title}</span>
                      <span className="text-xs text-muted">{store?.name}</span>
                    </a>
                    <Price amount={l.price} currency={l.currency as Currency} fx={rate} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty>Aucune précommande ouverte détectée.</Empty>}
        </Panel>

        <Panel title="Dernières cartes ajoutées" href="/cartes">
          {cards.error ? <Failed message={cards.error.message} /> : cards.data?.length ? (
            <ul className="divide-y divide-line">
              {cards.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/cartes/${c.id}`} className="min-w-0 hover:text-gold">
                    <span className="block truncate">{c.name_fr ?? c.name_ja}</span>
                    <span className="font-display tabular text-xs text-muted">{c.card_number}</span>
                  </Link>
                  <RarityBadge code={c.rarity_code} />
                </li>
              ))}
            </ul>
          ) : <Empty>Le catalogue est vide. Ajoute des cartes ou importe une liste officielle depuis la saisie.</Empty>}
        </Panel>
      </div>
    </div>
  );
}
