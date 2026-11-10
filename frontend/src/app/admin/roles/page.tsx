import type { Metadata } from "next";
import { MatricePermissions } from "@/components/admin/matrice-permissions";

export const metadata: Metadata = { title: "Rôles et permissions" };

export default function PageRoles() {
  return <MatricePermissions />;
}
