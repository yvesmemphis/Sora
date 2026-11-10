"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import type { Commande } from "@/lib/types";

/** Bouton « ⋯ » d'une carte cuisine : retard, indisponibilité, ticket. */
export function MenuActionsCuisine({
  commande,
  enPreparation,
  onRetard,
  onIndisponibilite,
  onTicket,
}: {
  commande: Commande;
  enPreparation: boolean;
  onRetard: () => void;
  onIndisponibilite: () => void;
  onTicket: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", fermer);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const actions: { libelle: string; icone: NomIcone; faire: () => void; visible: boolean }[] = [
    { libelle: "Signaler un retard", icone: "alert", faire: onRetard, visible: enPreparation },
    { libelle: "Plat indisponible", icone: "ban", faire: onIndisponibilite, visible: true },
    { libelle: "Imprimer le ticket", icone: "printer", faire: onTicket, visible: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Autres actions pour la commande ${commande.numero}`}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-creme/30 text-creme"
      >
        <Icon name="more" className="size-6" />
      </button>
      {ouvert ? (
        <div
          role="menu"
          className="absolute right-0 bottom-[72px] z-30 flex w-72 flex-col overflow-hidden rounded-2xl bg-creme text-encre shadow-[0_20px_40px_-12px_rgba(0,0,0,.6)]"
        >
          {actions
            .filter((a) => a.visible)
            .map((a) => (
              <button
                key={a.libelle}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOuvert(false);
                  a.faire();
                }}
                className="flex h-16 cursor-pointer items-center gap-3 border-b border-ligne px-5 text-lg font-bold last:border-b-0 hover:bg-sable"
              >
                <Icon name={a.icone} className="size-[22px] text-vert" />
                {a.libelle}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
