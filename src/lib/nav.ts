import {
  Bell, BookOpenCheck, CalendarDays, ChartLine, Eye, Gauge, Layers, PackageOpen, Settings, Store,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "Tableau de bord", icon: Gauge, mobile: true },
  { href: "/sorties", label: "Sorties", icon: CalendarDays, mobile: true },
  { href: "/advance-packs", label: "Advance Packs", icon: PackageOpen },
  { href: "/cartes", label: "Cartes de borne", icon: Layers, mobile: true },
  { href: "/boutiques", label: "Boutiques", icon: Store },
  { href: "/prix", label: "Prix", icon: ChartLine },
  { href: "/collection", label: "Ma collection", icon: BookOpenCheck, mobile: true },
  { href: "/surveillance", label: "Ma surveillance", icon: Eye },
  { href: "/alertes", label: "Alertes", icon: Bell },
  { href: "/parametres", label: "Paramètres", icon: Settings },
] as const;

/** Modules pas encore développés : affichés honnêtement comme tels. */
export const PENDING_MODULES: Record<string, { title: string; step: string; what: string }> = {
  sorties: {
    title: "Sorties et extensions",
    step: "Étape 4",
    what: "Calendrier chronologique des sorties japonaises et françaises, fiches de séries, statuts et boutiques associées.",
  },
  "advance-packs": {
    title: "Advance Packs",
    step: "Étape 4",
    what: "Liste des Advance Packs avec contenu, prix officiel japonais, cartes exclusives et comparaison des boutiques.",
  },
  cartes: {
    title: "Cartes de borne",
    step: "Étape 4",
    what: "Recherche par personnage, numéro, série, rareté, mot-clé japonais ou prix, avec fiche détaillée par carte.",
  },
  boutiques: {
    title: "Boutiques",
    step: "Étape 6",
    what: "Produits détectés dans chaque boutique, disponibilité, frais de port et date de dernière vérification.",
  },
  prix: {
    title: "Suivi des prix",
    step: "Étape 6",
    what: "Historique graphique, minimum, moyenne, maximum, évolution sur 7 et 30 jours, ventes conclues séparées des annonces.",
  },
  collection: {
    title: "Ma collection",
    step: "Étape 5",
    what: "Checklist par set, cartes gradées, produits scellés, valorisation et import/export CSV.",
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
  parametres: {
    title: "Paramètres",
    step: "Étape 7",
    what: "Adresse de notification, webhooks Discord et Telegram, devise d'affichage.",
  },
};
