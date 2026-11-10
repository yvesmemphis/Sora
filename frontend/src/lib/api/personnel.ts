import type { RoleBackend } from "../types";
import { api, type Page } from "./client";

/** Employé tel que renvoyé par `/staff/` (réservé au rôle ADMIN). */
export interface Employe {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleBackend;
  is_active: boolean;
}

export function listerPersonnel(page = 1): Promise<Page<Employe>> {
  return api<Page<Employe>>(`/staff/?page=${page}`);
}

export function inviterEmploye(donnees: { email: string; first_name?: string; last_name?: string; role: RoleBackend }): Promise<Employe> {
  return api<Employe>("/staff/", { method: "POST", body: donnees });
}

export function modifierEmploye(id: string, donnees: { role?: RoleBackend; is_active?: boolean }): Promise<Employe> {
  return api<Employe>(`/staff/${id}/`, { method: "PATCH", body: donnees });
}
