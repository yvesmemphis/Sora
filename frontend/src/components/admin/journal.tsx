"use client";

import { useEffect, useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Avatar, Bouton, Puce, cx } from "@/components/ui/primitives";
import { LIBELLES_ACTION, exporterJournal, listerJournal } from "@/lib/api/admin";
import { messageErreur, telechargerBlob } from "@/lib/api/client";
import { heureDe } from "@/lib/api/conversions";
import { dateIso } from "@/lib/api/gestion";
import { type ModuleJournal } from "@/lib/roles";
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
  if (action.startsWith("price") || action.startsWith("analytics")) return "Menu";
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
  const [periode, setPeriode] = useState<1 | 7 | 30>(1);
  const [page, setPage] = useState(1);
  const [suite, setSuite] = useState(false);

  useEffect(() => {
    const debut = new Date(new Date().getTime() - (periode - 1) * 86_400_000);
    listerJournal({ page, date_from: dateIso(debut), date_to: dateIso(new Date()) })
      .then((rep) => {
        setSuite(!!rep.next);
        const nouvelles = rep.results.map((e) => ({
            id: e.id,
            date: new Date(e.created_at).toLocaleDateString("fr-FR"),
            heure: heureDe(e.created_at),
            acteur: e.actor_email ?? (e.action === "order.public_created" ? "Client" : "Système"),
            module: moduleDe(e.action),
            action: `${LIBELLES_ACTION[e.action] ?? e.action}${detail(e.metadata ?? {})}${e.result !== "SUCCESS" ? ` · ${e.result}` : ""}`,
            objet: e.resource_id ? `${e.resource_type} ${e.resource_id.slice(0, 8)}` : e.resource_type,
          }));
        setLignes((prev) => (page === 1 ? nouvelles : [...prev, ...nouvelles]));
        setEtat(null);
      })
      .catch((e: unknown) => setEtat(messageErreur(e)));
  }, [periode, page]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter(
      (l) =>
        (filtre === "Tout" || l.module === filtre) &&
        (!q || `${l.acteur} ${l.action} ${l.objet}`.toLowerCase().includes(q)),
    );
  }, [filtre, recherche, lignes]);

  /** Module backend (`/audit/export/?module=`) quand le filtre en a un seul. */
  const MODULE_SERVEUR: Partial<Record<ModuleJournal, string>> = { Commandes: "orders", Paiements: "payments", Menu: "menu" };

  async function exporter() {
    try {
      const debut = new Date(new Date().getTime() - (periode - 1) * 86_400_000);
      const blob = await exporterJournal({
        date_from: dateIso(debut),
        date_to: dateIso(new Date()),
        module: filtre === "Tout" ? undefined : MODULE_SERVEUR[filtre],
      });
      telechargerBlob(blob, `journal-${dateIso(new Date())}.csv`);
    } catch (e) {
      setEtat(messageErreur(e));
    }
  }


  return (
    <>
      <EntetePage
        titre="Journal d'activité"
        sousTitre="Chaque transition et chaque modification est horodatée avec son acteur."
        actions={
          <Bouton variante="contour" icone="download" onClick={() => void exporter()}>
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
        <label className="flex h-10 items-center gap-2 rounded-[10px] border border-bordure bg-papier px-3.5 text-[13px] font-medium lg:ml-auto">
          <Icon name="calendar" className="size-4" />
          <span className="sr-only">Période</span>
          <select
            value={periode}
            onChange={(e) => {
              setEtat("Chargement…");
              setPage(1);
              setPeriode(Number(e.target.value) as 1 | 7 | 30);
            }}
            className="cursor-pointer bg-transparent outline-none"
          >
            <option value={1}>Aujourd&apos;hui</option>
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
          </select>
        </label>
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
      {suite ? (
        <Bouton variante="contour" className="self-center" onClick={() => setPage((n) => n + 1)}>
          Charger plus
        </Bouton>
      ) : null}
    </>
  );
}
