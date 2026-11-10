import type { Utilisateur } from "../types";

/** Données de démonstration de l'espace administrateur (maquettes A1 à A3). */

export const UTILISATEURS: Utilisateur[] = [
  { id: "USR-0003", nom: "Mariam Diallo", email: "m.diallo@maisonsora.ci", role: "Gestionnaire", statut: "Actif", derniereConnexion: "Aujourd'hui, 08 h 12" },
  { id: "USR-0004", nom: "Awa Koné", email: "a.kone@maisonsora.ci", role: "Serveur", statut: "Actif", derniereConnexion: "Aujourd'hui, 18 h 55" },
  { id: "USR-0005", nom: "Koffi N'Guessan", email: "k.nguessan@maisonsora.ci", role: "Cuisine", statut: "Actif", derniereConnexion: "Aujourd'hui, 17 h 30" },
  { id: "USR-0006", nom: "Ibrahim Traoré", email: "i.traore@maisonsora.ci", role: "Serveur", statut: "Actif", derniereConnexion: "Hier, 23 h 04" },
  { id: "USR-0007", nom: "Fatou Bamba", email: "f.bamba@maisonsora.ci", role: "Cuisine", statut: "Actif", derniereConnexion: "Aujourd'hui, 11 h 02" },
  { id: "USR-0001", nom: "Yao Kouassi", email: "y.kouassi@maisonsora.ci", role: "Administrateur", statut: "Actif", derniereConnexion: "Aujourd'hui, 19 h 40" },
  { id: "USR-0014", nom: "Adjoua Yapi", email: "a.yapi@maisonsora.ci", role: "Serveur", statut: "Invité", derniereConnexion: "Jamais" },
  { id: "USR-0009", nom: "Serge Aka", email: "s.aka@maisonsora.ci", role: "Cuisine", statut: "Suspendu", derniereConnexion: "02/10/2026" },
  { id: "USR-0010", nom: "Nadia Ouattara", email: "n.ouattara@maisonsora.ci", role: "Serveur", statut: "Actif", derniereConnexion: "Hier, 14 h 47" },
];

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
  { nom: "Saisir une commande", detail: "Table ou chambre, mode de paiement", roles: ["Serveur", "Gestionnaire"] },
  { nom: "Marquer comme payé", detail: "Espèces ou carte, en totalité", roles: ["Serveur", "Gestionnaire"] },
  { nom: "Valider une annulation", detail: "Après le délai de désistement", roles: ["Serveur", "Gestionnaire"] },
  { nom: "Écran de cuisine", detail: "Statuts, retards, indisponibilités", roles: ["Cuisine", "Gestionnaire"] },
  { nom: "Menu, recettes et stocks", detail: "Plats, prix, lots, mouvements", roles: ["Gestionnaire"] },
  { nom: "Statistiques et prévisions", detail: "Valider les recommandations IA", roles: ["Gestionnaire"] },
  { nom: "Clôture de caisse", detail: "Comparer totaux et caisse réelle", roles: ["Gestionnaire"] },
  { nom: "Utilisateurs et paramètres", detail: "Rôles, QR, journal", roles: ["Administrateur"] },
];

export const QR_CODES = [
  { nom: "Chevalets des tables", jeton: "qr_7f3k-92mx", usage: "1 284 scans · 30 j", actif: true },
  { nom: "Chambres (livret d'accueil)", jeton: "qr_b81p-4tzq", usage: "642 scans · 30 j", actif: true },
  { nom: "Réception", jeton: "qr_m2va-77cn", usage: "218 scans · 30 j", actif: true },
  { nom: "Ancien chevalet", jeton: "qr_3hd9-0lqe", usage: "révoqué le 14/10", actif: false },
];

export const TABLES = Array.from({ length: 14 }, (_, i) => ({ numero: String(i + 1), active: i !== 10 }));

export const CHAMBRES = [
  "101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112",
  "201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "212",
  "301", "302", "303", "304", "305", "306", "307", "308", "309", "310", "311", "312",
  "401", "402", "403", "404", "405", "406", "407", "408", "409", "410", "411", "412",
];

export const PARAMETRES = [
  { cle: "desistement", nom: "Délai de désistement", detail: "Après ce délai, la commande passe automatiquement à « confirmée ».", valeur: "5 min", options: ["3 min", "5 min", "10 min"] },
  { cle: "actualisation", nom: "Actualisation des écrans", detail: "Cuisine et salle. WebSockets prévus dans une version ultérieure.", valeur: "5 s", options: ["3 s", "5 s", "10 s"] },
  { cle: "chambre", nom: "Validation des commandes en chambre", detail: "Un employé confirme le numéro de chambre.", valeur: "Activée", options: ["Activée", "Désactivée"] },
  { cle: "paiement", nom: "Modes de paiement", detail: "Aucun paiement en ligne, aucun report sur la note de chambre.", valeur: "Espèces · Carte", options: ["Espèces · Carte", "Espèces", "Carte"] },
  { cle: "format", nom: "Devise et format", detail: "Prix affichés « 6 500 FCFA », heures « 19 h 30 ».", valeur: "FCFA · 24 h", options: ["FCFA · 24 h"] },
  { cle: "historique", nom: "Seuil d'historique pour prévoir", detail: "En dessous : « Données insuffisantes ».", valeur: "4 semaines", options: ["2 semaines", "4 semaines", "8 semaines"] },
];

export type ModuleJournal = "Commandes" | "Paiements" | "Stocks" | "Menu" | "Comptes";

export const JOURNAL: { heure: string; acteur: string; module: ModuleJournal; action: string; objet: string }[] = [
  { heure: "19 h 42", acteur: "Awa Koné", module: "Paiements", action: "Commande marquée payée · carte · 7 000 FCFA", objet: "CMD-0140" },
  { heure: "19 h 41", acteur: "Koffi N'Guessan", module: "Commandes", action: "Statut : en préparation → prête", objet: "CMD-0140" },
  { heure: "19 h 40", acteur: "Client", module: "Commandes", action: "Commande reçue · désistement jusqu'à 19 h 45", objet: "CMD-0144" },
  { heure: "19 h 39", acteur: "Système", module: "Commandes", action: "Validation automatique : reçue → confirmée", objet: "CMD-0143" },
  { heure: "19 h 36", acteur: "Client", module: "Commandes", action: "Désistement pendant le délai : reçue → annulée", objet: "CMD-0137" },
  { heure: "19 h 22", acteur: "Koffi N'Guessan", module: "Menu", action: "Poisson braisé : temporairement indisponible", objet: "PLAT-014" },
  { heure: "18 h 05", acteur: "Mariam Diallo", module: "Stocks", action: "Perte enregistrée · crème fraîche −1 L · péremption", objet: "LOT-1029" },
  { heure: "17 h 48", acteur: "Mariam Diallo", module: "Menu", action: "Recette Kedjenou de poulet : version 3 activée", objet: "REC-031" },
  { heure: "16 h 10", acteur: "Yao Kouassi", module: "Comptes", action: "Rôle « Serveur » attribué à Adjoua Yapi", objet: "USR-0014" },
  { heure: "09 h 10", acteur: "Mariam Diallo", module: "Stocks", action: "Réception lot L-1108 · poulet fermier +20 kg", objet: "LOT-1108" },
  { heure: "06 h 00", acteur: "Système", module: "Menu", action: "Prévisions de la semaine générées", objet: "PREV-0458" },
];
