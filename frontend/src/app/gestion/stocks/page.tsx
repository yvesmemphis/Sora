import type { Metadata } from "next";
import { Stocks } from "@/components/gestion/stocks";

/** Espace protégé, rendu après vérification de la session (voir le layout). */
export const instant = false;

export const metadata: Metadata = { title: "Stocks" };

export default function PageStocks() {
  return <Stocks />;
}
