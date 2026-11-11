import type { Metadata } from "next";
import { ClotureCaisse } from "@/components/gestion/cloture-caisse";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Clôture de caisse" };

export default function PageCaisse() {
  return <ClotureCaisse />;
}
