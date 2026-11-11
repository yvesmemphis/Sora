import type { Metadata } from "next";
import { Suspense } from "react";
import { FichePlatDepuisUrl } from "@/components/client/fiche-plat";

export const metadata: Metadata = { title: "Plat" };

export default function PagePlat({ params }: PageProps<"/menu/[slug]">) {
  // La carte vient de l'API côté navigateur : la zone dynamique est isolée dans Suspense.
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-texte-3">Chargement…</div>}>
      <FichePlatDepuisUrl params={params} />
    </Suspense>
  );
}
