/**
 * Commandes : création publique (QR), suivi et désistement par jeton, gestion par le
 * personnel, paiements. Contrats : `backend/apps/orders`, `backend/apps/payments`.
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

/* ------------------------------------------------------------ Paiement */

/** Codes de `PAYMENT_METHOD_CHOICES` (backend `common/constants.py`) utilisés par le front. */
export const METHODE_PAIEMENT: Record<ModePaiement, string> = { especes: "cash", carte: "card" };

/** Code backend → mode du front (les anciens codes français restent reconnus). */
export function modePaiementDe(methode: string | null | undefined): ModePaiement | undefined {
  if (!methode) return undefined;
  if (["card", "carte_bleue"].includes(methode)) return "carte";
  if (["cash", "espece"].includes(methode)) return "especes";
  return undefined;
}

/* ------------------------------------------------------------ Public */

export interface CommandePubliqueCreee {
  number: string;
  total: string;
  currency: string;
  payment_method_expected: string;
  tracking_token: string;
}

export function passerCommandePublique(
  donnees: {
    mode: ModeService;
    emplacement?: { type: TypeEmplacement; reference: string };
    paiement?: ModePaiement;
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
      ...(donnees.paiement ? { payment_method_expected: METHODE_PAIEMENT[donnees.paiement] } : {}),
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
  payment_method_expected: string;
  created_at: string;
  total: string;
  currency: string;
  items: { name: string; quantity: number }[];
}

export function suivreCommande(jeton: string, signal?: AbortSignal): Promise<SuiviApi> {
  return api<SuiviApi>(`/public/track/${encodeURIComponent(jeton)}/`, { auth: false, signal });
}

/** Désistement du client, possible tant que la commande est « reçue » et dans le délai. */
export function annulerCommandePublique(jeton: string): Promise<void> {
  return api(`/public/track/${encodeURIComponent(jeton)}/cancel/`, { method: "POST", auth: false });
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

interface HistoriqueApi {
  from_status: StatutBackend | null;
  to_status: StatutBackend;
  changed_at: string;
  note: string | null;
}

/** `OrderSerializer` (gestion, salle) ou `KitchenOrderSerializer` (cuisine, champs réduits). */
export interface CommandeApi {
  id: number;
  number: string | null;
  status: StatutBackend;
  mode: ModeBackend;
  location?: string | null;
  location_type?: TypeEmplacement | null;
  location_reference?: string | null;
  source?: "PUBLIC" | "STAFF";
  table_number: number | null;
  customer_name?: string | null;
  total?: string;
  currency?: string;
  payment_method_expected?: string;
  amount_paid?: string;
  is_paid?: boolean;
  status_history?: HistoriqueApi[];
  notes: string | null;
  created_at: string;
  updated_at?: string;
  items: LigneApi[];
}

export function listerCommandes(filtres: { date?: string; status?: StatutBackend } = {}, signal?: AbortSignal): Promise<CommandeApi[]> {
  const q = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v) as [string, string][]).toString();
  return api<CommandeApi[]>(`/orders/${q ? `?${q}` : ""}`, { signal });
}

export function creerCommande(
  donnees: {
    mode: ModeService;
    location?: string | null;
    paiement?: ModePaiement;
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
      ...(donnees.paiement ? { payment_method_expected: METHODE_PAIEMENT[donnees.paiement] } : {}),
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

/** Correction de la table ou de la chambre (statuts « reçue » et « confirmée » seulement). */
export function changerEmplacementCommande(id: number, location: string | null): Promise<CommandeApi> {
  return api<CommandeApi>(`/orders/${id}/location/`, { method: "PATCH", body: { location } });
}

/* ------------------------------------------------------------ Paiements */

export interface PaiementApi {
  id: number;
  order: number;
  amount?: string;
  currency?: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
  payment_method: string;
  created_at: string;
}

export function enregistrerPaiement(commandeId: number, montantFcfa: number, mode: ModePaiement): Promise<PaiementApi> {
  return api<PaiementApi>(`/orders/${commandeId}/payments/`, {
    method: "POST",
    body: { amount: montantFcfa.toFixed(2), payment_method: METHODE_PAIEMENT[mode] },
  });
}

export interface RapportPaiementsApi {
  date: string;
  payments: PaiementApi[];
  totals: {
    payment_method: string;
    currency: string;
    gross_collected: string;
    refunded: string;
    net_collected: string;
  }[];
}

/** Paiements d'une journée et totaux par mode (gestionnaires). */
export function rapportPaiements(date: string): Promise<RapportPaiementsApi> {
  return api<RapportPaiementsApi>(`/payments/?date=${date}`);
}

/* ------------------------------------------------------------ Conversion */

function couleurDe(statut: StatutCommande): string {
  const couleurs: Partial<Record<StatutCommande, string>> = COULEUR_HISTORIQUE;
  return couleurs[statut] ?? (statut === "annulee" || statut === "refusee" ? "#B3261E" : COULEUR_HISTORIQUE.confirmee);
}

/** Emplacement lisible d'une commande (« 6 », « 204 », « Au comptoir »). */
export function emplacementDe(c: CommandeApi, emplacements: EmplacementApi[] = []): string {
  if (c.mode === "TAKEAWAY") return "Au comptoir";
  if (c.location_type && c.location_reference) return referenceAffichee(c.location_type, c.location_reference);
  const loc = c.location ? emplacements.find((e) => e.id === c.location) : undefined;
  if (loc) return referenceAffichee(loc.type, loc.reference);
  if (c.table_number) return String(c.table_number);
  return "—";
}

/** Historique du backend (du plus récent au plus ancien), ou à défaut création + statut courant. */
function historiqueDe(c: CommandeApi, statut: StatutCommande): EvenementCommande[] {
  const origine = c.source === "PUBLIC" ? "Client, depuis le menu" : "Personnel";
  if (c.status_history?.length) {
    return [...c.status_history]
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
      .map((h) => {
        const s = statutFront(h.to_status);
        return {
          heure: heureDe(h.changed_at),
          statut: STATUTS_COMMANDE[s].libelle,
          detail: h.from_status ? h.note || "Changement de statut" : origine,
          couleur: couleurDe(s),
        };
      });
  }
  const evts: EvenementCommande[] = [{ heure: heureDe(c.created_at), statut: "Reçue", detail: origine, couleur: couleurDe("recue") }];
  if (statut !== "recue") {
    evts.unshift({ heure: heureDe(c.updated_at ?? c.created_at), statut: STATUTS_COMMANDE[statut].libelle, detail: "Dernier changement", couleur: couleurDe(statut) });
  }
  return evts;
}

export function commandeDepuisApi(c: CommandeApi, contexte: { emplacements?: EmplacementApi[] } = {}): Commande {
  const statut = statutFront(c.status);
  const lignes: LigneCommande[] = c.items.map((l) => ({
    platId: l.menu_item_id,
    nom: l.menu_item_name,
    quantite: l.quantity,
    prixUnitaire: montant(l.unit_price),
    note: l.special_instructions || undefined,
  }));
  const notes = [c.notes?.trim(), ...lignes.filter((l) => l.note).map((l) => `${l.nom} : ${l.note}`)].filter(Boolean);
  return {
    id: c.id,
    numero: c.number ?? String(c.id),
    statut,
    mode: modeFront(c.mode),
    emplacement: emplacementDe(c, contexte.emplacements),
    passeeA: heureDe(c.created_at),
    creeeLe: c.created_at,
    majLe: c.updated_at ?? c.created_at,
    paiement: modePaiementDe(c.payment_method_expected) ?? "especes",
    payee: statut === "cloturee" || !!c.is_paid,
    total: c.total !== undefined ? montant(c.total) : undefined,
    source: c.source,
    lignes,
    note: notes.length ? notes.join(" · ") : undefined,
    noteCommande: c.notes?.trim() || undefined,
    historique: historiqueDe(c, statut),
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
