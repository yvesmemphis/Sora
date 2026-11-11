import type { Metadata } from "next";
import { Production } from "@/components/gestion/production";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Production et invendus" };

export default function PageProduction() {
  return <Production />;
}
