/**
 * Gestion : stocks (`/ingredients/`, `/stock-lots/`, `/stock-movements/`, `/inventory-alerts/`),
 * recettes (`/recipe-versions/`), production (`/production-batches/`, `/waste-declarations/`)
 * et analytique (`/analytics/overview/`, `/analytics/forecasts/`).
 */
import { api, toutesLesPages } from "./client";

/* ------------------------------------------------------------ Stocks */

export interface IngredientApi {
  id: number | string;
  name: string;
  unit_of_measure: string;
  minimum_stock: string;
  maximum_stock: string | null;
  supplier: number | string | null;
  supplier_name: string | null;
  is_active: boolean;
  cost_per_unit?: string;
}

export interface LotApi {
  id: number | string;
  lot_id: string;
  ingredient: number | string;
  ingredient_name: string;
  supplier_name: string | null;
  quantity_received: string;
  quantity_remaining: string;
  date_received: string;
  date_expiration: string;
  cost_per_unit: string;
  is_active: boolean;
  is_expired: boolean;
}

export interface MouvementApi {
  id: number | string;
  lot_lot_id: string;
  lot_ingredient_name: string;
  movement_type: string;
  quantity: string;
  notes: string | null;
  created_at: string;
}

export interface AlerteApi {
  id: number | string;
  ingredient_name: string;
  lot_id: string | null;
  alert_type: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

export const listerIngredients = (s?: AbortSignal) => toutesLesPages<IngredientApi>("/ingredients/", s);
export const listerLots = (s?: AbortSignal) => toutesLesPages<LotApi>("/stock-lots/", s);
export const listerMouvements = (s?: AbortSignal) => toutesLesPages<MouvementApi>("/stock-movements/", s);
export const listerAlertes = (s?: AbortSignal) => toutesLesPages<AlerteApi>("/inventory-alerts/", s);

/* ------------------------------------------------------------ Recettes */

export interface RecetteApi {
  id: number | string;
  menu_item_id: string;
  name: string;
  version_number: number;
  valid_from: string | null;
  items: { ingredient: number | string; ingredient_name: string; ingredient_unit: string; quantity_required: string }[];
}

export function recetteActive(platId: string): Promise<RecetteApi> {
  return api<RecetteApi>(`/recipe-versions/active/?menu_item_id=${encodeURIComponent(platId)}`);
}

/* ------------------------------------------------------------ Production */

export interface LotProductionApi {
  id: number | string;
  product_name: string;
  production_date: string;
  quantity_produced: string;
  quantity_remaining: string;
  unit_cost?: string;
  notes?: string;
  created_at: string;
}

export interface InvenduApi {
  id: number | string;
  batch: number | string;
  remaining_quantity: string;
  reusable_quantity: string;
  discarded_quantity: string;
  reason: string;
  estimated_cost?: string;
  declared_at: string;
}

export const listerProductions = (s?: AbortSignal) => toutesLesPages<LotProductionApi>("/production-batches/", s);
export const listerInvendus = (s?: AbortSignal) => toutesLesPages<InvenduApi>("/waste-declarations/", s);

export function declarerInvendu(donnees: {
  batch: number | string;
  remaining_quantity: string;
  reusable_quantity: string;
  discarded_quantity: string;
  reason: string;
}): Promise<InvenduApi> {
  return api<InvenduApi>("/waste-declarations/", { method: "POST", body: donnees });
}

/* ------------------------------------------------------------ Analytique */

export interface ApercuApi {
  start_date?: string;
  end_date?: string;
  orders?: { total: number; completed: number; cancelled: number };
  payments?: Record<string, number>;
  revenue?: Record<string, string>;
}

/** Dates « AAAA-MM-JJ » en heure locale. */
export function dateIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function apercu(debut: Date, fin: Date): Promise<ApercuApi> {
  return api<ApercuApi>(`/analytics/overview/?start_date=${dateIso(debut)}&end_date=${dateIso(fin)}`);
}

/** Chiffre d'affaires net toutes devises confondues (le backend groupe par devise). */
export function chiffreAffaires(a: ApercuApi): number {
  return Object.values(a.revenue ?? {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
}

export interface PrevisionApi {
  id: number;
  menu_item_id: string;
  menu_item_name: string;
  period_start: string;
  period_end: string;
  version: number;
  predicted_quantity: string;
  confidence: string;
  explanation: Record<string, unknown>;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  rejection_reason: string;
}

export const listerPrevisions = (s?: AbortSignal) => toutesLesPages<PrevisionApi>("/analytics/forecasts/", s);

export function deciderPrevision(id: number, decision: "approve" | "reject", motif = ""): Promise<PrevisionApi> {
  return api<PrevisionApi>(`/analytics/forecasts/${id}/${decision}/`, { method: "POST", body: { reason: motif } });
}
