"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { Bouton, Puce } from "@/components/ui/primitives";
import { totalCommande } from "@/lib/demo/commandes";
import { formatFCFA } from "@/lib/format";
import { MODES_SERVICE } from "@/lib/statuts";
import { MOTIFS_ANNULATION, useService } from "@/lib/staff/service";
import type { Commande } from "@/lib/types";
import { SERVEUR_DEMO } from "./barre-salle";

/** S3 · Annulation après validation (accord du personnel). */
export function ModaleAnnulation({
  commande,
  ouverte,
  onFermer,
}: {
  commande: Commande;
  ouverte: boolean;
  onFermer: () => void;
}) {
  const { annuler } = useService();
  const [motif, setMotif] = useState<string>(MOTIFS_ANNULATION[0]);
  const [commentaire, setCommentaire] = useState("");
  const mode = MODES_SERVICE[commande.mode];
  const resume = commande.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ");

  function confirmer() {
    annuler(commande.numero, motif, commentaire.trim(), SERVEUR_DEMO.nom);
    setCommentaire("");
    onFermer();
  }

  return (
    <Modale ouverte={ouverte} onFermer={onFermer} titreId="titre-annulation" className="max-w-[560px]">
      <div className="flex flex-col gap-[18px] p-7">
        <div className="flex items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-danger-fond text-danger">
            <Icon name="alert" className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="titre-annulation" className="m-0 font-serif text-[26px] font-semibold text-vert">
              Annuler la commande n° {commande.numero} ?
            </h2>
            <span className="text-[15px] text-texte-2">
              {mode.court(commande.emplacement)} · {resume} · {formatFCFA(totalCommande(commande))}
            </span>
          </div>
        </div>

        {commande.statut === "preparation" || commande.statut === "prete" ? (
          <div className="flex items-center gap-2 rounded-xl bg-attention-fond px-3.5 py-3 text-sm font-bold text-attention">
            <Icon name="flame" className="size-[18px]" />
            {commande.statut === "preparation" ? "En préparation." : "Déjà prête."} La cuisine sera prévenue.
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">Motif</legend>
          <div className="flex flex-wrap gap-2">
            {MOTIFS_ANNULATION.map((m) => (
              <Puce key={m} actif={m === motif} onClick={() => setMotif(m)} taille="lg">
                {m}
              </Puce>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="sr-only">Commentaire</span>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ex. Le client a appelé la réception à 19 h 51."
            rows={3}
            className="min-h-[72px] resize-none rounded-xl border border-bordure-2 bg-papier px-3.5 py-3 text-[15px] outline-none focus:border-vert"
          />
        </label>

        <span className="text-[13px] text-texte-3">
          Une commande annulée n&apos;est pas comptée comme vente. Le plat déjà préparé pourra être déclaré en invendu.
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          <Bouton variante="contour" hauteur="xl" onClick={onFermer}>
            Garder la commande
          </Bouton>
          <Bouton variante="danger" hauteur="xl" onClick={confirmer}>
            Confirmer l&apos;annulation
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}
