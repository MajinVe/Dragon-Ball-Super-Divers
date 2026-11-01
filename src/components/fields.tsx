export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

const RELIABILITY = [
  ["officiel", "Officiel (Bandai, site ou compte officiel)"],
  ["boutique", "Boutique"],
  ["estimation", "Estimation"],
  ["non_verifie", "Non vérifié"],
] as const;

/** Bloc commun à toute saisie : d'où vient l'information et quel crédit lui accorder. */
export function SourceFields({ defaultReliability = "officiel", defaultUrl = "" }: { defaultReliability?: string; defaultUrl?: string }) {
  return (
    <Grid>
      <Field label="Adresse de la source" hint="Page où l’information est publiée. Obligatoire sauf pour « Non vérifié ».">
        <input name="source_url" type="url" defaultValue={defaultUrl} className="field" placeholder="https://" />
      </Field>
      <Field label="Fiabilité">
        <select name="reliability" defaultValue={defaultReliability} className="field">
          {RELIABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
    </Grid>
  );
}
