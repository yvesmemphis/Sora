import type { Metadata } from "next";
import { MenuRecettes } from "@/components/gestion/menu-recettes";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Menu et recettes" };

export default function PageMenuRecettes() {
  return <MenuRecettes />;
}
