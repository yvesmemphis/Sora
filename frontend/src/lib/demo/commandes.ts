import { COULEUR_HISTORIQUE as C } from "../statuts";
import type { Commande } from "../types";

/**
 * Commandes du service du soir, reprises des maquettes Salle et Cuisine.
 * À remplacer par l'API `orders` du backend.
 */
export const COMMANDES_SERVICE: Commande[] = [
  {
    numero: "0140",
    statut: "prete",
    mode: "chambre",
    emplacement: "204",
    passeeA: "19 h 31",
    paiement: "carte",
    payee: false,
    lignes: [
      { platId: "PLAT-010", nom: "Kedjenou de poulet", quantite: 1, prixUnitaire: 6500 },
      { platId: "PLAT-051", nom: "Jus de gingembre", quantite: 1, prixUnitaire: 500 },
    ],
    note: "Sans piment",
    ecouleSec: 130,
    historique: [
      { heure: "19 h 41", statut: "Prête", detail: "Cuisine · Koffi", couleur: C.prete },
      { heure: "19 h 37", statut: "En préparation", detail: "Cuisine · Koffi", couleur: C.preparation },
      { heure: "19 h 36", statut: "Confirmée", detail: "Automatique, fin du délai", couleur: C.confirmee },
      { heure: "19 h 31", statut: "Reçue", detail: "Client, depuis le menu", couleur: C.recue },
    ],
  },
  {
    numero: "0143",
    statut: "confirmee",
    mode: "table",
    emplacement: "6",
    passeeA: "19 h 34",
    paiement: "especes",
    payee: false,
    lignes: [{ platId: "PLAT-014", nom: "Poisson braisé", quantite: 1, prixUnitaire: 7000 }],
    ecouleSec: 40,
    nouvelle: true,
    historique: [
      { heure: "19 h 39", statut: "Confirmée", detail: "Automatique, fin du délai", couleur: C.confirmee },
      { heure: "19 h 34", statut: "Reçue", detail: "Client, depuis le menu", couleur: C.recue },
    ],
  },
  {
    numero: "0141",
    statut: "preparation",
    mode: "table",
    emplacement: "3",
    passeeA: "19 h 29",
    paiement: "carte",
    payee: false,
    lignes: [
      { platId: "PLAT-010", nom: "Kedjenou de poulet", quantite: 2, prixUnitaire: 6500 },
      { platId: "PLAT-040", nom: "Salade de fruits", quantite: 1, prixUnitaire: 2500 },
    ],
    note: "Sans piment",
    ecouleSec: 545,
    historique: [
      { heure: "19 h 35", statut: "En préparation", detail: "Cuisine · Koffi", couleur: C.preparation },
      { heure: "19 h 34", statut: "Confirmée", detail: "Automatique", couleur: C.confirmee },
      { heure: "19 h 29", statut: "Reçue", detail: "Serveur · Awa K.", couleur: C.recue },
    ],
  },
  {
    numero: "0139",
    statut: "preparation",
    mode: "chambre",
    emplacement: "112",
    passeeA: "19 h 18",
    paiement: "especes",
    payee: false,
    lignes: [{ platId: "PLAT-014", nom: "Poisson braisé", quantite: 1, prixUnitaire: 7000 }],
    ecouleSec: 1120,
    enRetard: true,
    historique: [
      { heure: "19 h 39", statut: "En préparation", detail: "Cuisine · Koffi", couleur: C.preparation },
      { heure: "19 h 23", statut: "Confirmée", detail: "Automatique, fin du délai", couleur: C.confirmee },
      { heure: "19 h 18", statut: "Reçue", detail: "Client, depuis le menu", couleur: C.recue },
    ],
  },
  {
    numero: "0144",
    statut: "recue",
    mode: "emporter",
    emplacement: "Au comptoir",
    passeeA: "19 h 40",
    paiement: "especes",
    payee: false,
    lignes: [
      { platId: "PLAT-010", nom: "Kedjenou de poulet", quantite: 2, prixUnitaire: 6500 },
      { platId: "PLAT-050", nom: "Jus de bissap", quantite: 1, prixUnitaire: 500 },
    ],
    ecouleSec: 12,
    historique: [
      { heure: "19 h 40", statut: "Reçue", detail: "Client · désistement jusqu'à 19 h 45", couleur: C.recue },
    ],
  },
  {
    numero: "0138",
    statut: "servie",
    mode: "table",
    emplacement: "2",
    passeeA: "19 h 12",
    paiement: "especes",
    payee: true,
    lignes: [
      { platId: "PLAT-011", nom: "Sauce graine", quantite: 1, prixUnitaire: 6000 },
      { platId: "PLAT-030", nom: "Alloco", quantite: 2, prixUnitaire: 1500 },
    ],
    historique: [
      { heure: "19 h 38", statut: "Payée", detail: "Espèces · Awa K.", couleur: C.payee },
      { heure: "19 h 30", statut: "Servie", detail: "Awa K.", couleur: C.servie },
      { heure: "19 h 12", statut: "Reçue", detail: "Client", couleur: C.recue },
    ],
  },
];

export function totalCommande(c: Pick<Commande, "lignes">): number {
  return c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
}
