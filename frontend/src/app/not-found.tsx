import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";

export default function PageIntrouvable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <LogoMark size={44} />
      <h1 className="m-0 font-serif text-4xl font-semibold text-vert">Page introuvable</h1>
      <p className="m-0 max-w-sm text-[15px] text-texte-2">Ce lien ne mène nulle part. Revenez à l&apos;accueil pour choisir votre espace.</p>
      <Link href="/" className="flex h-12 items-center rounded-xl bg-vert px-5 font-bold text-creme">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
