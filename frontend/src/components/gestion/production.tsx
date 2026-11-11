"use client";

import { useCallback, useEffect, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Bouton, Carte, Encadre, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { montant } from "@/lib/api/conversions";
import { dateIso, declarerInvendu, listerInvendus, listerProductions, type InvenduApi, type LotProductionApi } from "@/lib/api/gestion";
import { MOTIFS_INVENDU } from "@/lib/demo/gestion";

const COLONNES = "1.7fr .7fr .7fr .8fr .9fr .7fr 1.6fr";

interface Ligne {
  lot: LotProductionApi;
  declaree: InvenduApi | null;
  restant: string;
  reutilisable: string;
  jete: string;
  motif: string;
}

const champ = "h-9 w-full rounded-lg border bg-papier px-2.5 outline-none focus:border-vert disabled:bg-entete disabled:text-texte-3";
const n = (v: string) => Number(v || 0);

/** G4 · Production et invendus, déclarés en fin de service. */
export function Production() {
  const [jour, setJour] = useState(() => dateIso(new Date()));
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [etat, setEtat] = useState<string | null>("Chargement…");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  const charger = useCallback(async (date: string) => {
    setEtat("Chargement…");
    try {
      const [lots, invendus] = await Promise.all([listerProductions(), listerInvendus()]);
      setLignes(
        lots
          .filter((l) => l.production_date === date)
          .map((lot) => {
            const declaree = invendus.find((w) => String(w.batch) === String(lot.id)) ?? null;
            return {
              lot,
              declaree,
              restant: declaree ? String(montant(declaree.remaining_quantity)) : "",
              reutilisable: declaree ? String(montant(declaree.reusable_quantity)) : "",
              jete: declaree ? String(montant(declaree.discarded_quantity)) : "",
              motif: declaree?.reason ?? "",
            };
          }),
      );
      setEtat(null);
    } catch (e) {
      setEtat(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    void charger(jour);
  }, [charger, jour]);

  const maj = (i: number, patch: Partial<Ligne>) => {
    setEnregistre(false);
    setLignes((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const aDeclarer = lignes.filter((l) => !l.declaree && l.restant !== "");
  const manquants = lignes.filter((l) => !l.declaree && l.restant === "");
  const incoherents = aDeclarer.filter((l) => n(l.restant) !== n(l.reutilisable) + n(l.jete) || !l.motif || n(l.restant) <= 0);
  const prepare = lignes.reduce((s, l) => s + montant(l.lot.quantity_produced), 0);
  const declares = lignes.filter((l) => l.restant !== "");
  const restant = declares.reduce((s, l) => s + n(l.restant), 0);
  const reutilisable = declares.reduce((s, l) => s + n(l.reutilisable), 0);
  const prepareDeclares = declares.reduce((s, l) => s + montant(l.lot.quantity_produced), 0);
  const taux = prepareDeclares ? ((restant / prepareDeclares) * 100).toFixed(1).replace(".", ",") : "0";

  const kpis = [
    { l: "Préparé", v: String(prepare), s: `portions · ${lignes.length} lots` },
    { l: "Déclarés", v: String(declares.length), s: `sur ${lignes.length} lots` },
    { l: "Restant déclaré", v: String(restant), s: `dont ${reutilisable} réutilisables` },
    { l: "Taux d'invendus", v: `${taux} %`, s: "sur les lots déclarés" },
  ];

  async function enregistrer() {
    if (!aDeclarer.length || incoherents.length) return;
    setEnvoi(true);
    setErreur(null);
    try {
      for (const l of aDeclarer) {
        await declarerInvendu({
          batch: l.lot.id,
          remaining_quantity: n(l.restant).toFixed(2),
          reusable_quantity: n(l.reutilisable).toFixed(2),
          discarded_quantity: n(l.jete).toFixed(2),
          reason: l.motif,
        });
      }
      setEnregistre(true);
      await charger(jour);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EntetePage
        titre="Production et invendus"
        sousTitre="Déclarer les quantités restantes, réutilisables et jetées, avec le motif."
        actions={
          <label className="flex h-11 items-center gap-2 rounded-xl bg-segment px-4 text-sm font-medium">
            <span className="sr-only">Date de production</span>
            <input type="date" value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} className="cursor-pointer bg-transparent outline-none" />
          </label>
        }
      />
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {kpis.map((k) => (
          <Carte key={k.l} className="flex flex-col gap-1 px-[18px] py-4">
            <span className="text-[13px] text-texte-2">{k.l}</span>
            <span className="tabular font-serif text-[28px] font-semibold text-vert">{k.v}</span>
            <span className="text-xs text-texte-3">{k.s}</span>
          </Carte>
        ))}
      </div>
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <Tableau colonnes={COLONNES} entetes={["PRODUIT", "PRÉPARÉ", "RESTANT LOT", "RESTANT", "RÉUTILISABLE", "JETÉ", "MOTIF"]} largeurMin={880}>
        {lignes.map((l, i) => {
          const manque = !l.declaree && l.restant === "";
          const fige = !!l.declaree;
          return (
            <LigneTableau key={String(l.lot.id)} colonnes={COLONNES} className="tabular py-2.5">
              <span className="font-bold">{l.lot.product_name}</span>
              <span>{montant(l.lot.quantity_produced)}</span>
              <span className="text-texte-3">{montant(l.lot.quantity_remaining)}</span>
              <input
                aria-label={`Restant ${l.lot.product_name}`}
                inputMode="decimal"
                value={l.restant}
                disabled={fige}
                placeholder="À saisir"
                onChange={(e) => maj(i, { restant: e.target.value.replace(/[^\d.]/g, "") })}
                className={cx(
                  champ,
                  "border-[1.5px] font-bold",
                  manque ? "border-attention bg-attention-fond-2 text-attention placeholder:text-attention" : "border-vert",
                )}
              />
              <input
                aria-label={`Réutilisable ${l.lot.product_name}`}
                inputMode="decimal"
                value={l.reutilisable}
                disabled={fige}
                onChange={(e) => maj(i, { reutilisable: e.target.value.replace(/[^\d.]/g, "") })}
                className={cx(champ, "border-bordure-2")}
              />
              <input
                aria-label={`Jeté ${l.lot.product_name}`}
                inputMode="decimal"
                value={l.jete}
                disabled={fige}
                onChange={(e) => maj(i, { jete: e.target.value.replace(/[^\d.]/g, "") })}
                className={cx(champ, "border-bordure-2")}
              />
              <select
                aria-label={`Motif ${l.lot.product_name}`}
                value={l.motif}
                disabled={fige}
                onChange={(e) => maj(i, { motif: e.target.value })}
                className={cx(champ, "cursor-pointer border-bordure-2 text-[13px]", manque && "text-attention")}
              >
                <option value="">{manque ? "À déclarer" : "—"}</option>
                {[...new Set([...MOTIFS_INVENDU, ...(l.motif ? [l.motif] : [])])].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </LigneTableau>
          );
        })}
        {lignes.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-texte-3">{etat ?? "Aucune production enregistrée pour cette date."}</p>
        ) : null}
      </Tableau>
      <div className="mt-auto flex flex-wrap items-center gap-4">
        {incoherents.length ? (
          <Encadre icone="alert" ton="attention" className="flex-1 text-sm">
            Pour {incoherents.map((l) => l.lot.product_name).join(", ")} : le restant doit être égal à réutilisable + jeté, et le motif est obligatoire.
          </Encadre>
        ) : manquants.length ? (
          <Encadre icone="alert" ton="attention" className="flex-1 text-sm">
            {manquants.map((m) => m.lot.product_name).join(", ")} non déclaré{manquants.length > 1 ? "s" : ""} : exclu
            {manquants.length > 1 ? "s" : ""} du taux d&apos;invendus.
          </Encadre>
        ) : (
          <Encadre icone="check" className="flex-1 text-sm">
            {lignes.length ? "Tous les lots du jour sont déclarés." : "Rien à déclarer."}
          </Encadre>
        )}
        <Bouton
          hauteur="lg"
          icone="check"
          className="h-[52px] px-[22px]"
          disabled={!aDeclarer.length || incoherents.length > 0 || envoi}
          onClick={enregistrer}
        >
          {envoi ? "Enregistrement…" : enregistre ? "Déclaration enregistrée" : "Enregistrer la déclaration"}
        </Bouton>
      </div>
    </>
  );
}
