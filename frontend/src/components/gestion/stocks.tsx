"use client";

import { useEffect, useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Carte, Puce, cx } from "@/components/ui/primitives";
import { lireReglages } from "@/lib/api/admin";
import { messageErreur } from "@/lib/api/client";
import { heureDe, montant } from "@/lib/api/conversions";
import {
  listerIngredients,
  listerLots,
  listerMouvements,
  type IngredientApi,
  type LotApi,
  type MouvementApi,
} from "@/lib/api/gestion";
import { formatNombre } from "@/lib/format";
import type { Apparence } from "@/lib/statuts";

type EtatStock = "bas" | "peremption" | "conforme";

const COLONNES = "1.6fr 1fr .8fr 1.3fr 1fr 1.3fr";

const ETATS: Record<EtatStock, Apparence> = {
  bas: { libelle: "Stock bas", icone: "alert", classes: "text-attention bg-attention-fond" },
  peremption: { libelle: "Péremption proche", icone: "clock", classes: "text-danger bg-danger-fond" },
  conforme: { libelle: "Stock conforme", icone: "check", classes: "text-ok bg-ok-fond" },
};

/** Types de mouvement du backend (`StockMovement.movement_type`). */
const MOUV: Record<string, [string, string]> = {
  IN: ["ENTRÉE", "text-ok bg-ok-fond"],
  OUT: ["CONSOMMATION", "text-vert bg-servi-fond"],
  WST: ["PERTE", "text-danger bg-danger-fond"],
  ADJ: ["AJUSTEMENT", "text-attention bg-attention-fond"],
};

const quantite = (n: number, unite: string) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${unite}`;

interface LigneStock {
  id: string;
  ingredient: string;
  restant: number;
  seuil: number;
  unite: string;
  lot: string;
  peremption: string;
  etat: EtatStock;
}

/** G3 · Stocks et lots (premier périmé, premier sorti). */
export function Stocks() {
  const [filtre, setFiltre] = useState<"tous" | EtatStock>("tous");
  const [ingredients, setIngredients] = useState<IngredientApi[]>([]);
  const [lots, setLots] = useState<LotApi[]>([]);
  const [mouvements, setMouvements] = useState<MouvementApi[]>([]);
  const [joursAlerte, setJoursAlerte] = useState(3);
  const [etat, setEtat] = useState<string | null>("Chargement…");

  useEffect(() => {
    Promise.all([listerIngredients(), listerLots(), listerMouvements()])
      .then(([i, l, m]) => {
        setIngredients(i);
        setLots(l);
        setMouvements(m.slice(0, 12));
        setEtat(null);
      })
      .catch((e: unknown) => setEtat(messageErreur(e)));
    lireReglages()
      .then((r) => setJoursAlerte(r.expiry_alert_days))
      .catch(() => undefined);
  }, []);

  const lignes = useMemo<LigneStock[]>(() => {
    const limite = new Date().getTime() + joursAlerte * 86_400_000;
    return ingredients
      .filter((i) => i.is_active)
      .map((i) => {
        const actifs = lots
          .filter((l) => String(l.ingredient) === String(i.id) && l.is_active && montant(l.quantity_remaining) > 0)
          .sort((a, b) => a.date_expiration.localeCompare(b.date_expiration));
        const restant = actifs.reduce((s, l) => s + montant(l.quantity_remaining), 0);
        const seuil = montant(i.minimum_stock);
        const fefo = actifs[0];
        const expire = fefo ? new Date(fefo.date_expiration).getTime() <= limite : false;
        return {
          id: String(i.id),
          ingredient: i.name,
          restant,
          seuil,
          unite: i.unit_of_measure,
          lot: fefo ? `${fefo.lot_id} · ${quantite(montant(fefo.quantity_remaining), i.unit_of_measure)}` : "—",
          peremption: fefo ? new Date(fefo.date_expiration).toLocaleDateString("fr-FR") : "—",
          etat: restant < seuil ? "bas" : expire ? "peremption" : "conforme",
        };
      });
  }, [ingredients, lots, joursAlerte]);

  const valeur = lots.filter((l) => l.is_active).reduce((s, l) => s + montant(l.quantity_remaining) * montant(l.cost_per_unit), 0);
  const visibles = lignes.filter((s) => filtre === "tous" || s.etat === filtre);
  const nb = (e: EtatStock) => lignes.filter((s) => s.etat === e).length;

  const KPI: { valeur: string; libelle: string; icone: NomIcone; ton: string }[] = [
    { valeur: String(lignes.length), libelle: "Ingrédients suivis", icone: "box", ton: "bg-servi-fond text-vert" },
    { valeur: String(nb("bas")), libelle: "Stock bas", icone: "alert", ton: "bg-attention-fond text-attention" },
    { valeur: String(nb("peremption")), libelle: `Péremption sous ${joursAlerte} jours`, icone: "clock", ton: "bg-danger-fond text-danger" },
    { valeur: formatNombre(valeur), libelle: "Valeur du stock (FCFA)", icone: "wallet", ton: "bg-servi-fond text-vert" },
  ];

  return (
    <>
      <EntetePage
        titre="Stocks"
        sousTitre="Inventaire en temps réel · aucune modification sans mouvement enregistré"
      />
      {etat && etat !== "Chargement…" ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {etat}
        </div>
      ) : null}
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
              Tous · {lignes.length}
            </Puce>
            <Puce taille="sm" actif={filtre === "bas"} onClick={() => setFiltre("bas")}>
              Stock bas · {nb("bas")}
            </Puce>
            <Puce taille="sm" actif={filtre === "peremption"} onClick={() => setFiltre("peremption")}>
              Péremption proche · {nb("peremption")}
            </Puce>
          </div>
          <Tableau
            className="rounded-none border-0"
            colonnes={COLONNES}
            entetes={["INGRÉDIENT", "RESTANT", "SEUIL", "LOT À SORTIR (FEFO)", "PÉREMPTION", "ÉTAT"]}
            largeurMin={780}
          >
            {visibles.map((s) => (
              <LigneTableau key={s.id} colonnes={COLONNES} className="tabular py-[13px]">
                <span className="font-bold">{s.ingredient}</span>
                <span className={cx("font-bold", s.etat === "bas" ? "text-attention" : "text-encre")}>{quantite(s.restant, s.unite)}</span>
                <span className="text-texte-3">{quantite(s.seuil, s.unite)}</span>
                <span className="text-texte-2">{s.lot}</span>
                <span className="text-texte-2">{s.peremption}</span>
                <span className="flex">
                  <Badge apparence={ETATS[s.etat]} />
                </span>
              </LigneTableau>
            ))}
            {visibles.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-texte-3">{etat === "Chargement…" ? etat : "Aucun ingrédient."}</p>
            ) : null}
          </Tableau>
        </div>
        <Carte className="flex flex-col gap-3.5 p-[18px]">
          <h2 className="m-0 text-[15px] font-bold">Mouvements récents</h2>
          {mouvements.map((m) => {
            const [lib, ton] = MOUV[m.movement_type] ?? [m.movement_type, "bg-neutre-fond text-encre"];
            return (
              <div key={String(m.id)} className="flex items-start gap-3 border-b border-ligne-3 pb-3 last:border-b-0">
                <span className={cx("min-w-[84px] shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-bold", ton)}>{lib}</span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex justify-between gap-2 text-[13px]">
                    <span className="font-bold">{m.lot_ingredient_name}</span>
                    <span className="tabular font-bold">
                      {m.movement_type === "IN" ? "+" : "−"}
                      {montant(m.quantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  <span className="text-xs text-texte-3">
                    {m.lot_lot_id} · {new Date(m.created_at).toLocaleDateString("fr-FR")} {heureDe(m.created_at)}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </span>
                </div>
              </div>
            );
          })}
          {mouvements.length === 0 && !etat ? <span className="text-[13px] text-texte-3">Aucun mouvement.</span> : null}
        </Carte>
      </div>
    </>
  );
}
