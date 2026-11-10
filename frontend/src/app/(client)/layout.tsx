import type { ReactNode } from "react";
import { PanierProvider } from "@/lib/client/panier";

/**
 * Espace client : application web ouverte par QR code, sans compte.
 * Conçue pour un smartphone (390 px) et centrée sur grand écran.
 */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PanierProvider>
      <div className="flex min-h-dvh justify-center bg-toile">
        <div className="relative flex min-h-dvh w-full max-w-[440px] flex-col bg-creme shadow-[0_0_60px_-30px_rgba(20,35,31,.35)]">
          {children}
        </div>
      </div>
    </PanierProvider>
  );
}
