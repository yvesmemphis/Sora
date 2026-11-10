import type { Metadata } from "next";
import { SaisieCommande } from "@/components/salle/saisie-commande";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default function PageNouvelleCommande() {
  return <SaisieCommande />;
}
