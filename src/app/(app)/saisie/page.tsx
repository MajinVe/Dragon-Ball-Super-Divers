import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, Grid, SourceFields } from "@/components/fields";
import { PageHeader } from "@/components/page-header";
import { isAdmin } from "@/lib/admin";
import { ORIGIN_LABEL, PRODUCT_STATUS_LABEL, PRODUCT_TYPE_LABEL, EVENT_LABEL } from "@/lib/catalogue";
import { createClient } from "@/lib/supabase/server";
import { createAnnouncement, createCard, createProduct, createRelease, createSet, importCards } from "./actions";
import { AssistedEntry } from "./assisted";

export const dynamic = "force-dynamic";

const TABS = [
  ["assistee", "Saisie assistée"],
  ["serie", "Série"],
  ["carte", "Carte"],
  ["import", "Import CSV"],
  ["produit", "Produit"],
  ["sortie", "Date de sortie"],
  ["annonce", "Annonce"],
] as const;

export default async function SaisiePage({ searchParams }: { searchParams: Promise<{ onglet?: string; carte?: string }> }) {
  const { onglet = "assistee", carte } = await searchParams;
  const supabase = await createClient();
  const admin = await isAdmin(supabase);

  if (!admin) {
    return (
      <div>
        <PageHeader title="Saisie" />
        <p className="text-muted">Seul le compte administrateur peut enregistrer des données.</p>
      </div>
    );
  }

  const [{ data: sets }, { data: products }, { data: stores }, { data: rarities }] = await Promise.all([
    supabase.from("card_sets").select("id, code, name_ja, name_fr").order("series_number", { ascending: false, nullsFirst: false }),
    supabase.from("products").select("id, name_ja, name_fr, type").order("created_at", { ascending: false }),
    supabase.from("stores").select("id, name").eq("active", true).order("name"),
    supabase.from("rarities").select("code").order("sort_order", { ascending: false }),
  ]);
  const setOpts = (sets ?? []).map((x) => ({ id: x.id, label: `${x.code} · ${x.name_fr ?? x.name_ja}` }));
  const productOpts = (products ?? []).map((p) => ({ id: p.id, label: `${PRODUCT_TYPE_LABEL[p.type]} · ${p.name_fr ?? p.name_ja}` }));
  const storeOpts = (stores ?? []).map((st) => ({ id: st.id, label: st.name }));

  const SetSelect = ({ required = false }: { required?: boolean }) => (
    <select name="set_id" className="field" defaultValue="" required={required}>
      <option value="">{required ? "Choisir…" : "Aucune"}</option>
      {setOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div>
      <PageHeader title="Saisie" intro="Chaque information est enregistrée avec sa source et son niveau de fiabilité. Rien n’est inventé : un champ inconnu reste vide." />

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Type de saisie">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/saisie?onglet=${k}`} aria-current={onglet === k ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${onglet === k ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {l}
          </Link>
        ))}
      </nav>

      <section className="max-w-3xl panel p-5 sm:p-6">
        {onglet === "assistee" && <AssistedEntry stores={storeOpts} products={productOpts} initialCard={carte} />}

        {onglet === "serie" && (
          <ActionForm action={createSet} submitLabel="Enregistrer la série">
            <Grid>
              <Field label="Code" hint="Tel qu’il apparaît dans les numéros, ex. SDV8"><input name="code" required className="field" /></Field>
              <Field label="Numéro de série (弾)"><input name="series_number" inputMode="numeric" className="field" /></Field>
              <Field label="Nom japonais officiel"><input name="name_ja" required className="field" /></Field>
              <Field label="Nom français (si disponible)"><input name="name_fr" className="field" /></Field>
              <Field label="Nombre total de cartes annoncé"><input name="total_cards" inputMode="numeric" className="field" /></Field>
              <Field label="Date de publication de l’info"><input name="published_at" type="date" className="field" /></Field>
            </Grid>
            <Field label="Visuel (adresse de l’image officielle)"><input name="image_url" type="url" className="field" /></Field>
            <SourceFields />
            <p className="text-xs text-muted">La date de sortie s’ajoute dans l’onglet « Date de sortie », pour distinguer officiel et estimation.</p>
          </ActionForm>
        )}

        {onglet === "carte" && (
          <ActionForm action={createCard} submitLabel="Enregistrer la carte">
            <Grid>
              <Field label="Série"><SetSelect /></Field>
              <Field label="Numéro" hint="ex. SDV8-035"><input name="card_number" required className="field" /></Field>
              <Field label="Nom japonais"><input name="name_ja" required className="field" /></Field>
              <Field label="Nom français"><input name="name_fr" className="field" /></Field>
              <Field label="Personnage (japonais)"><input name="character_ja" className="field" /></Field>
              <Field label="Personnage (français)"><input name="character_fr" className="field" /></Field>
              <Field label="Rareté" hint="Choisis ou saisis un nouveau code.">
                <input name="rarity_code" list="rarities" className="field" />
                <datalist id="rarities">{(rarities ?? []).map((r) => <option key={r.code} value={r.code} />)}</datalist>
              </Field>
              <Field label="Origine">
                <select name="origin" defaultValue="borne" className="field">
                  {Object.entries(ORIGIN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Variante" hint="Vide pour la version normale"><input name="variant" className="field" /></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="is_parallel" /> Carte parallèle</label>
            </Grid>
            <Field label="Image (adresse)"><input name="image_url" type="url" className="field" /></Field>
            <SourceFields />
          </ActionForm>
        )}

        {onglet === "import" && (
          <ActionForm action={importCards} submitLabel="Importer les cartes">
            <Field label="Série de rattachement"><SetSelect /></Field>
            <Field label="Contenu CSV" hint="En-têtes reconnus : numero ; nom_ja ; nom_fr ; personnage_ja ; personnage_fr ; rarete ; variante ; parallele ; origine ; image. Séparateur « ; » ou « , ». Une carte existante (même numéro et variante) est mise à jour.">
              <textarea name="csv" rows={10} className="field font-mono text-xs" placeholder={"numero;nom_ja;nom_fr;personnage_ja;rarete;parallele\nSDV8-035;孫悟空;Son Goku;孫悟空;GDR;"} />
            </Field>
            <SourceFields />
          </ActionForm>
        )}

        {onglet === "produit" && (
          <ActionForm action={createProduct} submitLabel="Enregistrer le produit">
            <Grid>
              <Field label="Type">
                <select name="type" defaultValue="advance_pack" className="field">
                  {Object.entries(PRODUCT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Série liée"><SetSelect /></Field>
              <Field label="Nom japonais officiel"><input name="name_ja" required className="field" /></Field>
              <Field label="Nom français"><input name="name_fr" className="field" /></Field>
              <Field label="Prix officiel japonais (¥, TTC)"><input name="official_price_jpy" inputMode="numeric" className="field" /></Field>
              <Field label="Cartes par unité"><input name="cards_per_unit" inputMode="numeric" className="field" /></Field>
              <Field label="Statut">
                <select name="status" defaultValue="annonce" className="field">
                  {Object.entries(PRODUCT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Code JAN"><input name="jan_code" inputMode="numeric" className="field" /></Field>
            </Grid>
            <Field label="Contenu"><textarea name="contents" rows={3} className="field" /></Field>
            <Field label="Cartes exclusives (numéros)" hint="Séparés par des virgules. Elles doivent déjà exister dans le catalogue.">
              <input name="exclusive_cards" className="field" />
            </Field>
            <Field label="Visuel (adresse)"><input name="image_url" type="url" className="field" /></Field>
            <SourceFields />
          </ActionForm>
        )}

        {onglet === "sortie" && (
          <ActionForm action={createRelease} submitLabel="Ajouter au calendrier">
            <Grid>
              <Field label="Série"><SetSelect /></Field>
              <Field label="ou Produit">
                <select name="product_id" className="field" defaultValue="">
                  <option value="">Aucun</option>
                  {productOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Événement">
                <select name="event_type" defaultValue="sortie_set" className="field">
                  {Object.entries(EVENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="Région">
                <select name="region" defaultValue="JP" className="field"><option value="JP">Japon</option><option value="FR">France</option></select>
              </Field>
              <Field label="Date" hint="Si seul le mois est connu, saisis le 1er et choisis la précision « mois »."><input name="event_date" type="date" required className="field" /></Field>
              <Field label="Précision">
                <select name="precision" defaultValue="jour" className="field">
                  <option value="jour">Jour exact</option><option value="mois">Mois</option><option value="trimestre">Trimestre</option><option value="annee">Année</option>
                </select>
              </Field>
            </Grid>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_estimate" /> C’est une estimation (non annoncée officiellement)</label>
            <Field label="Remarque"><input name="notes" className="field" /></Field>
            <SourceFields />
          </ActionForm>
        )}

        {onglet === "annonce" && (
          <ActionForm action={createAnnouncement} submitLabel="Enregistrer l’annonce">
            <Grid>
              <Field label="Titre japonais"><input name="title_ja" className="field" /></Field>
              <Field label="Titre français"><input name="title_fr" className="field" /></Field>
              <Field label="Type">
                <select name="kind" defaultValue="autre" className="field">
                  <option value="nouvelle_serie">Nouvelle série</option><option value="advance_pack">Advance Pack</option>
                  <option value="produit">Produit</option><option value="cartes">Cartes</option>
                  <option value="evenement">Événement</option><option value="autre">Autre</option>
                </select>
              </Field>
              <Field label="Date de publication"><input name="published_at" type="date" className="field" /></Field>
              <Field label="Série liée"><SetSelect /></Field>
              <Field label="Adresse de l’annonce"><input name="url" type="url" className="field" /></Field>
            </Grid>
            <Field label="Résumé"><textarea name="summary" rows={3} className="field" /></Field>
            <SourceFields />
          </ActionForm>
        )}
      </section>
    </div>
  );
}
