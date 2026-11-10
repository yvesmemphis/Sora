import type { Metadata } from "next";
import { Journal } from "@/components/admin/journal";

export const metadata: Metadata = { title: "Journal d'activité" };

export default function PageJournal() {
  return <Journal />;
}
