import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarreLaterale, type EntreeNavigation } from "@/components/espace/barre-laterale";
import { SessionProvider } from "@/lib/staff/session";

/**
 * Espace protégé : la session est vérifiée dans le navigateur (`SessionProvider`),
 * la page ne peut donc pas s'afficher instantanément depuis le préchargement.
 */
export const instant = false;

export const metadata: Metadata = { title: { default: "Gestion", template: "%s · Gestion · Maison Sora" } };

const ENTREES: EntreeNavigation[] = [
  { href: "/gestion", libelle: "Tableau de bord", icone: "grid" },
  { href: "/gestion/commandes", libelle: "Commandes", icone: "list" },
  { href: "/gestion/menu", libelle: "Menu et recettes", icone: "book" },
  { href: "/gestion/stocks", libelle: "Stocks", icone: "box" },
  { href: "/gestion/referentiel", libelle: "Référentiel", icone: "edit" },
  { href: "/gestion/production", libelle: "Production", icone: "flame" },
  { href: "/gestion/previsions", libelle: "Prévisions IA", icone: "spark" },
  { href: "/gestion/caisse", libelle: "Clôture de caisse", icone: "wallet" },
];

/** Espace gestionnaire : ordinateur ou tablette. */
export default function GestionLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider roles={["MANAGER", "ADMIN"]}>
      <div className="flex min-h-dvh flex-col bg-creme lg:flex-row">
        <BarreLaterale sousTitre="GESTION" entrees={ENTREES} />
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-7">{children}</main>
      </div>
    </SessionProvider>
  );
}
