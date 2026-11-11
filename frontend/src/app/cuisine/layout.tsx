import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceProvider } from "@/lib/staff/service";
import { SessionProvider } from "@/lib/staff/session";

/**
 * Espace protégé : la session est vérifiée dans le navigateur (`SessionProvider`),
 * la page ne peut donc pas s'afficher instantanément depuis le préchargement.
 */
export const instant = false;

export const metadata: Metadata = { title: "Cuisine" };

/** Écran de cuisine : fond nuit verte, lisible à 1 ou 2 mètres. */
export default function CuisineLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider roles={["KITCHEN", "MANAGER", "ADMIN"]} sombre>
      <ServiceProvider>
        <div className="flex h-dvh flex-col overflow-hidden bg-nuit text-creme">{children}</div>
      </ServiceProvider>
    </SessionProvider>
  );
}
