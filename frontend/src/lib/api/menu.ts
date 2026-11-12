/**
 * Menu : carte publique (`/public/menu/`) et gestion (`/categories/`, `/dishes/`).
 */
import type { Plat } from "../types";
import { api, toutesLesPages } from "./client";
import { montant } from "./conversions";

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
  preparation_time: number | null;
}

interface MenuPublicApi {
  name: string;
  ordering_enabled: boolean;
  dishes: PlatPublicApi[];
}

export interface MenuPublic {
  nomRestaurant: string;
  commandesOuvertes: boolean;
  categories: string[];
  plats: Plat[];
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
    // L'API ne distingue pas encore « temporairement » et « épuisé ».
    disponibilite: d.is_available ? "disponible" : "temporaire",
    allergenes: d.allergens ?? [],
    image: d.image,
  }));
  return {
    nomRestaurant: data.name,
    commandesOuvertes: data.ordering_enabled,
    categories: [...new Set(plats.map((p) => p.categorie))],
    plats,
  };
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
    disponibilite: d.is_available ? "disponible" : "temporaire",
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

/** Rôles cuisine et gestion : rend un plat disponible ou non sur la carte. */
export function changerDisponibilite(id: string, disponible: boolean): Promise<PlatApi> {
  return api<PlatApi>(`/dishes/${id}/availability/`, { method: "POST", body: { is_available: disponible } });
}
