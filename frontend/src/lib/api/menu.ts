/**
 * Menu : carte publique (`/public/menu/`) et gestion (`/categories/`, `/dishes/`).
 */
import type { Disponibilite, ModePaiement, Plat } from "../types";
import { api, toutesLesPages } from "./client";
import { montant, paiementFront } from "./conversions";

/** Statut de disponibilité d'un plat côté backend (`Dish.AvailabilityStatus`). */
export type StatutDisponibiliteApi = "AVAILABLE" | "SOLD_OUT" | "TEMPORARILY_UNAVAILABLE";

export const DISPONIBILITE_VERS_FRONT: Record<StatutDisponibiliteApi, Disponibilite> = {
  AVAILABLE: "disponible",
  SOLD_OUT: "epuise",
  TEMPORARILY_UNAVAILABLE: "temporaire",
};

export const DISPONIBILITE_VERS_BACK: Record<Disponibilite, StatutDisponibiliteApi> = {
  disponible: "AVAILABLE",
  epuise: "SOLD_OUT",
  temporaire: "TEMPORARILY_UNAVAILABLE",
};

function disponibiliteDe(d: { is_available: boolean; availability_status?: StatutDisponibiliteApi }): Disponibilite {
  if (d.availability_status) return DISPONIBILITE_VERS_FRONT[d.availability_status] ?? "temporaire";
  return d.is_available ? "disponible" : "temporaire";
}

/* ------------------------------------------------------------ Public */

interface PlatPublicApi {
  id: string;
  name: string;
  description: string;
  price: string;
  allergens: string[];
  image: string | null;
  category: string;
  is_available: boolean;
  availability_status?: StatutDisponibiliteApi;
  preparation_time: number | null;
}

interface MenuPublicApi {
  name: string;
  ordering_enabled: boolean;
  withdrawal_delay_minutes?: number;
  opening_hours?: Record<string, unknown>;
  accepted_payment_methods?: string[];
  currency?: string;
  dishes: PlatPublicApi[];
}

export interface MenuPublic {
  nomRestaurant: string;
  commandesOuvertes: boolean;
  /** Délai de désistement annoncé au client (minutes). */
  delaiDesistementMin: number;
  /** Modes de paiement proposés au client (parmi ceux gérés par le front). */
  modesPaiement: ModePaiement[];
  devise: string;
  /** Horaires bruts du réglage `opening_hours` (jours en anglais). */
  horaires: Record<string, unknown>;
  categories: string[];
  plats: Plat[];
}

const JOURS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** « 19:00 » → « 19 h », « 19:30 » → « 19 h 30 ». */
function heureLisible(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
}

/**
 * Horaires du jour pour la carte client : « Service aujourd'hui de 11 h à 23 h »,
 * « Fermé aujourd'hui », ou null si les horaires ne sont pas renseignés.
 */
export function horairesDuJour(horaires: Record<string, unknown>, maintenant = new Date()): string | null {
  const jour = horaires[JOURS_EN[maintenant.getDay()]];
  if (!jour || typeof jour !== "object") return null;
  if ("closed" in jour && (jour as { closed?: boolean }).closed) return "Fermé aujourd'hui";
  const plages = (Array.isArray(jour) ? jour : [jour]) as { open?: string; close?: string }[];
  const textes = plages.filter((p) => p.open && p.close).map((p) => `de ${heureLisible(p.open!)} à ${heureLisible(p.close!)}`);
  return textes.length ? `Service aujourd'hui ${textes.join(" et ")}` : null;
}

export async function chargerMenuPublic(signal?: AbortSignal): Promise<MenuPublic> {
  const data = await api<MenuPublicApi>("/public/menu/", { auth: false, signal });
  const plats: Plat[] = data.dishes.map((d) => ({
    id: d.id,
    slug: d.id,
    nom: d.name,
    description: d.description,
    categorie: d.category,
    prix: montant(d.price),
    preparationMin: d.preparation_time,
    disponibilite: disponibiliteDe(d),
    allergenes: d.allergens ?? [],
    image: d.image,
  }));
  return {
    nomRestaurant: data.name,
    commandesOuvertes: data.ordering_enabled,
    delaiDesistementMin: data.withdrawal_delay_minutes ?? 5,
    modesPaiement: modesProposes(data.accepted_payment_methods),
    devise: data.currency ?? "XOF",
    horaires: data.opening_hours ?? {},
    categories: [...new Set(plats.map((p) => p.categorie))],
    plats,
  };
}

/** Modes acceptés par le restaurant que le client peut annoncer (espèces, carte). */
export function modesProposes(codes: string[] | undefined): ModePaiement[] {
  if (!codes) return ["especes", "carte"];
  const acceptes = new Set(codes.map(paiementFront));
  const modes = (["especes", "carte"] as ModePaiement[]).filter((m) => acceptes.has(m));
  return modes.length ? modes : ["especes", "carte"];
}

/* ------------------------------------------------------------ Gestion */

export interface CategorieApi {
  id: string;
  name: string;
  position: number;
  is_active: boolean;
}

export interface PlatApi {
  id: string;
  category: string;
  name: string;
  description: string;
  price: string;
  preparation_time: number | null;
  allergens: string[];
  is_available: boolean;
  availability_status?: StatutDisponibiliteApi;
  is_published: boolean;
  image: string | null;
}

export function listerCategories(signal?: AbortSignal): Promise<CategorieApi[]> {
  return toutesLesPages<CategorieApi>("/categories/", signal);
}

export function listerPlats(signal?: AbortSignal): Promise<PlatApi[]> {
  return toutesLesPages<PlatApi>("/dishes/", signal);
}

export function platDepuisApi(d: PlatApi, categories: CategorieApi[]): Plat {
  const cat = categories.find((c) => c.id === d.category);
  return {
    id: d.id,
    slug: d.id,
    nom: d.name,
    description: d.description,
    categorie: cat?.name ?? "Autres",
    categorieId: d.category,
    prix: montant(d.price),
    preparationMin: d.preparation_time,
    disponibilite: disponibiliteDe(d),
    allergenes: d.allergens ?? [],
    image: d.image,
    publie: d.is_published,
  };
}

/** Carte complète vue par le personnel (plats publiés, catégories actives). */
export async function chargerCartePersonnel(signal?: AbortSignal): Promise<{ categories: string[]; plats: Plat[] }> {
  const [categories, plats] = await Promise.all([listerCategories(signal), listerPlats(signal)]);
  const actives = categories.filter((c) => c.is_active).sort((a, b) => a.position - b.position);
  const liste = plats
    .filter((p) => p.is_published && actives.some((c) => c.id === p.category))
    .map((p) => platDepuisApi(p, categories));
  return { categories: actives.map((c) => c.name), plats: liste };
}

export function modifierPlat(
  id: string,
  donnees: Partial<Pick<PlatApi, "name" | "description" | "price" | "preparation_time" | "allergens" | "is_published" | "category">>,
): Promise<PlatApi> {
  return api<PlatApi>(`/dishes/${id}/`, { method: "PATCH", body: donnees });
}

export function creerPlat(
  donnees: Pick<PlatApi, "name" | "category" | "price"> & Partial<Pick<PlatApi, "description" | "preparation_time" | "allergens">>,
): Promise<PlatApi> {
  return api<PlatApi>("/dishes/", { method: "POST", body: donnees });
}

/**
 * Rôles cuisine et gestion : rend un plat disponible, épuisé (jusqu'à
 * réapprovisionnement) ou temporairement indisponible.
 */
export function changerDisponibilite(id: string, disponibilite: Disponibilite | boolean): Promise<PlatApi> {
  const statut =
    typeof disponibilite === "boolean"
      ? disponibilite
        ? "AVAILABLE"
        : "TEMPORARILY_UNAVAILABLE"
      : DISPONIBILITE_VERS_BACK[disponibilite];
  return api<PlatApi>(`/dishes/${id}/availability/`, { method: "POST", body: { availability_status: statut } });
}

export function creerCategorie(nom: string, position: number): Promise<CategorieApi> {
  return api<CategorieApi>("/categories/", { method: "POST", body: { name: nom, position, is_active: true } });
}

export function modifierCategorie(id: string, donnees: Partial<Pick<CategorieApi, "name" | "position" | "is_active">>): Promise<CategorieApi> {
  return api<CategorieApi>(`/categories/${id}/`, { method: "PATCH", body: donnees });
}

/** Photo d'un plat (multipart, JPEG/PNG/WebP, contrôlée par le backend). */
export function envoyerPhotoPlat(id: string, fichier: File): Promise<PlatApi> {
  const formulaire = new FormData();
  formulaire.append("image", fichier);
  return api<PlatApi>(`/dishes/${id}/`, { method: "PATCH", formulaire });
}
