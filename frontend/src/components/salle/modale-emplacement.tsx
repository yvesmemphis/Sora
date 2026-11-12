"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { Bouton } from "@/components/ui/primitives";
import { MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import type { Commande } from "@/lib/types";

/**
 * Correction de la table ou de la chambre d'une commande (`PATCH /orders/{id}/location/`).
 * Le mode de service ne change pas ; possible tant que la préparation n'a pas commencé.
 */
export function ModaleEmplacement({
  commande,
  ouverte,
  onFermer,
}: {
  commande: Commande;
  ouverte: boolean;
  onFermer: () => void;
}) {
  const { changerEmplacement, emplacements } = useService();
  const [valeur, setValeur] = useState(commande.emplacement === "—" ? "" : commande.emplacement);
  const [envoi, setEnvoi] = useState(false);
  const mode = MODES_SERVICE[commande.mode];
  const type = commande.mode === "chambre" ? "ROOM" : "TABLE";
  const references = emplacements
    .filter((e) => e.is_active && e.type === type)
    .map((e) => (e.type === "TABLE" ? e.reference.replace(/^T/i, "") : e.reference));

  async function enregistrer() {
    if (!valeur.trim() || envoi) return;
    setEnvoi(true);
    const ok = await changerEmplacement(commande.numero, valeur.trim());
    setEnvoi(false);
    if (ok) onFermer();
  }

  return (
    <Modale ouverte={ouverte} onFermer={onFermer} titreId="titre-emplacement" className="max-w-[460px]">
      <form
        className="flex flex-col gap-4 p-7"
        onSubmit={(e) => {
          e.preventDefault();
          void enregistrer();
        }}
      >
        <h2 id="titre-emplacement" className="m-0 font-serif text-2xl font-semibold text-vert">
          Emplacement de la commande n° {commande.numero}
        </h2>
        <span className="flex items-center gap-2 text-sm text-texte-2">
          <Icon name={mode.icone} className="size-[18px] text-vert" />
          {mode.libelle} · actuellement {mode.court(commande.emplacement).toLowerCase()}
        </span>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{mode.champ}</span>
          <input
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            inputMode="numeric"
            list="emplacements-modale"
            autoFocus
            className="h-[52px] rounded-xl border-[1.5px] border-vert bg-papier px-3.5 text-lg font-bold outline-none"
          />
          <datalist id="emplacements-modale">
            {references.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <Bouton variante="contour" hauteur="lg" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" hauteur="lg" disabled={!valeur.trim() || envoi}>
            {envoi ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
