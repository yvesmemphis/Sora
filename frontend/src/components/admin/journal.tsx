"use client";

import { useEffect, useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Avatar, Bouton, Puce, cx } from "@/components/ui/primitives";
import { LIBELLES_ACTION, listerJournal } from "@/lib/api/admin";
import { messageErreur } from "@/lib/api/client";
import { heureDe } from "@/lib/api/conversions";
import { type ModuleJournal } from "@/lib/demo/admin";
import { initiales } from "@/lib/format";

interface LigneJournal {
  id: string;
  date: string;
  heure: string;
  acteur: string;
  module: ModuleJournal;
  action: string;
  objet: string;
}

function moduleDe(action: string): ModuleJournal {
  if (action.startsWith("order")) return "Commandes";
  if (action.startsWith("payment")) return "Paiements";
  if (action.startsWith("price")) return "Menu";
  if (/^(stock|inventory|production)/.test(action)) return "Stocks";
  return "Comptes";
}

function detail(meta: Record<string, unknown>): string {
  if (meta.from && meta.to) return ` : ${String(meta.from)} → ${String(meta.to)}${meta.reason ? ` (${String(meta.reason)})` : ""}`;
  if (meta.old && meta.new) return ` : ${String(meta.old)} → ${String(meta.new)}`;
  if (meta.amount) return ` · ${String(meta.amount)}`;
  if (meta.total) return ` · ${String(meta.total)}`;
  return "";
}

const COLONNES = "110px 190px 150px 1fr 140px";

const MODULES: Record<ModuleJournal, string> = {
  Commandes: "bg-servi-fond text-vert",
  Paiements: "bg-ok-fond text-ok",
  Stocks: "bg-attention-fond text-attention",
  Menu: "bg-terracotta-fond text-terracotta",
  Comptes: "bg-neutre-fond text-encre",
};

const FILTRES: ("Tout" | ModuleJournal)[] = ["Tout", "Commandes", "Paiements", "Stocks", "Menu", "Comptes"];

/** A3 · Journal d'activité (lecture seule, horodaté avec l'acteur). */
export function Journal() {
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]>("Tout");
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneJournal[]>([]);
  const [etat, setEtat] = useState<string | null>("Chargement…");

  useEffect(() => {
    listerJournal()
      .then((page) => {
        setLignes(
          page.results.map((e) => ({
            id: e.id,
            date: new Date(e.created_at).toLocaleDateString("fr-FR"),
            heure: heureDe(e.created_at),
            acteur: e.actor_email ?? (e.action === "order.public_created" ? "Client" : "Système"),
            module: moduleDe(e.action),
            action: `${LIBELLES_ACTION[e.action] ?? e.action}${detail(e.metadata ?? {})}${e.result !== "SUCCESS" ? ` · ${e.result}` : ""}`,
            objet: e.resource_id ? `${e.resource_type} ${e.resource_id.slice(0, 8)}` : e.resource_type,
          })),
        );
        setEtat(null);
      })
      .catch((e: unknown) => setEtat(messageErreur(e)));
  }, []);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter(
      (l) =>
        (filtre === "Tout" || l.module === filtre) &&
        (!q || `${l.acteur} ${l.action} ${l.objet}`.toLowerCase().includes(q)),
    );
  }, [filtre, recherche, lignes]);

  function exporter() {
    const tableau = [
      ["Date", "Heure", "Acteur", "Module", "Action", "Objet"],
      ...visibles.map((l) => [l.date, l.heure, l.acteur, l.module, l.action, l.objet]),
    ];
    const csv = tableau.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-activite.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <EntetePage
        titre="Journal d'activité"
        sousTitre="Chaque transition et chaque modification est horodatée avec son acteur."
        actions={
          <Bouton variante="contour" icone="download" onClick={exporter}>
            Exporter CSV
          </Bouton>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-ligne-2 bg-papier px-3.5 text-texte-3 focus-within:border-vert sm:w-80">
          <Icon name="search" className="size-[18px]" />
          <span className="sr-only">Rechercher</span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="N° de commande, utilisateur…"
            className="h-full flex-1 bg-transparent text-sm text-encre outline-none placeholder:text-texte-3"
          />
        </label>
        {FILTRES.map((f) => (
          <Puce key={f} taille="sm" actif={f === filtre} onClick={() => setFiltre(f)}>
            {f}
          </Puce>
        ))}
        <span className="flex h-10 items-center gap-2 rounded-[10px] border border-bordure bg-papier px-3.5 text-[13px] font-medium lg:ml-auto">
          <Icon name="calendar" className="size-4" />
          100 dernières entrées
        </span>
      </div>
      <Tableau colonnes={COLONNES} entetes={["HEURE", "ACTEUR", "MODULE", "ACTION", "OBJET"]} largeurMin={820}>
        {visibles.map((l, i) => (
          <LigneTableau key={l.id} colonnes={COLONNES} className="px-5">
            <span className="tabular flex flex-col font-bold text-vert">
              {l.heure}
              <span className="text-[11px] font-medium text-texte-3">{l.date}</span>
            </span>
            <span className="flex items-center gap-2">
              <Avatar
                taille={28}
                index={i}
                initiales={l.acteur === "Client" ? "CL" : l.acteur === "Système" ? "SY" : initiales(l.acteur)}
              />
              <span className="truncate">{l.acteur}</span>
            </span>
            <span className="flex">
              <span className={cx("rounded-md px-[9px] py-[3px] text-xs font-bold", MODULES[l.module])}>{l.module}</span>
            </span>
            <span>{l.action}</span>
            <span className="font-mono text-[13px] text-texte-2">{l.objet}</span>
          </LigneTableau>
        ))}
        {visibles.length === 0 ? <p className="px-5 py-6 text-center text-sm text-texte-3">{etat ?? "Aucune entrée."}</p> : null}
      </Tableau>
    </>
  );
}
