import type { Metadata } from "next";
import { Previsions } from "@/components/gestion/previsions";

export const metadata: Metadata = { title: "Prévisions IA" };

export default function PagePrevisions() {
  return <Previsions />;
}
