import type { Metadata } from "next";
import { CommandesService } from "@/components/salle/commandes-service";

export const metadata: Metadata = { title: "Commandes du service" };

export default function PageSalle() {
  return <CommandesService />;
}
