export type Currency = "JPY" | "EUR" | "USD";
export type Reliability = "officiel" | "boutique" | "estimation" | "non_verifie";

const TZ = "Europe/Paris";

export function formatDate(value: string | null | undefined, precision: string = "jour") {
  if (!value) return "Date inconnue";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (precision === "annee") return d.toLocaleDateString("fr-FR", { year: "numeric", timeZone: "UTC" });
  if (precision === "mois" || precision === "trimestre") {
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
    return precision === "trimestre" ? `Trimestre de ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (diff < 3600) return rtf.format(-Math.max(1, Math.round(diff / 60)), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

export function formatMoney(amount: number | string | null | undefined, currency: Currency) {
  if (amount === null || amount === undefined) return "Prix non communiqué";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(Number(amount));
}

export type FxRate = { rate_date: string; jpy_per_eur: number } | null;

/** Conversion toujours explicite : renvoie null si aucun taux n'est disponible. */
export function jpyToEur(amount: number | string | null | undefined, fx: FxRate) {
  if (amount === null || amount === undefined || !fx) return null;
  return Number(amount) / Number(fx.jpy_per_eur);
}

export const RELIABILITY_LABEL: Record<Reliability, string> = {
  officiel: "Officiel",
  boutique: "Boutique",
  estimation: "Estimation",
  non_verifie: "Non vérifié",
};
