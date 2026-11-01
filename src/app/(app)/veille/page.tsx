import { ActionForm } from "@/components/action-form";
import { Field, Grid } from "@/components/fields";
import { PageHeader } from "@/components/page-header";
import { ReliabilityBadge } from "@/components/reliability-badge";
import { isAdmin } from "@/lib/admin";
import { PRODUCT_TYPE_LABEL } from "@/lib/catalogue";
import { formatDate, formatMoney, formatRelative, type Currency, type Reliability } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { acceptDetection, addWatchSource, rejectAll, rejectDetection, scanNow } from "./actions";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  nouvelle_serie: "Nouvelle série", advance_pack: "Advance Pack", produit: "Produit", evenement: "Événement", annonce: "Annonce",
};

export default async function VeillePage() {
  const supabase = await createClient();
  const admin = await isAdmin(supabase);
  const [{ data: pending }, { data: sources }, { data: products }, { data: stores }] = await Promise.all([
    supabase.from("detections").select("*, source:watch_sources(name, store_id)").eq("status", "en_attente").order("published_at", { ascending: false, nullsFirst: false }).order("detected_at", { ascending: false }).limit(100),
    supabase.from("watch_sources").select("*").order("created_at"),
    supabase.from("products").select("id, name_ja, name_fr, type").order("created_at", { ascending: false }),
    supabase.from("stores").select("id, name").order("name"),
  ]);

  return (
    <div>
      <PageHeader title="À valider" intro="Le scanner lit chaque jour les sources surveillées. Chaque nouveauté t’est proposée ici : tu la valides pour l’enregistrer, ou tu la rejettes si c’est une fausse information ou sans intérêt.">
        {admin && (
          <div className="flex flex-wrap gap-2">
            <ActionForm action={scanNow} submitLabel="Scanner maintenant"><span className="hidden" /></ActionForm>
          </div>
        )}
      </PageHeader>

      {!pending?.length ? (
        <p className="bubble text-muted">Rien à valider pour l’instant. Le prochain scan automatique a lieu chaque jour vers 16 h (heure UTC).</p>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-lg">{pending.length} détection{pending.length > 1 ? "s" : ""} en attente</p>
            {admin && <form action={rejectAll}><button className="rounded-[4px] border-2 border-line px-3 py-1.5 text-sm text-muted hover:border-down hover:text-down">Tout ignorer</button></form>}
          </div>
          <ul className="space-y-4">
            {pending.map((d) => {
              const src = d.source as { name: string; store_id: string | null } | null;
              const isOffer = d.price != null && src?.store_id;
              return (
                <li key={d.id} className="panel p-4">
                  <div className="flex gap-4">
                    {d.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_url} alt="" className="hidden h-24 w-36 shrink-0 rounded-[4px] border-2 border-line object-cover sm:block" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-display -rotate-2 bg-orange px-1.5 py-0.5 text-[#141414]">{KIND[d.kind] ?? d.kind}</span>
                        <ReliabilityBadge level={d.reliability as Reliability} />
                        <span className="text-muted">{src?.name} · {d.published_at ? formatDate(d.published_at) : `détecté ${formatRelative(d.detected_at)}`}</span>
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" className="mt-1.5 block font-medium leading-snug hover:text-gold">{d.title}</a>
                      {d.price != null && (
                        <p className="tabular mt-1 text-sm">{formatMoney(d.price, (d.currency ?? "EUR") as Currency)} · {d.available === false ? "rupture" : "disponible"}</p>
                      )}
                    </div>
                  </div>
                  {admin && (
                    <div className="mt-3 grid gap-3 border-t-2 border-dashed border-line pt-3 md:grid-cols-[1fr_auto] md:items-end">
                      <ActionForm action={acceptDetection} submitLabel="Valider et remplir">
                        <input type="hidden" name="id" value={d.id} />
                        {isOffer ? (
                          <Grid>
                            <Field label="Rattacher au produit">
                              <select name="product_id" className="field" defaultValue="">
                                <option value="">Aucun</option>
                                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{PRODUCT_TYPE_LABEL[p.type]} · {p.name_fr ?? p.name_ja}</option>)}
                              </select>
                            </Field>
                            <Field label="ou à la carte (numéro)"><input name="card_number" className="field" placeholder="SDV13-045" /></Field>
                          </Grid>
                        ) : (
                          <Field label="Titre en français (facultatif)"><input name="title_fr" className="field" /></Field>
                        )}
                      </ActionForm>
                      <form action={rejectDetection}>
                        <input type="hidden" name="id" value={d.id} />
                        <button className="w-full rounded-[4px] border-2 border-down/60 px-4 py-2.5 text-sm text-down hover:bg-down/10">Fausse info / ignorer</button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xl">Sources surveillées</h2>
        <ul className="mb-5 space-y-2">
          {(sources ?? []).map((s) => (
            <li key={s.id} className="panel panel-sm flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="min-w-0">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:text-gold">{s.name}</a>
                <span className="block text-xs text-muted">{s.parser === "dbsdv_news" ? "Actualités officielles" : s.parser === "shopify" ? "Catalogue boutique (Shopify)" : s.parser === "rss" ? "Flux RSS" : "Page web"}{s.keywords ? ` · filtre : ${s.keywords}` : ""}</span>
              </span>
              <span className={`text-xs ${s.last_error ? "text-down" : "text-muted"}`}>
                {s.last_error ? `Erreur : ${s.last_error}` : s.last_scan_at ? `Lu ${formatRelative(s.last_scan_at)}` : "Jamais lu"}
              </span>
            </li>
          ))}
        </ul>
        {admin && (
          <details className="panel p-5">
            <summary className="cursor-pointer font-display">Ajouter une source</summary>
            <div className="mt-4">
              <ActionForm action={addWatchSource} submitLabel="Ajouter">
                <Grid>
                  <Field label="Nom"><input name="name" className="field" placeholder="Japandco" /></Field>
                  <Field label="Adresse"><input name="url" type="url" required className="field" placeholder="https://" /></Field>
                  <Field label="Type" hint="Shopify : la plupart des petites boutiques (lit /products.json).">
                    <select name="parser" defaultValue="shopify" className="field">
                      <option value="shopify">Boutique Shopify</option><option value="rss">Flux RSS</option><option value="page">Page web (liens)</option>
                    </select>
                  </Field>
                  <Field label="Mots-clés à retenir" hint="Séparés par des virgules"><input name="keywords" defaultValue="divers, ダイバーズ, SDV" className="field" /></Field>
                  <Field label="Boutique liée (pour les prix)">
                    <select name="store_id" className="field" defaultValue="">
                      <option value="">Aucune</option>
                      {(stores ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Devise des prix">
                    <select name="currency" defaultValue="EUR" className="field"><option value="EUR">Euro</option><option value="JPY">Yen</option><option value="USD">Dollar</option></select>
                  </Field>
                  <Field label="Fiabilité">
                    <select name="reliability" defaultValue="boutique" className="field">
                      <option value="officiel">Officiel</option><option value="boutique">Boutique</option><option value="non_verifie">Non vérifié</option>
                    </select>
                  </Field>
                </Grid>
              </ActionForm>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
