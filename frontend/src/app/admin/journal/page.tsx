import type { Metadata } from "next";
import { Journal } from "@/components/admin/journal";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Journal d'activité" };

export default function PageJournal() {
  return <Journal />;
}
