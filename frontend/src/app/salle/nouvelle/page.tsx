import type { Metadata } from "next";
import { SaisieCommande } from "@/components/salle/saisie-commande";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Nouvelle commande" };

export default function PageNouvelleCommande() {
  return <SaisieCommande />;
}
