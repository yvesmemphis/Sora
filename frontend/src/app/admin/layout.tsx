import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarreLaterale, type EntreeNavigation } from "@/components/espace/barre-laterale";
import { SessionProvider } from "@/lib/staff/session";

/**
 * Espace protégé : la session est vérifiée dans le navigateur (`SessionProvider`),
 * la page ne peut donc pas s'afficher instantanément depuis le préchargement.
 */
export const instant = false;

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration · Maison Sora" } };

const ENTREES: EntreeNavigation[] = [
  { href: "/admin", libelle: "Utilisateurs", icone: "users" },
  { href: "/admin/roles", libelle: "Rôles et permissions", icone: "shield" },
  { href: "/admin/qr", libelle: "QR et emplacements", icone: "qr" },
  { href: "/admin/parametres", libelle: "Paramètres", icone: "sliders" },
  { href: "/admin/journal", libelle: "Journal d'activité", icone: "list" },
];

/** Espace administrateur : ordinateur. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider roles={["ADMIN"]}>
      <div className="flex min-h-dvh flex-col bg-creme lg:flex-row">
        <BarreLaterale sousTitre="ADMINISTRATION" entrees={ENTREES} />
        <main className="flex min-w-0 flex-1 flex-col gap-[18px] px-4 py-6 md:px-8 md:py-7">{children}</main>
      </div>
    </SessionProvider>
  );
}
