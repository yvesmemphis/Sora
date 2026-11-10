import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarreLaterale, type EntreeNavigation } from "@/components/espace/barre-laterale";

export const metadata: Metadata = { title: { default: "Gestion", template: "%s · Gestion · Maison Sora" } };

const ENTREES: EntreeNavigation[] = [
  { href: "/gestion", libelle: "Tableau de bord", icone: "grid" },
  { href: "/gestion/commandes", libelle: "Commandes", icone: "list" },
  { href: "/gestion/menu", libelle: "Menu et recettes", icone: "book" },
  { href: "/gestion/stocks", libelle: "Stocks", icone: "box" },
  { href: "/gestion/production", libelle: "Production", icone: "flame" },
  { href: "/gestion/previsions", libelle: "Prévisions IA", icone: "spark" },
  { href: "/gestion/caisse", libelle: "Clôture de caisse", icone: "wallet" },
];

/** Espace gestionnaire : ordinateur ou tablette. */
export default function GestionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-creme lg:flex-row">
      <BarreLaterale
        sousTitre="GESTION"
        entrees={ENTREES}
        utilisateur={{ nom: "Mariam Diallo", initiales: "MD", role: "Gestionnaire" }}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
