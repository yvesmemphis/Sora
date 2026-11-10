import type { Metadata } from "next";
import { TableauDeBord } from "@/components/gestion/tableau-de-bord";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function PageGestion() {
  return <TableauDeBord />;
}
