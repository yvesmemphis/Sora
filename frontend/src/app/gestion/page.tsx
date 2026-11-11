import type { Metadata } from "next";
import { TableauDeBord } from "@/components/gestion/tableau-de-bord";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Tableau de bord" };

export default function PageGestion() {
  return <TableauDeBord />;
}
