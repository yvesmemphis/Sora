"use client";

import { useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { PARAMETRES } from "@/lib/demo/admin";

/** A2 (suite) · Paramètres du service. */
export function Parametres() {
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(PARAMETRES.map((p) => [p.cle, p.valeur])),
  );
  const [etat, setEtat] = useState<"propre" | "modifie" | "enregistre">("propre");

  return (
    <>
      <EntetePage titre="Paramètres du service" sousTitre="S'appliquent à tous les écrans dès l'enregistrement." />
      <Carte className="flex max-w-[880px] flex-col gap-1.5 p-5">
        {PARAMETRES.map((p) => {
          const actif = p.cle === "chambre" && valeurs[p.cle] === "Activée";
          return (
            <div key={p.cle} className="flex flex-wrap items-center justify-between gap-4 border-t border-ligne-3 py-3.5 first:border-t-0">
              <div className="flex max-w-[560px] flex-col gap-0.5">
                <label htmlFor={`param-${p.cle}`} className="text-sm font-bold">
                  {p.nom}
                </label>
                <span className="text-xs leading-[17px] text-texte-3">{p.detail}</span>
              </div>
              <select
                id={`param-${p.cle}`}
                value={valeurs[p.cle]}
                disabled={p.options.length < 2}
                onChange={(e) => {
                  setValeurs((v) => ({ ...v, [p.cle]: e.target.value }));
                  setEtat("modifie");
                }}
                className={cx(
                  "h-10 min-w-[140px] cursor-pointer rounded-[10px] border border-bordure-2 px-3 text-center text-sm font-bold outline-none disabled:cursor-default",
                  actif ? "bg-vert text-creme" : "bg-papier text-encre",
                )}
              >
                {p.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          );
        })}
        <div className="mt-3 flex items-center gap-4">
          <Bouton hauteur="lg" disabled={etat !== "modifie"} onClick={() => setEtat("enregistre")}>
            Enregistrer les paramètres
          </Bouton>
          {etat === "enregistre" ? (
            <span className="flex items-center gap-1.5 text-sm font-bold text-ok">
              <Icon name="check" className="size-4" />
              Paramètres enregistrés
            </span>
          ) : null}
        </div>
      </Carte>
    </>
  );
}
