import type { Metadata } from "next";
import { Previsions } from "@/components/gestion/previsions";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Prévisions IA" };

export default function PagePrevisions() {
  return <Previsions />;
}
