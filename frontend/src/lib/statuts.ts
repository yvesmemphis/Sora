import type { NomIcone } from "@/components/ui/icon";
import type { Disponibilite, ModePaiement, ModeService, StatutCommande } from "./types";

/**
 * Règle de la charte : un état n'est jamais indiqué par la couleur seule.
 * Chaque statut a donc un libellé, une icône et une paire de couleurs.
 */
export interface Apparence {
  libelle: string;
  icone: NomIcone;
  /** Classes Tailwind texte + fond. */
  classes: string;
}

export const STATUTS_COMMANDE: Record<StatutCommande, Apparence> = {
  recue: { libelle: "Reçue", icone: "clock", classes: "text-encre bg-neutre-fond" },
  confirmee: { libelle: "Confirmée", icone: "check", classes: "text-vert bg-confirme-fond" },
  preparation: { libelle: "En préparation", icone: "flame", classes: "text-attention bg-attention-fond" },
  prete: { libelle: "Prête", icone: "bag", classes: "text-ok bg-ok-fond" },
  livraison: { libelle: "En livraison", icone: "truck", classes: "text-vert bg-confirme-fond" },
  servie: { libelle: "Servie / livrée", icone: "truck", classes: "text-vert bg-servi-fond" },
  cloturee: { libelle: "Clôturée", icone: "lock", classes: "text-ok bg-ok-fond" },
  annulee: { libelle: "Annulée", icone: "x", classes: "text-danger bg-danger-fond" },
  refusee: { libelle: "Refusée", icone: "ban", classes: "text-danger bg-danger-fond" },
};

export const DISPONIBILITES: Record<Disponibilite, Apparence> = {
  disponible: { libelle: "Disponible", icone: "check", classes: "text-ok bg-ok-fond" },
  temporaire: { libelle: "Indisponible", icone: "clock", classes: "text-attention bg-attention-fond" },
  epuise: { libelle: "Épuisé", icone: "ban", classes: "text-danger bg-danger-fond" },
};

export const MODES_SERVICE: Record<
  ModeService,
  { libelle: string; icone: NomIcone; champ: string; court: (e: string) => string; long: (e: string) => string }
> = {
  table: {
    libelle: "Sur place",
    icone: "table",
    champ: "Numéro de table",
    court: (e) => `Table ${e}`,
    long: (e) => `Sur place, table ${e}`,
  },
  chambre: {
    libelle: "En chambre",
    icone: "bed",
    champ: "Numéro de chambre",
    court: (e) => `Chambre ${e}`,
    long: (e) => `En chambre, chambre ${e}`,
  },
  emporter: {
    libelle: "À emporter",
    icone: "takeaway",
    champ: "Retrait",
    court: () => "À emporter",
    long: () => "À emporter, retrait au comptoir",
  },
};

export const MODES_PAIEMENT: Record<ModePaiement, { libelle: string; icone: NomIcone }> = {
  especes: { libelle: "Espèces", icone: "cash" },
  carte: { libelle: "Carte", icone: "card" },
};

/** Couleurs des puces d'historique. */
export const COULEUR_HISTORIQUE = {
  recue: "#8C857A",
  confirmee: "#1F3D36",
  preparation: "#7A5200",
  prete: "#2F6B3A",
  servie: "#1F3D36",
  payee: "#2F6B3A",
} as const;

/** Intervalle d'actualisation des écrans du personnel et du suivi client. */
export const ACTUALISATION_MS = 5000;
