"use client";

import { useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Bouton, Carte, Puce, cx } from "@/components/ui/primitives";
import { MOUVEMENTS, STOCKS, type EtatStock, type TypeMouvement } from "@/lib/demo/gestion";
import type { Apparence } from "@/lib/statuts";

const COLONNES = "1.6fr 1fr .8fr 1.3fr 1fr 1.3fr";

const ETATS: Record<EtatStock, Apparence> = {
  bas: { libelle: "Stock bas", icone: "alert", classes: "text-attention bg-attention-fond" },
  peremption: { libelle: "Péremption proche", icone: "clock", classes: "text-danger bg-danger-fond" },
  conforme: { libelle: "Stock conforme", icone: "check", classes: "text-ok bg-ok-fond" },
};

const MOUV: Record<TypeMouvement, [string, string]> = {
  entree: ["ENTRÉE", "text-ok bg-ok-fond"],
  consommation: ["CONSOMMATION", "text-vert bg-servi-fond"],
  perte: ["PERTE", "text-danger bg-danger-fond"],
  ajustement: ["AJUSTEMENT", "text-attention bg-attention-fond"],
};

const KPI: { valeur: string; libelle: string; icone: NomIcone; ton: string }[] = [
  { valeur: "64", libelle: "Ingrédients suivis", icone: "box", ton: "bg-servi-fond text-vert" },
  { valeur: "3", libelle: "Stock bas", icone: "alert", ton: "bg-attention-fond text-attention" },
  { valeur: "2", libelle: "Péremption sous 3 jours", icone: "clock", ton: "bg-danger-fond text-danger" },
  { valeur: "1,84 M", libelle: "Valeur du stock (FCFA)", icone: "wallet", ton: "bg-servi-fond text-vert" },
];

/** G3 · Stocks et lots (premier périmé, premier sorti). */
export function Stocks() {
  const [filtre, setFiltre] = useState<"tous" | EtatStock>("tous");
  const visibles = STOCKS.filter((s) => filtre === "tous" || s.etat === filtre);

  return (
    <>
      <EntetePage
        titre="Stocks"
        sousTitre="Inventaire du 9 novembre · aucune modification sans mouvement enregistré"
        actions={
          <>
            <Bouton variante="contour" icone="edit">
              Ajustement
            </Bouton>
            <Bouton icone="plus">Réception de lot</Bouton>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {KPI.map((k) => (
          <Carte key={k.libelle} className="flex items-center gap-3.5 px-[18px] py-4">
            <span className={cx("flex size-11 items-center justify-center rounded-xl", k.ton)}>
              <Icon name={k.icone} className="size-[22px]" />
            </span>
            <div className="flex flex-col">
              <span className="tabular font-serif text-[26px] font-semibold text-vert">{k.valeur}</span>
              <span className="text-[13px] text-texte-2">{k.libelle}</span>
            </div>
          </Carte>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ligne bg-papier">
          <div className="flex flex-wrap gap-1.5 border-b border-ligne-3 px-[18px] py-3.5">
            <Puce taille="sm" actif={filtre === "tous"} onClick={() => setFiltre("tous")}>
              Tous · 64
            </Puce>
            <Puce taille="sm" actif={filtre === "bas"} onClick={() => setFiltre("bas")}>
              Stock bas · {STOCKS.filter((s) => s.etat === "bas").length}
            </Puce>
            <Puce taille="sm" actif={filtre === "peremption"} onClick={() => setFiltre("peremption")}>
              Péremption proche · {STOCKS.filter((s) => s.etat === "peremption").length}
            </Puce>
          </div>
          <Tableau
            className="rounded-none border-0"
            colonnes={COLONNES}
            entetes={["INGRÉDIENT", "RESTANT", "SEUIL", "LOT À SORTIR (FEFO)", "PÉREMPTION", "ÉTAT"]}
            largeurMin={780}
          >
            {visibles.map((s) => (
              <LigneTableau key={s.ingredient} colonnes={COLONNES} className="tabular py-[13px]">
                <span className="font-bold">{s.ingredient}</span>
                <span className={cx("font-bold", s.etat === "bas" ? "text-attention" : "text-encre")}>{s.restant}</span>
                <span className="text-texte-3">{s.seuil}</span>
                <span className="text-texte-2">{s.lot}</span>
                <span className="text-texte-2">{s.peremption}</span>
                <span className="flex">
                  <Badge apparence={ETATS[s.etat]} />
                </span>
              </LigneTableau>
            ))}
          </Tableau>
        </div>
        <Carte className="flex flex-col gap-3.5 p-[18px]">
          <h2 className="m-0 text-[15px] font-bold">Mouvements récents</h2>
          {MOUVEMENTS.map((m, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-ligne-3 pb-3 last:border-b-0">
              <span className={cx("min-w-[84px] shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-bold", MOUV[m.type][1])}>
                {MOUV[m.type][0]}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="font-bold">{m.ingredient}</span>
                  <span className="tabular font-bold">{m.quantite}</span>
                </div>
                <span className="text-xs text-texte-3">{m.detail}</span>
              </div>
            </div>
          ))}
        </Carte>
      </div>
    </>
  );
}
