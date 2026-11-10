import type { Metadata } from "next";
import { Panier } from "@/components/client/panier";

export const metadata: Metadata = { title: "Mon panier" };

export default function PagePanier() {
  return <Panier />;
}
