/**
 * Commandes : création publique (QR) et suivi par jeton, gestion par le personnel,
 * paiements. Contrats : `backend/apps/orders`, `backend/apps/payments`.
 */
import { COULEUR_HISTORIQUE, STATUTS_COMMANDE } from "../statuts";
import type { Commande, EvenementCommande, LigneCommande, ModePaiement, ModeService, StatutCommande } from "../types";
import { api, cleIdempotence } from "./client";
import {
  heureDe,
  MODE_VERS_BACK,
  modeFront,
  montant,
  referenceAffichee,
  STATUT_VERS_BACK,
  statutFront,
  TYPE_EMPLACEMENT,
  type ModeBackend,
  type StatutBackend,
  type TypeEmplacement,
} from "./conversions";
import type { EmplacementApi } from "./emplacements";

/* ------------------------------------------------------------ Public */

export interface CommandePubliqueCreee {
  number: string;
  total: string;
  tracking_token: string;
}

export function passerCommandePublique(
  donnees: {
    mode: ModeService;
    emplacement?: { type: TypeEmplacement; reference: string };
    note?: string;
    lignes: { platId: string; quantite: number; note?: string }[];
  },
  cle = cleIdempotence(),
): Promise<CommandePubliqueCreee> {
  return api<CommandePubliqueCreee>("/public/orders/", {
    method: "POST",
    auth: false,
    headers: { "Idempotency-Key": cle },
    body: {
      mode: MODE_VERS_BACK[donnees.mode],
      ...(donnees.emplacement ? { location: donnees.emplacement } : {}),
      note: (donnees.note ?? "").slice(0, 300),
      items: donnees.lignes.map((l) => ({
        dish_id: l.platId,
        quantity: Math.min(20, Math.max(1, l.quantite)),
        notes: (l.note ?? "").slice(0, 200),
      })),
    },
  });
}

export interface SuiviApi {
  number: string;
  status: StatutBackend;
  created_at: string;
  items: { name: string; quantity: number }[];
}

export function suivreCommande(jeton: string, signal?: AbortSignal): Promise<SuiviApi> {
  return api<SuiviApi>(`/public/track/${encodeURIComponent(jeton)}/`, { auth: false, signal });
}

/* ------------------------------------------------------------ Personnel */

interface LigneApi {
  id?: number;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price?: string;
  total_price?: string;
  special_instructions: string | null;
}

/** `OrderSerializer` (gestion, salle) ou `KitchenOrderSerializer` (cuisine, champs réduits). */
export interface CommandeApi {
  id: number;
  number: string | null;
  status: StatutBackend;
  mode: ModeBackend;
  location?: string | null;
  source?: "PUBLIC" | "STAFF";
  table_number: number | null;
  customer_name?: string | null;
  total?: string;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  items: LigneApi[];
}

export function listerCommandes(signal?: AbortSignal): Promise<CommandeApi[]> {
  return api<CommandeApi[]>("/orders/", { signal });
}

export function creerCommande(
  donnees: {
    mode: ModeService;
    location?: string | null;
    notes?: string;
    lignes: { platId: string; quantite: number; note?: string }[];
  },
  cle = cleIdempotence(),
): Promise<CommandeApi> {
  return api<CommandeApi>("/orders/", {
    method: "POST",
    headers: { "Idempotency-Key": cle },
    body: {
      mode: MODE_VERS_BACK[donnees.mode],
      location: donnees.location ?? null,
      notes: donnees.notes ?? "",
      items: donnees.lignes.map((l) => ({
        menu_item_id: l.platId,
        quantity: l.quantite,
        ...(l.note ? { special_instructions: l.note } : {}),
      })),
    },
  });
}

export function changerStatutCommande(id: number, statut: StatutCommande, note = ""): Promise<CommandeApi> {
  return api<CommandeApi>(`/orders/${id}/transition/`, {
    method: "POST",
    body: { status: STATUT_VERS_BACK[statut], note },
  });
}

/* ------------------------------------------------------------ Paiements */

export interface PaiementApi {
  id: number;
  order: number;
  amount?: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
  payment_method: string;
  created_at: string;
}

export const METHODE_PAIEMENT: Record<ModePaiement, string> = { especes: "cash", carte: "card" };

export function listerPaiements(commandeId: number, signal?: AbortSignal): Promise<PaiementApi[]> {
  return api<PaiementApi[]>(`/orders/${commandeId}/payments/`, { signal });
}

export function enregistrerPaiement(commandeId: number, montantFcfa: number, mode: ModePaiement): Promise<PaiementApi> {
  return api<PaiementApi>(`/orders/${commandeId}/payments/`, {
    method: "POST",
    body: { amount: montantFcfa.toFixed(2), payment_method: METHODE_PAIEMENT[mode] },
  });
}

export function modePaiementDe(methode: string): ModePaiement {
  return ["card", "carte_bleue"].includes(methode) ? "carte" : "especes";
}

/* ------------------------------------------------------------ Conversion */

function evenement(statut: StatutCommande, iso: string | undefined, detail: string): EvenementCommande {
  const couleurs: Partial<Record<StatutCommande, string>> = COULEUR_HISTORIQUE;
  return {
    heure: heureDe(iso),
    statut: STATUTS_COMMANDE[statut].libelle,
    detail,
    couleur: couleurs[statut] ?? (statut === "annulee" || statut === "refusee" ? "#B3261E" : COULEUR_HISTORIQUE.confirmee),
  };
}

/** Emplacement lisible d'une commande (« 6 », « 204 », « Au comptoir »). */
export function emplacementDe(c: CommandeApi, emplacements: EmplacementApi[]): string {
  if (c.mode === "TAKEAWAY") return "Au comptoir";
  const loc = c.location ? emplacements.find((e) => e.id === c.location) : undefined;
  if (loc) return referenceAffichee(loc.type, loc.reference);
  if (c.table_number) return String(c.table_number);
  return "—";
}

export function commandeDepuisApi(
  c: CommandeApi,
  contexte: { emplacements: EmplacementApi[]; payee?: boolean; paiement?: ModePaiement },
): Commande {
  const statut = statutFront(c.status);
  const lignes: LigneCommande[] = c.items.map((l) => ({
    platId: l.menu_item_id,
    nom: l.menu_item_name,
    quantite: l.quantity,
    prixUnitaire: montant(l.unit_price),
    note: l.special_instructions || undefined,
  }));
  const notes = [c.notes?.trim(), ...lignes.filter((l) => l.note).map((l) => `${l.nom} : ${l.note}`)].filter(Boolean);
  const origine = c.source === "PUBLIC" ? "Client, depuis le menu" : "Personnel";
  const historique: EvenementCommande[] = [evenement("recue", c.created_at, origine)];
  if (statut !== "recue") historique.unshift(evenement(statut, c.updated_at ?? c.created_at, "Dernier changement"));
  const mode = modeFront(c.mode);
  return {
    id: c.id,
    numero: c.number ?? String(c.id),
    statut,
    mode,
    emplacement: emplacementDe(c, contexte.emplacements),
    passeeA: heureDe(c.created_at),
    creeeLe: c.created_at,
    majLe: c.updated_at ?? c.created_at,
    paiement: contexte.paiement ?? "especes",
    payee: statut === "cloturee" || !!contexte.payee,
    total: c.total !== undefined ? montant(c.total) : undefined,
    source: c.source,
    lignes,
    note: notes.length ? notes.join(" · ") : undefined,
    noteCommande: c.notes?.trim() || undefined,
    historique,
  };
}

/** Emplacement backend correspondant à un mode et une saisie. */
export function trouverEmplacement(
  mode: ModeService,
  saisie: string,
  emplacements: EmplacementApi[],
): EmplacementApi | undefined {
  if (mode === "emporter") return undefined;
  const type = TYPE_EMPLACEMENT[mode];
  const s = saisie.trim().toUpperCase();
  return emplacements.find(
    (e) => e.is_active && e.type === type && (e.reference.toUpperCase() === s || referenceAffichee(e.type, e.reference).toUpperCase() === s),
  );
}
