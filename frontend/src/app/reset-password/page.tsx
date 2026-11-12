import type { Metadata } from "next";
import { Suspense } from "react";
import { FormulaireReinitialisation } from "@/components/auth/formulaire-reinitialisation";
import { Logo } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Choisir un mot de passe" };

/** Page ouverte depuis l'e-mail d'invitation ou de réinitialisation (lien généré par le backend). */
export default function PageReinitialisation() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_560px]">
      <div className="hidden flex-col justify-between bg-vert p-14 text-creme lg:flex">
        <Logo clair taille="lg" />
        <div className="flex max-w-[560px] flex-col gap-4">
          <h1 className="m-0 font-serif text-5xl leading-[1.05] font-semibold">Bienvenue dans l&apos;équipe.</h1>
          <p className="m-0 text-lg leading-relaxed text-[#D9E0DB]">
            Choisissez votre mot de passe pour accéder à votre espace : salle, cuisine, gestion ou administration.
          </p>
        </div>
        <span className="text-sm text-creme/60">Le lien reçu par e-mail est valable une heure.</span>
      </div>
      <div className="flex flex-col justify-center gap-8 px-6 py-10 sm:px-14">
        <div className="lg:hidden">
          <Logo />
        </div>
        {/* Les paramètres `uid` et `token` sont lus dans l'URL : zone dynamique isolée. */}
        <Suspense fallback={<div className="text-texte-3">Chargement…</div>}>
          <FormulaireReinitialisation />
        </Suspense>
      </div>
    </div>
  );
}
