"use client";

import { useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Puce } from "@/components/ui/primitives";
import { COMMANDES_SERVICE, totalCommande } from "@/lib/demo/commandes";
import { formatFCFA } from "@/lib/format";
import { MODES_PAIEMENT, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import type { StatutCommande } from "@/lib/types";

const COLONNES = "90px 1.4fr 1.6fr 1fr 1.1fr 1fr 80px";

/**
 * Commandes du jour, vue gestionnaire (non présente dans les maquettes v1.2 :
 * reprend les composants et statuts communs).
 */
export function CommandesJour() {
  const [filtre, setFiltre] = useState<"toutes" | StatutCommande>("toutes");
  const filtres: ("toutes" | StatutCommande)[] = ["toutes", "recue", "confirmee", "preparation", "prete", "servie"];
  const visibles = COMMANDES_SERVICE.filter((c) => filtre === "toutes" || c.statut === filtre);

  return (
    <>
      <EntetePage
        titre="Commandes"
        sousTitre={`Service du soir · ${COMMANDES_SERVICE.length} commandes · ${formatFCFA(COMMANDES_SERVICE.reduce((s, c) => s + totalCommande(c), 0))}`}
        actions={
          <Bouton variante="contour" icone="download">
            Exporter CSV
          </Bouton>
        }
      />
      <div className="flex flex-wrap gap-1.5">
        {filtres.map((f) => (
          <Puce
            key={f}
            taille="sm"
            actif={f === filtre}
            onClick={() => setFiltre(f)}
            compteur={f === "toutes" ? COMMANDES_SERVICE.length : COMMANDES_SERVICE.filter((c) => c.statut === f).length}
          >
            {f === "toutes" ? "Toutes" : STATUTS_COMMANDE[f].libelle}
          </Puce>
        ))}
      </div>
      <Tableau colonnes={COLONNES} entetes={["N°", "EMPLACEMENT", "ARTICLES", "STATUT", "PAIEMENT", "TOTAL", "HEURE"]} largeurMin={860}>
        {visibles.map((c) => (
          <LigneTableau key={c.numero} colonnes={COLONNES} className="tabular">
            <span className="font-bold text-vert">{c.numero}</span>
            <span className="flex items-center gap-2">
              <Icon name={MODES_SERVICE[c.mode].icone} className="size-4 text-vert" />
              {MODES_SERVICE[c.mode].court(c.emplacement)}
            </span>
            <span className="truncate text-texte-2">{c.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}</span>
            <span className="flex">
              <Badge apparence={STATUTS_COMMANDE[c.statut]} />
            </span>
            <span className="flex items-center gap-1.5 text-[13px]">
              <Icon name={MODES_PAIEMENT[c.paiement].icone} className="size-4" />
              {c.payee ? "Payée" : "À encaisser"}
            </span>
            <span className="font-bold">{formatFCFA(totalCommande(c))}</span>
            <span className="text-texte-3">{c.passeeA}</span>
          </LigneTableau>
        ))}
      </Tableau>
    </>
  );
}
