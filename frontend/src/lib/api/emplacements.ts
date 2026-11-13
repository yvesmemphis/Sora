/** Emplacements (tables, chambres) : `/locations/`. */
import { api, apiFichier, toutesLesPages } from "./client";
import type { TypeEmplacement } from "./conversions";

export interface EmplacementApi {
  id: string;
  type: TypeEmplacement;
  reference: string;
  is_active: boolean;
}

export function listerEmplacements(signal?: AbortSignal): Promise<EmplacementApi[]> {
  return toutesLesPages<EmplacementApi>("/locations/", signal);
}

export function creerEmplacement(type: TypeEmplacement, reference: string): Promise<EmplacementApi> {
  return api<EmplacementApi>("/locations/", { method: "POST", body: { type, reference, is_active: true } });
}

export function activerEmplacement(id: string, actif: boolean): Promise<EmplacementApi> {
  return api<EmplacementApi>(`/locations/${id}/`, { method: "PATCH", body: { is_active: actif } });
}

/**
 * QR du menu (`GET /public/menu/qr/`, responsables) : sans emplacement, il ouvre la
 * carte « à emporter » ; avec une table ou une chambre, il pré-remplit le panier.
 * L'URL encodée est renvoyée dans l'en-tête `X-QR-Target`.
 */
export async function chargerQrMenu(emplacement?: EmplacementApi): Promise<{ blob: Blob; cible: string | null }> {
  const mode = !emplacement ? "TAKEAWAY" : emplacement.type === "TABLE" ? "DINE_IN" : "ROOM";
  const q = new URLSearchParams({ mode, ...(emplacement ? { location_id: emplacement.id } : {}) });
  const { blob, entetes } = await apiFichier(`/public/menu/qr/?${q.toString()}`);
  return { blob, cible: entetes.get("X-QR-Target") };
}
