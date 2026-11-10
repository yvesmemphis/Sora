import type { Metadata } from "next";
import { Utilisateurs } from "@/components/admin/utilisateurs";

export const metadata: Metadata = { title: "Utilisateurs" };

export default function PageAdmin() {
  return <Utilisateurs />;
}
