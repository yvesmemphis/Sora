import type { Metadata } from "next";
import { FormulaireConnexion } from "@/components/auth/formulaire-connexion";
import { Logo } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Connexion du personnel" };

export default function PageConnexion() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_560px]">
      <div className="hidden flex-col justify-between bg-vert p-14 text-creme lg:flex">
        <Logo clair taille="lg" />
        <div className="flex max-w-[560px] flex-col gap-4">
          <h1 className="m-0 font-serif text-5xl leading-[1.05] font-semibold">De la carte à la table, sans détour.</h1>
          <p className="m-0 text-lg leading-relaxed text-[#D9E0DB]">
            Salle, cuisine, gestion et administration : chaque membre de l&apos;équipe retrouve son espace après connexion.
          </p>
        </div>
        <span className="text-sm text-creme/60">Les clients commandent sans compte, depuis le QR code.</span>
      </div>
      <div className="flex flex-col justify-center gap-8 px-6 py-10 sm:px-14">
        <div className="lg:hidden">
          <Logo />
        </div>
        <FormulaireConnexion />
      </div>
    </div>
  );
}
