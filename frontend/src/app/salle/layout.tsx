import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BarreSalle } from "@/components/salle/barre-salle";
import { ServiceProvider } from "@/lib/staff/service";
import { SessionProvider } from "@/lib/staff/session";

/**
 * Espace protégé : la session est vérifiée dans le navigateur (`SessionProvider`),
 * la page ne peut donc pas s'afficher instantanément depuis le préchargement.
 */
export const instant = false;

export const metadata: Metadata = { title: { default: "Salle", template: "%s · Salle · Maison Sora" } };

/** Espace serveur / salle, pensé pour une tablette. */
export default function SalleLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider roles={["WAITER", "MANAGER", "ADMIN"]}>
      <ServiceProvider>
        <div className="flex h-dvh flex-col overflow-hidden bg-creme">
          <BarreSalle />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </ServiceProvider>
    </SessionProvider>
  );
}
