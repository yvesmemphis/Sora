/**
 * Client HTTP de l'API Django (`/api/v1/`).
 *
 * - Authentification JWT (SimpleJWT) : accès 10 min gardé côté navigateur ;
 *   le jeton de rafraîchissement (7 jours, rotation) vit uniquement dans le
 *   cookie HttpOnly `sora_refresh` posé par l'API.
 * - `/auth/refresh/` et `/auth/logout/` exigent l'en-tête `X-CSRFToken`, lu dans
 *   le cookie `csrftoken` émis à la connexion. Le front et l'API doivent donc
 *   partager le même hôte (ex. `localhost:3000` et `localhost:8000`).
 * - Rafraîchit automatiquement le jeton d'accès une fois en cas de 401.
 * - Normalise les erreurs au format du backend : { code, message, details }.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

const CLE_ACCES = "sora.acces";
/** Ancienne clé (accès + rafraîchissement en clair), nettoyée au démarrage. */
const CLE_JETONS_OBSOLETE = "sora.jetons";

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

export function lireAcces(): string | null {
  if (typeof window === "undefined") return null;
  try {
    window.localStorage.removeItem(CLE_JETONS_OBSOLETE);
    return window.localStorage.getItem(CLE_ACCES);
  } catch {
    return null;
  }
}

export function enregistrerAcces(acces: string | null) {
  try {
    if (acces) window.localStorage.setItem(CLE_ACCES, acces);
    else window.localStorage.removeItem(CLE_ACCES);
  } catch {
    /* stockage indisponible */
  }
}

/** Jeton CSRF Django (cookie `csrftoken`, lisible par le front). */
export function jetonCsrf(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const ligne = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="));
  return ligne ? decodeURIComponent(ligne.slice("csrftoken=".length)) : undefined;
}

/* ------------------------------------------------------------ Requêtes */

interface Options {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** false pour les routes publiques (connexion, réinitialisation). */
  auth?: boolean;
  signal?: AbortSignal;
  /** En-têtes supplémentaires (ex. `Idempotency-Key`). */
  headers?: Record<string, string>;
  /** Envoie les cookies (rafraîchissement, CSRF) : routes `/auth/*`. */
  cookies?: boolean;
  /** Corps multipart (envoi de fichier) ; remplace `body`. */
  formulaire?: FormData;
}

let rafraichissementEnCours: Promise<string | null> | null = null;

async function rafraichir(): Promise<string | null> {
  // Une seule requête de rafraîchissement à la fois, partagée par les appels concurrents.
  rafraichissementEnCours ??= (async () => {
    try {
      const csrf = jetonCsrf();
      const rep = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...(csrf ? { "X-CSRFToken": csrf } : {}) },
      });
      if (!rep.ok) {
        enregistrerAcces(null);
        return null;
      }
      const data = (await rep.json()) as { access?: string };
      enregistrerAcces(data.access ?? null);
      return data.access ?? null;
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

/** Envoie la requête (avec jeton d'accès, rafraîchi une fois sur 401) et renvoie la réponse brute. */
async function requete(
  chemin: string,
  { method = "GET", body, auth = true, signal, headers, cookies = false, formulaire }: Options,
  accept: string,
): Promise<Response> {
  const envoyer = (access?: string | null) => {
    const csrf = cookies ? jetonCsrf() : undefined;
    return fetch(`${API_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`, {
      method,
      signal,
      credentials: cookies ? "include" : "same-origin",
      headers: {
        Accept: accept,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
        ...headers,
      },
      // Multipart : le navigateur pose lui-même le Content-Type et sa frontière.
      body: formulaire ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  };

  let rep: Response;
  try {
    rep = await envoyer(auth ? lireAcces() : undefined);
    if (auth && rep.status === 401) {
      const access = await rafraichir();
      if (access) rep = await envoyer(access);
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "reseau", "Serveur injoignable. Vérifiez votre connexion.");
  }
  if (!rep.ok) throw await lireErreur(rep);
  return rep;
}

export async function api<T = unknown>(chemin: string, options: Options = {}): Promise<T> {
  const rep = await requete(chemin, options, "application/json");
  if (rep.status === 204 || rep.status === 202) return undefined as T;
  return (await rep.json()) as T;
}

/** Fichier binaire authentifié (QR en PNG, export CSV…) avec ses en-têtes. */
export async function apiFichier(chemin: string, options: Options = {}): Promise<{ blob: Blob; entetes: Headers }> {
  const rep = await requete(chemin, options, "*/*");
  return { blob: await rep.blob(), entetes: rep.headers };
}

/** Propose au navigateur d'enregistrer un fichier reçu de l'API. */
export function telechargerBlob(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Vrai si un jeton d'accès est présent (sans garantie de validité). */
export function estConnecte(): boolean {
  return !!lireAcces();
}

/** Clé d'idempotence aléatoire (≤ 64 caractères) pour les créations. */
export function cleIdempotence(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Message lisible pour l'utilisateur à partir de n'importe quelle erreur. */
export function messageErreur(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "validation_error" && e.details && typeof e.details === "object") {
      const premier = Object.values(e.details as Record<string, unknown>)[0];
      const texte = Array.isArray(premier) ? premier[0] : premier;
      if (typeof texte === "string") return texte;
    }
    return e.message;
  }
  return "Erreur inattendue.";
}

/** Réponse paginée standard du backend (`common/pagination.py`). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Récupère toutes les pages d'une liste paginée (bornée à 20 pages). */
export async function toutesLesPages<T>(chemin: string, signal?: AbortSignal): Promise<T[]> {
  const sep = chemin.includes("?") ? "&" : "?";
  const resultats: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const rep = await api<Page<T> | T[]>(`${chemin}${sep}page=${page}&page_size=100`, { signal });
    if (Array.isArray(rep)) return rep; // vue non paginée
    resultats.push(...rep.results);
    if (!rep.next) break;
  }
  return resultats;
}
