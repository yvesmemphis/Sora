/** Administration : réglages du restaurant (`/settings/`) et journal d'audit (`/audit/`). */
import { api, type Page } from "./client";

export interface ReglagesApi {
  name: string;
  auto_confirm_orders: boolean;
  public_ordering_enabled: boolean;
  expiry_alert_days: number;
  /** Délai pendant lequel le client peut annuler une commande QR « reçue ». */
  withdrawal_delay_minutes: number;
}

export function lireReglages(): Promise<ReglagesApi> {
  return api<ReglagesApi>("/settings/");
}

export function modifierReglages(donnees: Partial<ReglagesApi>): Promise<ReglagesApi> {
  return api<ReglagesApi>("/settings/", { method: "PATCH", body: donnees });
}

export interface EvenementAuditApi {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  result: string;
  metadata: Record<string, unknown>;
}

export function listerJournal(
  filtres: { page?: number; date_from?: string; date_to?: string; action?: string } = {},
): Promise<Page<EvenementAuditApi>> {
  const q = new URLSearchParams({ page: String(filtres.page ?? 1), page_size: "100" });
  for (const cle of ["date_from", "date_to", "action"] as const) {
    const v = filtres[cle];
    if (v) q.set(cle, v);
  }
  return api<Page<EvenementAuditApi>>(`/audit/?${q.toString()}`);
}

/** Libellés lisibles des actions d'audit connues du backend. */
export const LIBELLES_ACTION: Record<string, string> = {
  "order.created": "Commande saisie par le personnel",
  "order.public_created": "Commande passée depuis le menu",
  "order.status_changed": "Changement de statut",
  "order.stock_shortage": "Rupture de stock à la préparation",
  "payment.registered": "Paiement enregistré",
  "payment.refund_requested": "Remboursement demandé",
  "price.change": "Prix modifié",
  "settings.change": "Paramètres modifiés",
  "staff.invite": "Utilisateur invité",
  "staff.change": "Compte modifié",
  "staff.invitation_resent": "Invitation renvoyée",
  "order.location_changed": "Emplacement modifié",
  "stock.receive": "Réception de lot",
  "stock.adjust": "Ajustement d'inventaire",
  "stock.consume": "Consommation de stock",
  "stock.waste": "Perte déclarée",
  "inventory.recipe_published": "Recette publiée",
  "inventory.recipe_missing": "Recette manquante",
  "production.batch.create": "Production enregistrée",
  "production.batch.update": "Production modifiée",
  "production.waste.declare": "Invendus déclarés",
  "production.waste.update": "Invendus modifiés",
};
