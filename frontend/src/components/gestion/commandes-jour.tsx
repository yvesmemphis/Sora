"use client";

import { useCallback, useEffect, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Puce } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { commandeDepuisApi, listerCommandes } from "@/lib/api/commandes";
import { listerEmplacements } from "@/lib/api/emplacements";
import { formatFCFA } from "@/lib/format";
import { ACTUALISATION_MS, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import type { Commande, StatutCommande } from "@/lib/types";

const COLONNES = "130px 1.3fr 1.6fr 1fr .9fr 1fr 80px";

function estDuJour(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString();
}

/** Commandes du jour, vue gestionnaire (`GET /orders/`, actualisée toutes les 5 s). */
export function CommandesJour() {
  const [filtre, setFiltre] = useState<"toutes" | StatutCommande>("toutes");
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const filtres: ("toutes" | StatutCommande)[] = ["toutes", "recue", "confirmee", "preparation", "prete", "servie", "cloturee", "annulee"];

  const charger = useCallback(async () => {
    try {
      const [liste, emplacements] = await Promise.all([listerCommandes(), listerEmplacements()]);
      setCommandes(liste.map((c) => commandeDepuisApi(c, { emplacements })).filter((c) => estDuJour(c.creeeLe)));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    void charger();
    const iv = setInterval(() => void charger(), ACTUALISATION_MS);
    return () => clearInterval(iv);
  }, [charger]);

  const visibles = commandes.filter((c) => filtre === "toutes" || c.statut === filtre);
  const valides = commandes.filter((c) => c.statut !== "annulee" && c.statut !== "refusee");

  function exporter() {
    const lignes = [
      ["N°", "Mode", "Emplacement", "Articles", "Statut", "Total", "Heure"],
      ...visibles.map((c) => [
        c.numero,
        MODES_SERVICE[c.mode].libelle,
        c.emplacement,
        c.lignes.map((l) => `${l.quantite} x ${l.nom}`).join(", "),
        STATUTS_COMMANDE[c.statut].libelle,
        String(c.total ?? 0),
        c.passeeA,
      ]),
    ];
    const csv = lignes.map((l) => l.map((x) => `"${x.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "commandes-du-jour.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <EntetePage
        titre="Commandes"
        sousTitre={
          chargement
            ? "Chargement…"
            : `Aujourd'hui · ${commandes.length} commandes · ${formatFCFA(valides.reduce((s, c) => s + (c.total ?? 0), 0))}`
        }
        actions={
          <Bouton variante="contour" icone="download" onClick={exporter} disabled={!visibles.length}>
            Exporter CSV
          </Bouton>
        }
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {filtres.map((f) => (
          <Puce
            key={f}
            taille="sm"
            actif={f === filtre}
            onClick={() => setFiltre(f)}
            compteur={f === "toutes" ? commandes.length : commandes.filter((c) => c.statut === f).length}
          >
            {f === "toutes" ? "Toutes" : STATUTS_COMMANDE[f].libelle}
          </Puce>
        ))}
      </div>
      <Tableau colonnes={COLONNES} entetes={["N°", "EMPLACEMENT", "ARTICLES", "STATUT", "ORIGINE", "TOTAL", "HEURE"]} largeurMin={860}>
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
            <span className="text-[13px]">{c.source === "PUBLIC" ? "Client (QR)" : "Personnel"}</span>
            <span className="font-bold">{formatFCFA(c.total ?? 0)}</span>
            <span className="text-texte-3">{c.passeeA}</span>
          </LigneTableau>
        ))}
        {visibles.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-texte-3">{chargement ? "Chargement…" : "Aucune commande."}</p>
        ) : null}
      </Tableau>
    </>
  );
}
