import type { RoleBackend } from "../types";
import { api, enregistrerAcces } from "./client";

/** Profil renvoyé par `GET /auth/me/`. */
export interface Moi {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleBackend;
}

/** Écran d'accueil de chaque rôle après connexion. */
export const ACCUEIL_PAR_ROLE: Record<RoleBackend, string> = {
  ADMIN: "/admin",
  MANAGER: "/gestion",
  WAITER: "/salle",
  KITCHEN: "/cuisine",
};

export async function connexion(email: string, motDePasse: string): Promise<Moi> {
  // Le rafraîchissement arrive en cookie HttpOnly (+ cookie `csrftoken`).
  const { access } = await api<{ access: string }>("/auth/login/", {
    method: "POST",
    auth: false,
    cookies: true,
    body: { email, password: motDePasse },
  });
  enregistrerAcces(access);
  return moi();
}

export function moi(): Promise<Moi> {
  return api<Moi>("/auth/me/");
}

export async function deconnexion(): Promise<void> {
  try {
    // Révoque le cookie de rafraîchissement côté serveur (CSRF requis).
    await api("/auth/logout/", { method: "POST", cookies: true });
  } finally {
    enregistrerAcces(null);
  }
}

/** Réponse identique que le compte existe ou non (pas d'énumération). */
export function demanderReinitialisation(email: string): Promise<void> {
  return api("/auth/password-reset/", { method: "POST", auth: false, body: { email } });
}

export function confirmerReinitialisation(uid: string, token: string, nouveauMotDePasse: string): Promise<void> {
  return api("/auth/password-reset/confirm/", {
    method: "POST",
    auth: false,
    body: { uid, token, new_password: nouveauMotDePasse },
  });
}
