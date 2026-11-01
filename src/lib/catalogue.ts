export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  booster: "Booster",
  advance_pack: "Advance Pack",
  first_pack: "First Pack",
  display: "Display",
  coffret: "Coffret",
  edition_limitee: "Édition limitée",
  evenementiel: "Produit événementiel",
  livre: "Livre / guide",
  accessoire: "Accessoire",
  autre: "Autre",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  annonce: "Annoncé",
  precommande: "Précommande",
  disponible: "Disponible",
  epuise: "Épuisé",
};

export const ORIGIN_LABEL: Record<string, string> = {
  borne: "Borne",
  advance_pack: "Advance Pack",
  first_pack: "First Pack",
  promo: "Promotionnelle",
  evenement: "Événement",
  livre: "Livre",
  autre: "Autre",
};

export const EVENT_LABEL: Record<string, string> = {
  sortie_set: "Sortie de série",
  sortie_produit: "Sortie de produit",
  ouverture_precommande: "Ouverture des précommandes",
  evenement: "Événement",
};

export const KIND_LABEL: Record<string, string> = {
  annonce: "Prix affiché",
  vente_conclue: "Vente conclue",
  prix_officiel: "Prix officiel",
};

export const AVAILABILITY_LABEL: Record<string, string> = {
  en_stock: "En stock",
  rupture: "Rupture",
  precommande: "Précommande",
  inconnu: "Inconnue",
};

/** Liens de recherche manuelle sur les places de marché japonaises (ouverts par l'utilisateur). */
export function marketSearchLinks(terms: string) {
  const q = encodeURIComponent(terms);
  return [
    { label: "Mercari (en vente)", url: `https://jp.mercari.com/search?keyword=${q}` },
    { label: "Mercari (vendues)", url: `https://jp.mercari.com/search?keyword=${q}&status=sold_out` },
    { label: "Yahoo! Auctions (en cours)", url: `https://auctions.yahoo.co.jp/search/search?p=${q}` },
    { label: "Yahoo! Auctions (terminées)", url: `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${q}` },
    { label: "eBay (vendues)", url: `https://www.ebay.fr/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1` },
  ];
}

export function cardName(c: { name_fr?: string | null; name_ja?: string | null }) {
  return c.name_fr || c.name_ja || "Sans nom";
}
