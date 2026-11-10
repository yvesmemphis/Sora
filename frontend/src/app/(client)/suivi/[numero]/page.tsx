import type { Metadata } from "next";
import { Suspense } from "react";
import { SuiviCommande } from "@/components/client/suivi-commande";

export const metadata: Metadata = { title: "Suivi de commande" };

export default function PageSuivi({ params }: PageProps<"/suivi/[numero]">) {
  // Le numéro n'est connu qu'à la requête : la zone dynamique est isolée dans Suspense.
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-texte-3">Chargement…</div>}>
      <SuiviCommande params={params} />
    </Suspense>
  );
}
