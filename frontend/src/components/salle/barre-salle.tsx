"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { LogoMark, cx } from "@/components/ui/primitives";
import { useEnLigne, useHorloge } from "@/lib/hooks";

/** Utilisateur de démonstration ; viendra de `/auth/me/`. */
export const SERVEUR_DEMO = { nom: "Awa K.", initiales: "AK", role: "Serveuse" };

const ONGLETS = [
  { href: "/salle", libelle: "Commandes", icone: "list" as const },
  { href: "/salle/nouvelle", libelle: "Nouvelle commande", icone: "plus" as const },
];

export function BarreSalle() {
  const chemin = usePathname();
  const heure = useHorloge();
  const enLigne = useEnLigne();

  return (
    <header className="flex h-[68px] shrink-0 items-center gap-4 bg-vert px-4 text-creme md:gap-7 md:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <LogoMark size={26} clair />
        <span className="hidden font-serif text-lg font-semibold sm:inline">Maison Sora</span>
        <span className="ml-1.5 text-xs font-bold tracking-[.14em] text-or">SALLE</span>
      </Link>
      <nav className="flex h-full items-stretch gap-1">
        {ONGLETS.map((o) => {
          const actif = chemin === o.href;
          return (
            <Link
              key={o.href}
              href={o.href}
              aria-current={actif ? "page" : undefined}
              className={cx(
                "flex items-center gap-2 border-b-[3px] px-3 text-[15px] md:px-4",
                actif ? "border-or font-bold" : "border-transparent font-medium opacity-80 hover:opacity-100",
              )}
            >
              <Icon name={o.icone} className="size-[18px]" />
              <span className="hidden sm:inline">{o.libelle}</span>
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-5 text-sm">
        <span className="hidden items-center gap-2 lg:flex">
          <span className={cx("size-2 rounded-full", enLigne ? "bg-en-ligne" : "bg-attention-fond")} />
          {enLigne ? "En ligne · actualisé toutes les 5 s" : "Hors ligne"}
        </span>
        <span className="tabular font-bold">{heure}</span>
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-creme text-[13px] font-bold text-vert">
            {SERVEUR_DEMO.initiales}
          </span>
          <span className="hidden flex-col leading-tight md:flex">
            <span className="font-bold">{SERVEUR_DEMO.nom}</span>
            <span className="text-xs opacity-75">{SERVEUR_DEMO.role}</span>
          </span>
        </span>
      </div>
    </header>
  );
}
