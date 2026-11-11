import type { Metadata } from "next";
import { Utilisateurs } from "@/components/admin/utilisateurs";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Utilisateurs" };

export default function PageAdmin() {
  return <Utilisateurs />;
}
