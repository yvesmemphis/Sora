import type { Metadata } from "next";
import { Parametres } from "@/components/admin/parametres";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Paramètres" };

export default function PageParametres() {
  return <Parametres />;
}
