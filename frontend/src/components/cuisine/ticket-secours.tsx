"use client";

import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { trouverPlat } from "@/lib/demo/menu";
import { MODES_PAIEMENT, MODES_SERVICE } from "@/lib/statuts";
import type { Commande } from "@/lib/types";

const TIRETS = "--------------------------------";

/** K3 · Ticket de secours 80 mm, imprimable même en cas de coupure réseau. */
export function TicketSecours({ commande, onFermer }: { commande: Commande; onFermer: () => void }) {
  const maintenant = new Date();
  const hh = (n: number) => String(n).padStart(2, "0");
  const heure = `${hh(maintenant.getHours())}:${hh(maintenant.getMinutes())}`;
  const preparation = Math.max(...commande.lignes.map((l) => trouverPlat(l.platId)?.preparationMin ?? 15));

  return (
    <Modale ouverte onFermer={onFermer} titreId="titre-ticket" className="max-w-[380px] bg-transparent shadow-none" fond="bg-[rgba(8,14,12,.7)]">
      <div className="flex flex-col items-center gap-4">
        <div className="zone-impression flex w-[320px] flex-col gap-0.5 bg-white px-6 pt-7 pb-9 font-mono text-sm leading-5 text-[#111] shadow-[0_20px_40px_-24px_rgba(0,0,0,.4)]">
          <span id="titre-ticket" className="text-center text-base font-bold">
            MAISON SORA
          </span>
          <span className="text-center">CUISINE</span>
          <span>{TIRETS}</span>
          <span className="flex justify-between text-xl leading-7 font-bold">
            <span>N° {commande.numero}</span>
            <span>{heure}</span>
          </span>
          <span>{MODES_SERVICE[commande.mode].long(commande.emplacement).replace(", chambre", "")}</span>
          <span>Paiement : {MODES_PAIEMENT[commande.paiement].libelle.toLowerCase()}</span>
          <span>{TIRETS}</span>
          {commande.lignes.map((l) => (
            <span key={l.platId} className="text-base font-bold">
              {l.quantite} x {l.nom}
            </span>
          ))}
          {commande.note ? <span>Note : {commande.note.toLowerCase()}</span> : null}
          <span>{TIRETS}</span>
          <span>Prêt estimé : {preparation} min</span>
          <span>
            Imprimé {heure}:{hh(maintenant.getSeconds())}
          </span>
        </div>
        <div className="no-print flex gap-3">
          <button
            type="button"
            onClick={onFermer}
            className="h-14 cursor-pointer rounded-xl border-2 border-creme/40 px-6 text-lg font-bold text-creme"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-14 cursor-pointer items-center gap-2 rounded-xl bg-creme px-6 text-lg font-bold text-vert"
          >
            <Icon name="printer" className="size-5" />
            Imprimer
          </button>
        </div>
      </div>
    </Modale>
  );
}
