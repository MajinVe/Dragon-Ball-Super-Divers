import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { saveBranding } from "./actions";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const supabase = await createClient();
  const { data: st } = await supabase.from("user_settings").select("logo_url, hero_image_url").maybeSingle();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Paramètres" />
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold">Habillage</h2>
        <p className="mb-5 text-sm text-muted">Colle l’adresse d’une image (lien direct vers un fichier .png, .jpg ou .webp). Le logo remplace celui de la barre latérale, l’image d’ambiance s’affiche derrière la prochaine sortie. Laisse vide pour revenir à l’habillage par défaut.</p>
        <ActionForm action={saveBranding} submitLabel="Enregistrer">
          <Field label="Logo"><input name="logo_url" type="url" defaultValue={st?.logo_url ?? ""} className="field" placeholder="https://" /></Field>
          <Field label="Image d’ambiance du tableau de bord"><input name="hero_image_url" type="url" defaultValue={st?.hero_image_url ?? ""} className="field" placeholder="https://" /></Field>
        </ActionForm>
      </section>
      <section className="mt-5 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        Notifications (email, Discord, Telegram) et devise d’affichage : prévues à l’étape 7.
      </section>
    </div>
  );
}
