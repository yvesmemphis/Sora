import type { Metadata } from "next";
import { CommandesService } from "@/components/salle/commandes-service";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Commandes du service" };

export default function PageSalle() {
  return <CommandesService />;
}
