import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ServiceProvider } from "@/lib/staff/service";

export const metadata: Metadata = { title: "Cuisine" };

/** Écran de cuisine : fond nuit verte, lisible à 1 ou 2 mètres. */
export default function CuisineLayout({ children }: { children: ReactNode }) {
  return (
    <ServiceProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-nuit text-creme">{children}</div>
    </ServiceProvider>
  );
}
