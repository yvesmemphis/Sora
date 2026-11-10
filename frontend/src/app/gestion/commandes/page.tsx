import type { Metadata } from "next";
import { CommandesJour } from "@/components/gestion/commandes-jour";

export const metadata: Metadata = { title: "Commandes" };

export default function PageCommandes() {
  return <CommandesJour />;
}
