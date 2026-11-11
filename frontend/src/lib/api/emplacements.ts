/** Emplacements (tables, chambres) : `/locations/`. */
import { api, toutesLesPages } from "./client";
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
