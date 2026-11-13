/**
 * Rôles du personnel, description et matrice des droits.
 * Les droits sont fixés par le backend (`role_map` des vues, `common/constants.py`) :
 * cette matrice les décrit, elle ne les modifie pas.
 */

export const ROLES = ["Serveur", "Cuisine", "Gestionnaire", "Administrateur"] as const;
export type Role = (typeof ROLES)[number];

/** Correspondance avec les rôles du backend (`common/constants.py`). */
export const ROLE_BACKEND: Record<Role, "WAITER" | "KITCHEN" | "MANAGER" | "ADMIN"> = {
  Serveur: "WAITER",
  Cuisine: "KITCHEN",
  Gestionnaire: "MANAGER",
  Administrateur: "ADMIN",
};

export const DESCRIPTION_ROLES: Record<Role, string> = {
  Serveur: "Prend et suit les commandes en salle, renseigne la table ou la chambre, encaisse et traite les annulations après validation.",
  Cuisine: "Voit uniquement les commandes confirmées, met à jour leur statut et signale retards et indisponibilités.",
  Gestionnaire: "Pilote menu, stocks, production, ventes et clôture de caisse. Valide les recommandations IA.",
  Administrateur: "Gère les comptes, les rôles, les QR codes, les paramètres et consulte le journal.",
};

export const PERMISSIONS: { nom: string; detail: string; roles: Role[] }[] = [
  { nom: "Saisir une commande", detail: "Table ou chambre, mode de paiement", roles: ["Serveur", "Gestionnaire", "Administrateur"] },
  { nom: "Marquer comme payé", detail: "Espèces ou carte, en totalité", roles: ["Serveur", "Gestionnaire", "Administrateur"] },
  { nom: "Annuler ou refuser une commande", detail: "Reçue ou confirmée, avec motif", roles: ["Serveur", "Gestionnaire", "Administrateur"] },
  { nom: "Écran de cuisine", detail: "Préparation, prêt, indisponibilités", roles: ["Cuisine", "Gestionnaire", "Administrateur"] },
  { nom: "Menu, recettes et stocks", detail: "Plats, prix, lots, mouvements", roles: ["Gestionnaire", "Administrateur"] },
  { nom: "Statistiques et prévisions", detail: "Valider les recommandations IA", roles: ["Gestionnaire", "Administrateur"] },
  { nom: "Clôture de caisse", detail: "Comparer totaux et caisse réelle", roles: ["Gestionnaire", "Administrateur"] },
  { nom: "QR codes du menu", detail: "Générer et imprimer", roles: ["Gestionnaire", "Administrateur"] },
  { nom: "Utilisateurs, paramètres et journal", detail: "Comptes, rôles, réglages, audit", roles: ["Administrateur"] },
];

/** Modules affichés dans le journal d'activité. */
export type ModuleJournal = "Commandes" | "Paiements" | "Stocks" | "Menu" | "Comptes";

/** Motifs proposés lors de la déclaration des invendus (champ libre côté backend). */
export const MOTIFS_INVENDU = ["Faible demande", "Surproduction", "Annulation", "Problème de qualité", "Péremption", "Autre"];
