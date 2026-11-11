/**
 * Conversions entre le vocabulaire du backend Django et celui du front.
 * Voir `backend/common/constants.py`.
 */
import { formatHeure } from "../format";
import type { ModeService, StatutCommande } from "../types";

export type StatutBackend =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export type ModeBackend = "DINE_IN" | "ROOM" | "TAKEAWAY";
export type TypeEmplacement = "TABLE" | "ROOM" | "TAKEAWAY";

export const STATUT_VERS_FRONT: Record<StatutBackend, StatutCommande> = {
  RECEIVED: "recue",
  CONFIRMED: "confirmee",
  PREPARING: "preparation",
  READY: "prete",
  OUT_FOR_DELIVERY: "livraison",
  SERVED: "servie",
  COMPLETED: "cloturee",
  CANCELLED: "annulee",
  REJECTED: "refusee",
};

export const STATUT_VERS_BACK: Record<StatutCommande, StatutBackend> = {
  recue: "RECEIVED",
  confirmee: "CONFIRMED",
  preparation: "PREPARING",
  prete: "READY",
  livraison: "OUT_FOR_DELIVERY",
  servie: "SERVED",
  cloturee: "COMPLETED",
  annulee: "CANCELLED",
  refusee: "REJECTED",
};

export const MODE_VERS_FRONT: Record<ModeBackend, ModeService> = {
  DINE_IN: "table",
  ROOM: "chambre",
  TAKEAWAY: "emporter",
};

export const MODE_VERS_BACK: Record<ModeService, ModeBackend> = {
  table: "DINE_IN",
  chambre: "ROOM",
  emporter: "TAKEAWAY",
};

/** Type d'emplacement attendu par le backend pour chaque mode. */
export const TYPE_EMPLACEMENT: Record<ModeService, TypeEmplacement> = {
  table: "TABLE",
  chambre: "ROOM",
  emporter: "TAKEAWAY",
};

export function statutFront(statut: string): StatutCommande {
  return STATUT_VERS_FRONT[statut as StatutBackend] ?? "recue";
}

export function modeFront(mode: string): ModeService {
  return MODE_VERS_FRONT[mode as ModeBackend] ?? "emporter";
}

/** Montant décimal du backend (« 6500.00 ») → nombre FCFA. */
export function montant(valeur: string | number | null | undefined): number {
  const n = typeof valeur === "number" ? valeur : parseFloat(valeur ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/** Date ISO → « 19 h 30 » (heure locale du navigateur). */
export function heureDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatHeure(d);
}

/**
 * Référence d'emplacement affichée : les tables du jeu de démo sont « T6 »,
 * on affiche « 6 ». Les chambres restent telles quelles (« 204 »).
 */
export function referenceAffichee(type: TypeEmplacement, reference: string): string {
  return type === "TABLE" ? reference.replace(/^T/i, "") : reference;
}

/**
 * Saisie libre (« 6 ») → référence backend. Pour une table, les références
 * connues sont essayées telles quelles puis préfixées par « T ».
 */
export function referenceSaisie(type: TypeEmplacement, saisie: string, connues?: string[]): string {
  const brut = saisie.trim().toUpperCase();
  if (type !== "TABLE") return brut;
  if (connues?.includes(brut)) return brut;
  if (/^\d+$/.test(brut)) return `T${brut}`;
  return brut;
}

/** « 261111-0042 » → « 0042 » : forme courte pour les écrans lus de loin. */
export function numeroCourt(numero: string): string {
  return numero.includes("-") ? numero.slice(numero.lastIndexOf("-") + 1) : numero;
}
