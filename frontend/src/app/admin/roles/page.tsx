import type { Metadata } from "next";
import { MatricePermissions } from "@/components/admin/matrice-permissions";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Rôles et permissions" };

export default function PageRoles() {
  return <MatricePermissions />;
}
