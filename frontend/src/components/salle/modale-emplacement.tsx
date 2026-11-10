"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { Bouton, cx } from "@/components/ui/primitives";
import { MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import type { Commande, ModeService } from "@/lib/types";

/** Correction de la table ou de la chambre d'une commande. */
export function ModaleEmplacement({
  commande,
  ouverte,
  onFermer,
}: {
  commande: Commande;
  ouverte: boolean;
  onFermer: () => void;
}) {
  const { modifierEmplacement } = useService();
  const [mode, setMode] = useState<ModeService>(commande.mode);
  const [valeur, setValeur] = useState(commande.mode === "emporter" ? "" : commande.emplacement);

  const requis = mode !== "emporter";

  function enregistrer() {
    if (requis && !valeur.trim()) return;
    modifierEmplacement(commande.numero, mode, requis ? valeur.trim() : "Au comptoir");
    onFermer();
  }

  return (
    <Modale ouverte={ouverte} onFermer={onFermer} titreId="titre-emplacement" className="max-w-[460px]">
      <div className="flex flex-col gap-4 p-7">
        <h2 id="titre-emplacement" className="m-0 font-serif text-2xl font-semibold text-vert">
          Emplacement de la commande n° {commande.numero}
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(MODES_SERVICE) as ModeService[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
              className={cx(
                "flex h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-bold",
                m === mode ? "bg-vert text-creme" : "border border-bordure text-vert",
              )}
            >
              <Icon name={MODES_SERVICE[m].icone} className="size-5" />
              {MODES_SERVICE[m].libelle}
            </button>
          ))}
        </div>
        {requis ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">{MODES_SERVICE[mode].champ}</span>
            <input
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              inputMode="numeric"
              className="h-[52px] rounded-xl border-[1.5px] border-vert bg-papier px-3.5 text-lg font-bold outline-none"
            />
          </label>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <Bouton variante="contour" hauteur="lg" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton hauteur="lg" onClick={enregistrer} disabled={requis && !valeur.trim()}>
            Enregistrer
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}
