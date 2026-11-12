"use client";

import { useRef, useState } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { LogoMark, cx } from "@/components/ui/primitives";
import { heureDe, numeroCourt } from "@/lib/api/conversions";
import { formatMinuteur } from "@/lib/format";
import { useEnLigne, useHorloge, useMaintenant, useTic } from "@/lib/hooks";
import { MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import { useSession } from "@/lib/staff/session";
import type { Commande, StatutCommande } from "@/lib/types";
import { ModaleIndisponibilite } from "./modale-indisponibilite";
import { TicketSecours } from "./ticket-secours";

/** Au-delà de ce temps de préparation, la commande est signalée en retard. */
const SEUIL_RETARD_SEC = 15 * 60;
/** Une commande confirmée depuis moins de 2 min est signalée comme nouvelle. */
const SEUIL_NOUVELLE_SEC = 120;

type Etape = "confirmee" | "preparation" | "prete";
type Filtre = "toutes" | Etape | "retard";

/** Apparence et action de chaque étape de la cuisine. */
const ETAPES: Record<
  Etape,
  {
    libelle: string;
    court: string;
    icone: NomIcone;
    /** Fond dégradé du visuel de la carte. */
    visuel: string;
    /** Anneau du rail et filet. */
    anneau: string;
    pastille: string;
    action: string;
    actionCourte: string;
    actionIcone: NomIcone;
  }
> = {
  confirmee: {
    libelle: "À lancer",
    court: "À lancer",
    icone: "bell",
    visuel: "from-creme/[.16] via-creme/[.06] to-transparent",
    anneau: "ring-creme/50",
    pastille: "bg-creme/10 text-creme",
    action: "Commencer la préparation",
    actionCourte: "Commencer",
    actionIcone: "play",
  },
  preparation: {
    libelle: "Au feu",
    court: "Au feu",
    icone: "flame",
    visuel: "from-or/[.38] via-or/[.12] to-transparent",
    anneau: "ring-or",
    pastille: "bg-or/15 text-or",
    action: "Marquer la commande prête",
    actionCourte: "Prête",
    actionIcone: "check",
  },
  prete: {
    libelle: "Au passe",
    court: "Au passe",
    icone: "bag",
    visuel: "from-en-ligne/[.30] via-en-ligne/[.10] to-transparent",
    anneau: "ring-en-ligne",
    pastille: "bg-en-ligne/15 text-en-ligne",
    action: "Remettre à la salle",
    actionCourte: "Remise",
    actionIcone: "arrow",
  },
};

const ORDRE: Etape[] = ["confirmee", "preparation", "prete"];
const estEtape = (s: StatutCommande): s is Etape => (ORDRE as StatutCommande[]).includes(s);

/** Lieu lisible de loin : « Table 2 », « Chambre 204 », « À emporter ». */
function lieu(c: Commande): string {
  const mode = MODES_SERVICE[c.mode];
  return c.mode === "emporter" || c.emplacement === "—" ? mode.libelle : mode.court(c.emplacement);
}

/** La note client « Paiement prévu : … » ne concerne pas la cuisine. */
function noteCuisine(c: Commande): string | undefined {
  const n = c.noteCommande?.replace(/Paiement prévu\s*:\s*[^·]*/i, "").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
  return n || undefined;
}

const nbArticles = (c: Commande) => c.lignes.reduce((s, l) => s + l.quantite, 0);

/* ------------------------------------------------------------------ Carte */

function CarteCommande({
  c,
  etape,
  ecoule,
  enRetard,
  selectionnee,
  onSelection,
  onAgir,
}: {
  c: Commande;
  etape: Etape;
  ecoule: number;
  enRetard: boolean;
  selectionnee: boolean;
  onSelection: () => void;
  onAgir: () => void;
}) {
  const e = ETAPES[etape];
  const nouvelle = etape === "confirmee" && ecoule < SEUIL_NOUVELLE_SEC;
  const mode = MODES_SERVICE[c.mode];
  const resume = c.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(" · ");

  return (
    <li
      className={cx(
        "group flex flex-col gap-3 rounded-[22px] bg-nuit-carte p-2.5 shadow-[0_18px_36px_-26px_rgba(0,0,0,.9)] ring-1 transition-[box-shadow,transform]",
        selectionnee ? "ring-2 ring-or" : enRetard ? "ring-[#E07E58]/70" : nouvelle ? "halo-nouvelle ring-or/50" : "ring-creme/[.07] hover:ring-creme/20",
      )}
    >
      {/* Visuel : numéro et chrono, comme la photo d'un plat */}
      <button
        type="button"
        onClick={onSelection}
        aria-pressed={selectionnee}
        aria-label={`Voir la commande ${numeroCourt(c.numero)}`}
        className={cx(
          "relative flex h-[118px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 text-left",
          enRetard ? "from-[#E07E58]/45 via-[#E07E58]/15 to-transparent" : e.visuel,
        )}
      >
        <Icon name={mode.icone} className="absolute -right-3 -bottom-4 size-24 text-creme/[.06]" aria-hidden />
        <span className="flex items-start justify-between gap-2">
          <span
            className={cx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
              enRetard ? "bg-[#E07E58] text-nuit" : nouvelle ? "bg-or text-nuit" : "bg-nuit/60 text-creme",
            )}
          >
            <Icon name={enRetard ? "alert" : nouvelle ? "bell" : e.icone} className="size-3.5" />
            {enRetard ? "En retard" : nouvelle ? "Nouvelle" : e.court}
          </span>
          <span className="tabular flex items-center gap-1 rounded-full bg-nuit/60 px-2.5 py-1 text-sm font-bold">
            <Icon name="clock" className="size-3.5 opacity-70" />
            {formatMinuteur(ecoule)}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-xs font-bold text-creme/50">N°</span>
          <span className="tabular font-serif text-[40px] leading-none font-semibold tracking-tight">{numeroCourt(c.numero)}</span>
        </span>
      </button>

      {/* Titre et indicateur, comme le nom et le prix */}
      <div className="flex items-start justify-between gap-2 px-1.5">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-bold">{lieu(c)}</span>
          <span className="truncate text-[13px] text-creme/55" title={resume}>
            {resume}
          </span>
        </span>
        <span className={cx("tabular shrink-0 text-[17px] font-bold", enRetard ? "text-[#F2A98A]" : "text-or")}>
          {nbArticles(c)} art.
        </span>
      </div>

      {/* Pied : plats et action, comme la quantité et « Ajouter » */}
      <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-creme/70">
          <span className="flex size-8 items-center justify-center rounded-full border border-creme/15">
            <Icon name="list" className="size-4" />
          </span>
          {c.lignes.length} plat{c.lignes.length > 1 ? "s" : ""}
          {noteCuisine(c) || c.lignes.some((l) => l.note) ? <Icon name="note" className="size-4 text-or" aria-label="Avec consignes" /> : null}
        </span>
        <button
          type="button"
          onClick={onAgir}
          className={cx(
            "flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors",
            selectionnee
              ? "bg-gradient-to-r from-or to-terracotta text-creme shadow-[0_8px_18px_-8px_rgba(201,154,59,.8)]"
              : "border border-creme/15 bg-creme/[.04] text-creme hover:bg-creme/10",
          )}
        >
          <Icon name={e.actionIcone} className="size-4" />
          {e.actionCourte}
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ Panneau */

function PanneauCommande({
  c,
  etape,
  ecoule,
  enRetard,
  onAgir,
  onRetard,
  onIndisponibilite,
  onTicket,
}: {
  c: Commande;
  etape: Etape;
  ecoule: number;
  enRetard: boolean;
  onAgir: () => void;
  onRetard: () => void;
  onIndisponibilite: () => void;
  onTicket: () => void;
}) {
  const e = ETAPES[etape];
  const mode = MODES_SERVICE[c.mode];
  const note = noteCuisine(c);
  const progression = Math.min(1, ecoule / SEUIL_RETARD_SEC);

  return (
    <aside
      aria-label={`Commande ${numeroCourt(c.numero)}`}
      className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[26px] border border-or/20 bg-gradient-to-b from-or/[.12] via-or/[.05] to-nuit-carte p-4"
    >
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <span className={cx("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold", enRetard ? "bg-[#E07E58] text-nuit" : "bg-gradient-to-r from-or to-terracotta text-creme")}>
          <Icon name={enRetard ? "alert" : e.icone} className="size-4" />
          {enRetard ? "En retard" : e.libelle}
        </span>
        <button type="button" onClick={onTicket} className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-or hover:underline">
          <Icon name="printer" className="size-4" />
          Imprimer le ticket
        </button>
      </div>

      {/* Informations, en cases comme un formulaire */}
      <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-nuit/50 p-3">
        {[
          { l: "Commande", v: `N° ${numeroCourt(c.numero)}`, grand: true },
          { l: "Chrono", v: formatMinuteur(ecoule), grand: true, alerte: enRetard },
          { l: "Lieu", v: lieu(c), icone: mode.icone },
          { l: "Passée à", v: c.passeeA || heureDe(c.creeeLe) },
        ].map((x) => (
          <div key={x.l} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-creme/55">{x.l}</span>
            <span
              className={cx(
                "tabular flex h-11 items-center gap-2 rounded-xl border border-creme/10 bg-nuit-carte px-3 font-bold",
                x.grand ? "text-lg" : "text-[15px]",
                x.alerte && "text-[#F2A98A]",
              )}
            >
              {x.icone ? <Icon name={x.icone} className="size-4 shrink-0 text-or" /> : null}
              <span className="truncate">{x.v}</span>
            </span>
          </div>
        ))}
      </div>

      {etape === "preparation" ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-creme/60">
            <span>Avancement vs seuil de 15 min</span>
            <span className="tabular font-bold">{Math.round(progression * 100)} %</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-creme/10">
            <div
              className={cx("h-full rounded-full transition-[width] duration-1000", enRetard ? "bg-[#E07E58]" : "bg-gradient-to-r from-or to-terracotta")}
              style={{ width: `${progression * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Plats, en mini-cartes comme les lignes du panier */}
      <ul className="flex shrink-0 flex-col gap-2.5">
        {c.lignes.map((l, i) => (
          <li key={`${l.platId}-${i}`} className="flex items-center gap-3 rounded-2xl border border-creme/[.07] bg-nuit-carte p-2.5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-or/30 to-or/5 text-or">
              <Icon name="flame" className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[17px] leading-6 font-bold">{l.nom}</span>
              {l.note ? (
                <span className="flex items-center gap-1 text-[13px] font-medium text-or">
                  <Icon name="note" className="size-3.5 shrink-0" />
                  {l.note}
                </span>
              ) : (
                <span className="text-[13px] text-creme/45">Sans consigne</span>
              )}
            </span>
            <span className="tabular flex h-10 min-w-10 items-center justify-center rounded-full bg-creme px-2.5 text-lg font-bold text-nuit">
              {l.quantite}
            </span>
          </li>
        ))}
      </ul>

      {note ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-or/40 bg-or/[.08] px-3.5 py-3 text-[15px] leading-6 font-medium text-[#E7C77F]">
          <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
          {note}
        </div>
      ) : null}

      {/* Récapitulatif, comme le sous-total */}
      <div className="mt-auto flex shrink-0 flex-col gap-1.5 rounded-2xl bg-nuit/50 px-4 py-3 text-sm">
        <div className="flex justify-between text-creme/70">
          <span>Plats différents</span>
          <span className="tabular font-bold text-creme">{c.lignes.length}</span>
        </div>
        <div className="flex justify-between text-creme/70">
          <span>Mode</span>
          <span className="font-bold text-creme">{mode.libelle}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-creme/10 pt-2">
          <span className="text-base font-bold">TOTAL ARTICLES</span>
          <span className="tabular font-serif text-2xl font-semibold text-or">{nbArticles(c)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onAgir}
          className="flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-or to-terracotta text-lg font-bold text-creme shadow-[0_14px_28px_-12px_rgba(163,72,31,.9)] transition-[filter] hover:brightness-110"
        >
          <Icon name={e.actionIcone} className="size-[22px]" />
          {e.action}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onIndisponibilite}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-creme/15 text-sm font-bold text-creme/85 hover:bg-creme/[.06]"
          >
            <Icon name="ban" className="size-4" />
            Plat indisponible
          </button>
          <button
            type="button"
            onClick={onRetard}
            disabled={etape !== "preparation" || enRetard}
            className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-creme/15 text-sm font-bold text-creme/85 hover:bg-creme/[.06] disabled:cursor-default disabled:opacity-40"
          >
            <Icon name="alert" className="size-4" />
            Signaler un retard
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ Écran */

/** K1 · Commandes de la cuisine ; K2 · coupure réseau et indisponibilité. */
export function TableauCuisine() {
  const { commandes, changerStatut, erreurReseau, chargement } = useService();
  const utilisateur = useSession();
  const tic = useTic();
  const heure = useHorloge();
  const navigateur = useEnLigne();
  const enLigne = navigateur && !erreurReseau;
  const maintenant = useMaintenant();
  const ecouleDepuis = (iso?: string) => (iso && maintenant ? Math.max(0, (maintenant - new Date(iso).getTime()) / 1000) : 0);
  const [son, setSon] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [choix, setChoix] = useState<string | null>(null);
  const [remises, setRemises] = useState<string[]>([]);
  const [retards, setRetards] = useState<string[]>([]);
  const [indispo, setIndispo] = useState<Commande | null>(null);
  const [ticket, setTicket] = useState<Commande | null>(null);
  const [horsLigneDepuis, setHorsLigneDepuis] = useState(0);
  const rail = useRef<HTMLUListElement>(null);

  // Durée de la coupure, affichée dans le bandeau.
  if (!enLigne && horsLigneDepuis === 0) setHorsLigneDepuis(tic || 1);
  if (enLigne && horsLigneDepuis !== 0) setHorsLigneDepuis(0);

  // Commandes de la cuisine, dans l'ordre du service : à lancer, au feu, au passe ; les plus anciennes d'abord.
  const actives = commandes
    .filter((c) => estEtape(c.statut) && !remises.includes(c.numero))
    .sort((a, b) => ORDRE.indexOf(a.statut as Etape) - ORDRE.indexOf(b.statut as Etape) || (a.majLe ?? "").localeCompare(b.majLe ?? ""));
  const enRetard = (c: Commande) =>
    c.statut === "preparation" && (!!c.enRetard || retards.includes(c.numero) || ecouleDepuis(c.majLe) > SEUIL_RETARD_SEC);

  const compte = (f: Filtre) =>
    f === "toutes" ? actives.length : f === "retard" ? actives.filter(enRetard).length : actives.filter((c) => c.statut === f).length;
  const visibles = actives.filter((c) => filtre === "toutes" || (filtre === "retard" ? enRetard(c) : c.statut === filtre));
  const selection = actives.find((c) => c.numero === choix) ?? visibles[0] ?? null;

  function agir(c: Commande) {
    const note = `Cuisine · ${utilisateur.nom}`;
    if (c.statut === "confirmee") void changerStatut(c.numero, "preparation", note);
    else if (c.statut === "preparation") void changerStatut(c.numero, "prete", note);
    else if (c.statut === "prete") setRemises((r) => [...r, c.numero]);
  }

  const FILTRES: { cle: Filtre; libelle: string; icone: NomIcone }[] = [
    { cle: "toutes", libelle: "Toutes", icone: "grid" },
    { cle: "confirmee", libelle: "À lancer", icone: "bell" },
    { cle: "preparation", libelle: "Au feu", icone: "flame" },
    { cle: "prete", libelle: "Au passe", icone: "bag" },
    { cle: "retard", libelle: "En retard", icone: "alert" },
  ];

  return (
    <>
      {!enLigne ? (
        <div role="alert" className="flex shrink-0 items-center gap-3 bg-attention-fond px-7 py-3 text-lg font-bold text-encre">
          <Icon name="wifiOff" className="size-6 text-attention" />
          Connexion perdue depuis {formatMinuteur(tic - horsLigneDepuis)} : nouvelle tentative en cours. Les commandes affichées restent visibles.
          <span className="ml-auto hidden text-[15px] font-medium text-[#5A4A2A] lg:inline">Imprimez un ticket en secours</span>
        </div>
      ) : null}

      <header className="flex h-[84px] shrink-0 items-center gap-4 border-b border-creme/[.08] bg-[#11201b] px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 md:px-7">
        {/* Identité et état */}
        <div className="flex min-w-0 items-center gap-4">
          <LogoMark size={32} clair />
          <div className="flex flex-col leading-tight">
            <span className="hidden text-[11px] font-bold tracking-[.28em] text-or sm:inline">MAISON SORA</span>
            <h1 className="m-0 font-serif text-[28px] font-semibold">Cuisine</h1>
          </div>
          <span
            className={cx(
              "ml-2 hidden items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold xl:flex",
              enLigne ? "bg-en-ligne/10 text-en-ligne" : "bg-attention-fond/15 text-attention-fond",
            )}
          >
            <span className={cx("size-2 rounded-full", enLigne ? "animate-pulse bg-en-ligne" : "bg-attention-fond")} />
            {enLigne ? "En direct" : "Hors ligne"}
          </span>
        </div>

        {/* Heure et charge du service */}
        <div className="hidden items-center gap-5 md:flex">
          <span className="tabular font-serif text-[40px] leading-none font-semibold whitespace-nowrap">{heure}</span>
          <span className="hidden h-10 w-px bg-creme/15 md:block" />
          <div className="hidden flex-col text-sm leading-tight md:flex">
            <span className="font-bold">
              {compte("confirmee") + compte("preparation")} commande{compte("confirmee") + compte("preparation") > 1 ? "s" : ""} en cours
            </span>
            <span className={cx(compte("retard") ? "font-bold text-[#F2A98A]" : "text-creme/55")}>
              {compte("retard") ? `${compte("retard")} en retard` : "Aucun retard"}
            </span>
          </div>
        </div>

        {/* Son et profil */}
        <div className="ml-auto flex items-center justify-end gap-3 md:ml-0">
          <span className="tabular hidden font-serif text-2xl font-semibold whitespace-nowrap sm:inline md:hidden">{heure}</span>
          <button
            type="button"
            onClick={() => setSon((s) => !s)}
            aria-pressed={son}
            aria-label={son ? "Couper le son" : "Activer le son"}
            title={son ? "Son activé" : "Son coupé"}
            className={cx(
              "flex size-12 cursor-pointer items-center justify-center rounded-xl border transition-colors",
              son ? "border-or/40 bg-or/10 text-or" : "border-creme/15 text-creme/45 hover:text-creme/70",
            )}
          >
            <Icon name="bell" className="size-[22px]" />
          </button>
          <span className="flex items-center gap-3 rounded-2xl border border-creme/[.08] bg-creme/[.04] py-1.5 pr-1.5 pl-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-or text-sm font-bold text-nuit">
              {utilisateur.initiales}
            </span>
            <span className="hidden flex-col leading-tight lg:flex">
              <span className="text-[15px] font-bold">{utilisateur.nom}</span>
              <span className="text-xs text-creme/60">{utilisateur.role}</span>
            </span>
            <button
              type="button"
              onClick={() => void utilisateur.seDeconnecter()}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-creme/70 transition-colors hover:bg-creme/10 hover:text-creme"
            >
              <Icon name="logout" className="size-5" />
            </button>
          </span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_76px_400px]">
        {/* Filtres et grille */}
        <section aria-label="Commandes" className="flex flex-col gap-4 lg:min-h-0">
          <nav
            aria-label="Filtrer les commandes"
            className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto rounded-full border border-creme/[.08] bg-creme/[.03] p-1.5"
          >
            {FILTRES.map((f) => {
              const actif = f.cle === filtre;
              const n = compte(f.cle);
              return (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => setFiltre(f.cle)}
                  aria-pressed={actif}
                  className={cx(
                    "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[15px] font-bold transition-colors",
                    actif ? "bg-creme/[.08] text-or ring-1 ring-or/40" : "text-creme/70 hover:text-creme",
                    f.cle === "retard" && n > 0 && !actif && "text-[#F2A98A]",
                  )}
                >
                  <Icon name={f.icone} className="size-[18px]" />
                  {f.libelle}
                  <span
                    className={cx(
                      "tabular flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs",
                      actif ? "bg-or text-nuit" : "bg-creme/10 text-creme/80",
                    )}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </nav>

          <ul className="no-scrollbar grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] content-start gap-3.5 pb-2 lg:min-h-0 lg:overflow-y-auto">
            {visibles.map((c) => (
              <CarteCommande
                key={c.numero}
                c={c}
                etape={c.statut as Etape}
                ecoule={ecouleDepuis(c.majLe)}
                enRetard={enRetard(c)}
                selectionnee={selection?.numero === c.numero}
                onSelection={() => setChoix(c.numero)}
                onAgir={() => {
                  setChoix(c.numero);
                  agir(c);
                }}
              />
            ))}
            {visibles.length === 0 ? (
              <li className="col-span-full flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-creme/10 px-6 py-16 text-center text-creme/45">
                <Icon name="flame" className="size-9" />
                <span className="text-lg font-medium">{chargement ? "Chargement…" : "Aucune commande dans ce filtre"}</span>
              </li>
            ) : null}
          </ul>
        </section>

        {/* Rail des numéros, comme les tables du modèle */}
        <nav aria-label="Accès rapide aux commandes" className="hidden min-h-0 flex-col items-center gap-2 rounded-[26px] border border-creme/[.06] bg-creme/[.025] py-2.5 xl:flex">
          <button
            type="button"
            aria-label="Remonter"
            onClick={() => rail.current?.scrollBy({ top: -180, behavior: "smooth" })}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-creme/60 hover:bg-creme/10"
          >
            <Icon name="down" className="size-5 rotate-180" />
          </button>
          <ul ref={rail} className="no-scrollbar flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-1">
            {actives.map((c) => {
              const e = ETAPES[c.statut as Etape];
              const actif = selection?.numero === c.numero;
              return (
                <li key={c.numero}>
                  <button
                    type="button"
                    onClick={() => {
                      setChoix(c.numero);
                      if (filtre !== "toutes" && !visibles.includes(c)) setFiltre("toutes");
                    }}
                    title={`${lieu(c)} · ${e.libelle}`}
                    aria-pressed={actif}
                    className={cx(
                      "tabular flex size-12 cursor-pointer items-center justify-center rounded-full text-[13px] font-bold ring-2 transition-colors",
                      actif ? "bg-gradient-to-br from-or to-terracotta text-creme ring-or" : cx("bg-nuit-carte text-creme/80 hover:text-creme", enRetard(c) ? "ring-[#E07E58]" : e.anneau),
                    )}
                  >
                    {numeroCourt(c.numero)}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            aria-label="Descendre"
            onClick={() => rail.current?.scrollBy({ top: 180, behavior: "smooth" })}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-creme/60 hover:bg-creme/10"
          >
            <Icon name="down" className="size-5" />
          </button>
        </nav>

        {/* Détail de la commande sélectionnée */}
        {selection ? (
          <PanneauCommande
            key={selection.numero}
            c={selection}
            etape={selection.statut as Etape}
            ecoule={ecouleDepuis(selection.majLe)}
            enRetard={enRetard(selection)}
            onAgir={() => agir(selection)}
            onRetard={() => setRetards((r) => (r.includes(selection.numero) ? r : [...r, selection.numero]))}
            onIndisponibilite={() => setIndispo(selection)}
            onTicket={() => setTicket(selection)}
          />
        ) : (
          <aside className="hidden flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-or/20 p-6 text-center text-creme/45 lg:flex">
            <Icon name="list" className="size-9" />
            <span className="text-base font-medium">Sélectionnez une commande pour voir le détail.</span>
          </aside>
        )}
      </main>

      {indispo ? (
        <ModaleIndisponibilite commande={indispo} horsLigne={!enLigne} onFermer={() => setIndispo(null)} />
      ) : null}
      {ticket ? <TicketSecours commande={ticket} onFermer={() => setTicket(null)} /> : null}
    </>
  );
}
