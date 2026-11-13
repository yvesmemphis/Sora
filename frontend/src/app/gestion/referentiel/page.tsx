import type { Metadata } from "next";
import { Referentiel } from "@/components/gestion/referentiel";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Référentiel" };

export default function PageReferentiel() {
  return <Referentiel />;
}
