"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { cx } from "@/components/ui/primitives";
import { MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import type { Commande, Disponibilite } from "@/lib/types";

/** K2 · Signaler une indisponibilité (plat temporairement indisponible ou épuisé). */
export function ModaleIndisponibilite({
  commande,
  horsLigne,
  onFermer,
}: {
  commande: Commande;
  horsLigne: boolean;
  onFermer: () => void;
}) {
  const { commandes, signalerIndisponibilite } = useService();
  const [platId, setPlatId] = useState(commande.lignes[0]?.platId ?? "");
  const [choix, setChoix] = useState<Exclude<Disponibilite, "disponible">>("temporaire");
  const plat = commande.lignes.find((l) => l.platId === platId);

  const concernees = commandes.filter(
    (c) => ["confirmee", "preparation"].includes(c.statut) && c.lignes.some((l) => l.platId === platId),
  );

  return (
    <Modale ouverte onFermer={onFermer} titreId="titre-indispo" className="max-w-[720px] rounded-3xl text-encre" fond="bg-[rgba(8,14,12,.55)]">
      <div className="flex flex-col gap-[22px] p-8">
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-bold tracking-[.14em] text-terracotta">SIGNALER UNE INDISPONIBILITÉ</span>
          {commande.lignes.length > 1 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {commande.lignes.map((l) => (
                <button
                  key={l.platId}
                  type="button"
                  onClick={() => setPlatId(l.platId)}
                  aria-pressed={l.platId === platId}
                  className={cx(
                    "h-12 cursor-pointer rounded-full px-5 text-lg font-bold",
                    l.platId === platId ? "bg-vert text-creme" : "border border-bordure-2 bg-papier text-vert",
                  )}
                >
                  {l.nom}
                </button>
              ))}
            </div>
          ) : null}
          <h2 id="titre-indispo" className="m-0 text-[34px] font-bold text-vert">
            {plat?.nom}
          </h2>
          <span className="text-lg text-texte-2">Le plat ne pourra plus être ajouté depuis le menu client.</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              ["temporaire", "Temporairement", "Retour prévu ce service", "clock", "text-attention"],
              ["epuise", "Épuisé", "Jusqu'au prochain service", "ban", "text-danger"],
            ] as const
          ).map(([cle, titre, detail, icone, couleur]) => (
            <button
              key={cle}
              type="button"
              aria-pressed={choix === cle}
              onClick={() => setChoix(cle)}
              className={cx(
                "flex h-24 cursor-pointer flex-col justify-center gap-1 rounded-2xl bg-papier px-[18px] py-4 text-left",
                choix === cle ? "border-[2.5px] border-vert" : "border-[1.5px] border-bordure-2",
              )}
            >
              <span className={cx("flex items-center gap-2.5 text-[22px] font-bold", couleur)}>
                <Icon name={icone} className="size-6" />
                {titre}
              </span>
              <span className="text-base text-texte-2">{detail}</span>
            </button>
          ))}
        </div>

        {concernees.length > 0 ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-danger-fond px-[18px] py-4 text-lg font-medium">
            <Icon name="alert" className="size-6 text-danger" />
            <span>
              {concernees.length} commande{concernees.length > 1 ? "s" : ""} en cours contien{concernees.length > 1 ? "nent" : "t"} ce plat :{" "}
              {concernees.map((c) => `N° ${c.numero}, ${MODES_SERVICE[c.mode].court(c.emplacement).toLowerCase()}`).join(" ; ")}. La salle sera prévenue.
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <button
            type="button"
            onClick={onFermer}
            className="h-16 cursor-pointer rounded-xl border-2 border-vert text-xl font-bold text-vert"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={() => {
              signalerIndisponibilite(platId, choix);
              onFermer();
            }}
            className="flex h-16 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-vert text-xl font-bold text-creme"
          >
            <Icon name="check" className="size-[22px]" />
            Signaler
          </button>
        </div>
        {horsLigne ? (
          <span className="text-[15px] text-texte-3">Hors ligne : le signalement sera envoyé dès le retour de la connexion.</span>
        ) : null}
      </div>
    </Modale>
  );
}
