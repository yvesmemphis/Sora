/**
 * Client HTTP de l'API Django (`/api/v1/`).
 *
 * - Authentification JWT (SimpleJWT) : accès 10 min, rafraîchissement 7 jours avec rotation.
 * - Rafraîchit automatiquement le jeton d'accès une fois en cas de 401.
 * - Normalise les erreurs au format du backend : { code, message, details }.
 *
 * Stockage des jetons : `localStorage` pour le MVP. À durcir avant la production
 * (cookie httpOnly posé par un Route Handler Next.js servant d'intermédiaire).
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");

const CLE_JETONS = "sora.jetons";

export interface Jetons {
  access: string;
  refresh: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ------------------------------------------------------------- Jetons */

export function lireJetons(): Jetons | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_JETONS);
    return brut ? (JSON.parse(brut) as Jetons) : null;
  } catch {
    return null;
  }
}

export function enregistrerJetons(jetons: Jetons | null) {
  try {
    if (jetons) window.localStorage.setItem(CLE_JETONS, JSON.stringify(jetons));
    else window.localStorage.removeItem(CLE_JETONS);
  } catch {
    /* stockage indisponible */
  }
}

/* ------------------------------------------------------------ Requêtes */

interface Options {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** false pour les routes publiques (connexion, réinitialisation). */
  auth?: boolean;
  signal?: AbortSignal;
}

let rafraichissementEnCours: Promise<string | null> | null = null;

async function rafraichir(): Promise<string | null> {
  const jetons = lireJetons();
  if (!jetons?.refresh) return null;
  // Une seule requête de rafraîchissement à la fois, partagée par les appels concurrents.
  rafraichissementEnCours ??= (async () => {
    try {
      const rep = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: jetons.refresh }),
      });
      if (!rep.ok) {
        enregistrerJetons(null);
        return null;
      }
      const data = (await rep.json()) as Partial<Jetons>;
      const nouveaux = { access: data.access ?? "", refresh: data.refresh ?? jetons.refresh };
      enregistrerJetons(nouveaux);
      return nouveaux.access;
    } catch {
      return null;
    } finally {
      rafraichissementEnCours = null;
    }
  })();
  return rafraichissementEnCours;
}

async function lireErreur(rep: Response): Promise<ApiError> {
  try {
    const data = (await rep.json()) as { code?: string; message?: string; detail?: string; details?: unknown };
    return new ApiError(rep.status, data.code ?? "error", data.message ?? data.detail ?? "Erreur inattendue.", data.details ?? null);
  } catch {
    return new ApiError(rep.status, "error", rep.statusText || "Erreur inattendue.");
  }
}

export async function api<T = unknown>(chemin: string, { method = "GET", body, auth = true, signal }: Options = {}): Promise<T> {
  const envoyer = (access?: string) =>
    fetch(`${API_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let rep: Response;
  try {
    rep = await envoyer(auth ? lireJetons()?.access : undefined);
    if (auth && rep.status === 401) {
      const access = await rafraichir();
      if (access) rep = await envoyer(access);
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "reseau", "Serveur injoignable. Vérifiez votre connexion.");
  }

  if (!rep.ok) throw await lireErreur(rep);
  if (rep.status === 204 || rep.status === 202) return undefined as T;
  return (await rep.json()) as T;
}

/** Réponse paginée standard du backend (`common/pagination.py`). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
