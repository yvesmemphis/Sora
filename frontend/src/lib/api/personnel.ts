import type { RoleBackend } from "../types";
import { api, type Page } from "./client";

/** Employé tel que renvoyé par `/staff/` (réservé au rôle ADMIN). */
export interface Employe {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleBackend;
  is_active: boolean;
  /** Invitation envoyée, mot de passe pas encore défini. */
  is_invited: boolean;
}

export function listerPersonnel(page = 1): Promise<Page<Employe>> {
  return api<Page<Employe>>(`/staff/?page=${page}`);
}

export function inviterEmploye(donnees: { email: string; first_name?: string; last_name?: string; role: RoleBackend }): Promise<Employe> {
  return api<Employe>("/staff/", { method: "POST", body: donnees });
}

export function modifierEmploye(id: number | string, donnees: { role?: RoleBackend; is_active?: boolean }): Promise<Employe> {
  return api<Employe>(`/staff/${id}/`, { method: "PATCH", body: donnees });
}

/** Renvoie l'e-mail d'invitation (compte actif sans mot de passe). */
export function renvoyerInvitation(id: number | string): Promise<Employe> {
  return api<Employe>(`/staff/${id}/resend-invitation/`, { method: "POST" });
}
