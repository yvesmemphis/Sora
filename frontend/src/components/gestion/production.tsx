"use client";

import { useCallback, useEffect, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Bouton, Carte, Champ, Encadre, classeChamp, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { montant } from "@/lib/api/conversions";
import {
  creerLotProduction,
  dateIso,
  declarerInvendu,
  listerInvendus,
  listerProductions,
  type InvenduApi,
  type LotProductionApi,
} from "@/lib/api/gestion";
import { listerPlats } from "@/lib/api/menu";
import { MOTIFS_INVENDU } from "@/lib/roles";

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
  const [nomsPlats, setNomsPlats] = useState<string[]>([]);
  const [nouveau, setNouveau] = useState({ produit: "", quantite: "", cout: "", notes: "" });

  useEffect(() => {
    listerPlats()
      .then((p) => setNomsPlats([...new Set(p.map((d) => d.name))].sort((a, b) => a.localeCompare(b, "fr"))))
      .catch(() => undefined);
  }, []);

  async function ajouterLot() {
    const quantite = Number(nouveau.quantite.replace(",", "."));
    const cout = Number((nouveau.cout || "0").replace(",", "."));
    if (!nouveau.produit.trim() || !(quantite > 0) || !(cout >= 0)) {
      setErreur("Indiquez le produit, une quantité positive et un coût unitaire.");
      return;
    }
    setErreur(null);
    try {
      await creerLotProduction({
        product_name: nouveau.produit.trim().slice(0, 120),
        production_date: jour,
        quantity_produced: quantite.toFixed(2),
        unit_cost: cout.toFixed(2),
        notes: nouveau.notes.trim(),
      });
      setNouveau({ produit: "", quantite: "", cout: "", notes: "" });
      await charger(jour);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

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
      <Carte className="flex flex-col gap-3 p-5">
        <h2 className="m-0 text-[15px] font-bold">Nouveau lot de production · {new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR")}</h2>
        <form
          className="flex flex-wrap items-end gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void ajouterLot();
          }}
        >
          <Champ libelle="Produit" className="min-w-[200px] flex-1">
            <input
              list="plats-production"
              value={nouveau.produit}
              maxLength={120}
              onChange={(e) => setNouveau((v) => ({ ...v, produit: e.target.value }))}
              placeholder="Nom du plat préparé"
              className={cx(classeChamp, "h-10 text-sm")}
            />
            <datalist id="plats-production">
              {nomsPlats.map((nom) => (
                <option key={nom} value={nom} />
              ))}
            </datalist>
          </Champ>
          <Champ libelle="Portions" className="w-28">
            <input inputMode="decimal" value={nouveau.quantite} onChange={(e) => setNouveau((v) => ({ ...v, quantite: e.target.value }))} className={cx(classeChamp, "h-10 text-sm")} />
          </Champ>
          <Champ libelle="Coût / portion (FCFA)" className="w-40">
            <input inputMode="decimal" value={nouveau.cout} onChange={(e) => setNouveau((v) => ({ ...v, cout: e.target.value }))} className={cx(classeChamp, "h-10 text-sm")} />
          </Champ>
          <Champ libelle="Notes" className="min-w-[160px] flex-1">
            <input value={nouveau.notes} onChange={(e) => setNouveau((v) => ({ ...v, notes: e.target.value }))} className={cx(classeChamp, "h-10 text-sm")} />
          </Champ>
          <Bouton type="submit" variante="contour" hauteur="sm" icone="plus" disabled={!nouveau.produit.trim() || !nouveau.quantite}>
            Ajouter le lot
          </Bouton>
        </form>
      </Carte>
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
