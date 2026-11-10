import type { Metadata } from "next";
import { Parametres } from "@/components/admin/parametres";

export const metadata: Metadata = { title: "Paramètres" };

export default function PageParametres() {
  return <Parametres />;
}
