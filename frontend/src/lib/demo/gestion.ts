/**
 * Données de démonstration de l'espace gestionnaire, reprises des maquettes G1 à G6.
 * Chaque bloc correspond à une future API du backend (analytics, inventory,
 * production, menu, payments).
 */

/* ---------- G1 · Tableau de bord */

export const VENTES_SEMAINE_PASSEE = [148, 139, 162, 171, 236, 274, 221];
export const PREVISION_SEMAINE = [152, 145, 166, 178, 240, 268, 226];
export const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const KPIS = [
  { libelle: "Chiffre d'affaires net", valeur: "1 245 000", unite: "FCFA", delta: "+8 % vs semaine précédente", tendance: "hausse", icone: "wallet", ton: "vert" },
  { libelle: "Commandes", valeur: "186", unite: "commandes", delta: "+12 commandes", tendance: "hausse", icone: "list", ton: "vert" },
  { libelle: "Panier moyen", valeur: "6 694", unite: "FCFA", delta: "−2 % vs semaine précédente", tendance: "baisse", icone: "bag", ton: "terracotta" },
  { libelle: "Taux d'invendus", valeur: "7,4 %", unite: "du préparé", delta: "−1,2 pt", tendance: "hausse", icone: "flame", ton: "or" },
] as const;

export const TAUX = [
  { libelle: "Taux d'annulation", detail: "désistements inclus", valeur: "4,3 %" },
  { libelle: "Taux de désistement", detail: "dans les 5 minutes", valeur: "2,1 %" },
  { libelle: "Taux de pertes", detail: "jeté / préparé", valeur: "3,1 %" },
];

export const ALERTES_STOCK = [
  { titre: "Stock bas", detail: "Tomates : 2,5 kg restants (seuil 4 kg)", type: "bas" },
  { titre: "Péremption proche", detail: "Crème fraîche, lot du 04/11 : dans 2 jours", type: "peremption" },
  { titre: "Stock bas", detail: "Attiéké : 6 kg restants (seuil 8 kg)", type: "bas" },
] as const;

export const PLUS_VENDUS = [
  { nom: "Kedjenou de poulet", portions: 64 },
  { nom: "Poulet braisé", portions: 51 },
  { nom: "Alloco", portions: 48 },
  { nom: "Garba royal", portions: 6 },
];

/* ---------- G2 · Recettes */

export const RECETTES: Record<string, { ingredient: string; quantite: string; cout: number }[]> = {
  "PLAT-010": [
    { ingredient: "Poulet fermier", quantite: "0,350 kg", cout: 1225 },
    { ingredient: "Tomates", quantite: "0,120 kg", cout: 96 },
    { ingredient: "Oignons", quantite: "0,080 kg", cout: 48 },
    { ingredient: "Aubergine", quantite: "0,060 kg", cout: 42 },
    { ingredient: "Piment frais", quantite: "0,010 kg", cout: 15 },
    { ingredient: "Attiéké", quantite: "0,250 kg", cout: 250 },
    { ingredient: "Huile, épices", quantite: "forfait", cout: 464 },
  ],
};

/* ---------- G3 · Stocks */

export type EtatStock = "bas" | "peremption" | "conforme";

export const STOCKS: {
  ingredient: string;
  restant: string;
  seuil: string;
  lot: string;
  peremption: string;
  etat: EtatStock;
}[] = [
  { ingredient: "Tomates", restant: "2,5 kg", seuil: "4 kg", lot: "L-1107 · 06/11", peremption: "12/11", etat: "bas" },
  { ingredient: "Crème fraîche", restant: "3 L", seuil: "2 L", lot: "L-1104 · 04/11", peremption: "11/11", etat: "peremption" },
  { ingredient: "Attiéké", restant: "6 kg", seuil: "8 kg", lot: "L-1105 · 05/11", peremption: "10/11", etat: "bas" },
  { ingredient: "Poulet fermier", restant: "18 kg", seuil: "10 kg", lot: "L-1108 · 07/11", peremption: "14/11", etat: "conforme" },
  { ingredient: "Capitaine", restant: "7 kg", seuil: "6 kg", lot: "L-1108 · 08/11", peremption: "11/11", etat: "peremption" },
  { ingredient: "Oignons", restant: "12 kg", seuil: "5 kg", lot: "L-1101 · 01/11", peremption: "30/11", etat: "conforme" },
  { ingredient: "Banane plantain", restant: "22 kg", seuil: "10 kg", lot: "L-1106 · 06/11", peremption: "16/11", etat: "conforme" },
  { ingredient: "Huile de palme", restant: "9 L", seuil: "4 L", lot: "L-1020 · 20/10", peremption: "20/04", etat: "conforme" },
  { ingredient: "Fleurs de bissap", restant: "4 kg", seuil: "2 kg", lot: "L-1012 · 12/10", peremption: "12/03", etat: "conforme" },
];

export type TypeMouvement = "entree" | "consommation" | "perte" | "ajustement";

export const MOUVEMENTS: { type: TypeMouvement; ingredient: string; quantite: string; detail: string }[] = [
  { type: "entree", ingredient: "Poulet fermier", quantite: "+20 kg", detail: "Lot L-1108 · Ferme Kouamé · 08/11 09 h 10" },
  { type: "consommation", ingredient: "Tomates", quantite: "−3,1 kg", detail: "Théorique · service du dîner 08/11" },
  { type: "perte", ingredient: "Crème fraîche", quantite: "−1 L", detail: "Péremption · lot L-1029" },
  { type: "ajustement", ingredient: "Oignons", quantite: "−0,4 kg", detail: "Inventaire · Mariam D." },
  { type: "consommation", ingredient: "Attiéké", quantite: "−9,5 kg", detail: "Théorique · service du dîner 08/11" },
  { type: "entree", ingredient: "Capitaine", quantite: "+8 kg", detail: "Lot L-1108 · Port de pêche · 08/11" },
];

/* ---------- G4 · Production et invendus */

export const MOTIFS_INVENDU = ["Faible demande", "Surproduction", "Annulation", "Problème de qualité", "Péremption", "Autre"];

export const PRODUCTION: {
  plat: string;
  prevu: number;
  prepare: number;
  vendu: number | null;
  restant: string;
  reutilisable: string;
  jete: string;
  motif: string;
}[] = [
  { plat: "Kedjenou de poulet", prevu: 30, prepare: 30, vendu: 28, restant: "2", reutilisable: "2", jete: "0", motif: "Faible demande" },
  { plat: "Poisson braisé", prevu: 20, prepare: 18, vendu: 12, restant: "6", reutilisable: "3", jete: "3", motif: "Surproduction" },
  { plat: "Sauce graine", prevu: 18, prepare: 18, vendu: 17, restant: "1", reutilisable: "1", jete: "0", motif: "Faible demande" },
  { plat: "Poulet braisé", prevu: 24, prepare: 24, vendu: 24, restant: "0", reutilisable: "0", jete: "0", motif: "" },
  { plat: "Foutou sauce arachide", prevu: 14, prepare: 14, vendu: 13, restant: "1", reutilisable: "1", jete: "0", motif: "Annulation" },
  { plat: "Alloco", prevu: 40, prepare: 38, vendu: 35, restant: "1", reutilisable: "0", jete: "1", motif: "Problème de qualité" },
  { plat: "Riz gras", prevu: 12, prepare: 12, vendu: null, restant: "", reutilisable: "", jete: "", motif: "" },
];

/* ---------- G5 · Prévisions */

export type StatutReco = "a_valider" | "validee" | "ignoree";

export const RECOMMANDATIONS: {
  id: string;
  type: "augmenter" | "reduire" | "approvisionner";
  etiquette: "Prévision" | "Hypothèse";
  titre: string;
  detail: string;
  confiance: number;
  statut: StatutReco;
}[] = [
  {
    id: "R1",
    type: "augmenter",
    etiquette: "Prévision",
    titre: "Vendredi 13, déjeuner : préparer 18 portions de kedjenou (habituel 14).",
    detail: "Intervalle probable 14 à 22 · 6 semaines de ventes · tendance récente +9 %.",
    confiance: 62,
    statut: "a_valider",
  },
  {
    id: "R2",
    type: "reduire",
    etiquette: "Hypothèse",
    titre: "Mardi 10, dîner : préparer 12 poissons braisés au lieu de 18.",
    detail: "Intervalle 9 à 14 · 6 invendus en moyenne le mardi · cause non observable.",
    confiance: 48,
    statut: "a_valider",
  },
  {
    id: "R3",
    type: "approvisionner",
    etiquette: "Prévision",
    titre: "Commander 12 kg de tomates avant jeudi 12.",
    detail: "Consommation théorique prévue 14,5 kg · stock 2,5 kg · seuil 4 kg.",
    confiance: 78,
    statut: "a_valider",
  },
];

export const MOTIFS_PERTES = [
  { motif: "Surproduction", part: 42, couleur: "#A3481F" },
  { motif: "Faible demande", part: 27, couleur: "#1F3D36" },
  { motif: "Péremption", part: 18, couleur: "#7A5200" },
  { motif: "Problème de qualité", part: 8, couleur: "#5C574E" },
  { motif: "Autre", part: 5, couleur: "#8C857A" },
];

/* ---------- G6 · Clôture de caisse */

export const CAISSE = {
  date: "Dimanche 8 novembre",
  commandesPayees: 94,
  especes: { total: 412500, commandes: 38 },
  carte: { total: 832500, commandes: 56 },
  nonPayees: [
    { numero: "0131", detail: "Table 4 · servie 21 h 12 · espèces", total: 9500 },
    { numero: "0135", detail: "Chambre 309 · livrée 21 h 40 · carte", total: 6500 },
  ],
};
