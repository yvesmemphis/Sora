import type { Metadata } from "next";
import { CommandesJour } from "@/components/gestion/commandes-jour";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Commandes" };

export default function PageCommandes() {
  return <CommandesJour />;
}
