import {
  Bell, BookOpenCheck, CalendarDays, ChartLine, Eye, Gauge, Layers, Library, PackageOpen, PencilLine, Settings, Store,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Tableau de bord", short: "Accueil", icon: Gauge, mobile: true },
  { href: "/sorties", label: "Sorties", short: "Sorties", icon: CalendarDays, mobile: true },
  { href: "/series", label: "Séries", short: "Séries", icon: Library },
  { href: "/cartes", label: "Cartes de borne", short: "Cartes", icon: Layers, mobile: true },
  { href: "/advance-packs", label: "Advance Packs", short: "Packs", icon: PackageOpen },
  { href: "/boutiques", label: "Boutiques", short: "Boutiques", icon: Store },
  { href: "/prix", label: "Prix", short: "Prix", icon: ChartLine },
  { href: "/collection", label: "Ma collection", short: "Collection", icon: BookOpenCheck, mobile: true },
  { href: "/surveillance", label: "Ma surveillance", short: "Surveillance", icon: Eye },
  { href: "/alertes", label: "Alertes", short: "Alertes", icon: Bell },
  { href: "/saisie", label: "Saisie", short: "Saisie", icon: PencilLine },
  { href: "/parametres", label: "Paramètres", short: "Paramètres", icon: Settings },
] as const;

/** Modules pas encore développés : affichés honnêtement comme tels. */
export const PENDING_MODULES: Record<string, { title: string; step: string; what: string }> = {
  boutiques: {
    title: "Boutiques",
    step: "Étape 6",
    what: "Produits détectés dans chaque boutique, disponibilité, frais de port et date de dernière vérification. En attendant, les annonces ajoutées via la saisie assistée apparaissent sur les fiches cartes et produits.",
  },
  prix: {
    title: "Suivi des prix",
    step: "Étape 6",
    what: "Historique graphique, minimum, moyenne, maximum, évolution sur 7 et 30 jours. Les statistiques par carte sont déjà visibles sur chaque fiche carte.",
  },
  collection: {
    title: "Ma collection",
    step: "Étape 5",
    what: "Checklist par série, cartes gradées, produits scellés, valorisation et import/export CSV.",
  },
  surveillance: {
    title: "Ma surveillance",
    step: "Étape 7",
    what: "Cartes, produits et boutiques suivis, avec prix maximum souhaité.",
  },
  alertes: {
    title: "Alertes",
    step: "Étape 7",
    what: "Règles d'alerte par carte, produit ou boutique, notifications dans l'application, par email, Discord ou Telegram.",
  },
};
