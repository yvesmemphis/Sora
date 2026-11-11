"use client";

import { useState } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { LogoMark, cx } from "@/components/ui/primitives";
import { numeroCourt } from "@/lib/api/conversions";
import { formatMinuteur } from "@/lib/format";
import { useEnLigne, useHorloge, useMaintenant, useTic } from "@/lib/hooks";
import { MODES_SERVICE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import { useSession } from "@/lib/staff/session";
import type { Commande, StatutCommande } from "@/lib/types";
import { MenuActionsCuisine } from "./menu-actions";
import { ModaleIndisponibilite } from "./modale-indisponibilite";
import { TicketSecours } from "./ticket-secours";

/** Au-delà de ce temps de préparation, la commande est signalée en retard. */
const SEUIL_RETARD_SEC = 15 * 60;

const COLONNES: {
  statut: StatutCommande;
  titre: string;
  pastille: [string, string, NomIcone];
  bouton: [string, string, NomIcone];
}[] = [
  { statut: "confirmee", titre: "CONFIRMÉES", pastille: ["Confirmée", "bg-neutre-fond", "check"], bouton: ["Commencer", "bg-creme text-nuit", "play"] },
  { statut: "preparation", titre: "EN PRÉPARATION", pastille: ["En préparation", "bg-attention-fond", "flame"], bouton: ["Marquer prête", "bg-or text-nuit", "check"] },
  { statut: "prete", titre: "PRÊTES", pastille: ["Prête", "bg-ok-fond", "bag"], bouton: ["Remise à la salle", "border-[1.5px] border-creme/30 text-creme", "arrow"] },
];

/** K1 · Tableau en 3 colonnes ; K2 · coupure réseau et indisponibilité. */
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
  const [remises, setRemises] = useState<string[]>([]);
  const [retards, setRetards] = useState<string[]>([]);
  const [indispo, setIndispo] = useState<Commande | null>(null);
  const [ticket, setTicket] = useState<Commande | null>(null);
  const [horsLigneDepuis, setHorsLigneDepuis] = useState(0);

  // Durée de la coupure, affichée dans le bandeau.
  if (!enLigne && horsLigneDepuis === 0) setHorsLigneDepuis(tic || 1);
  if (enLigne && horsLigneDepuis !== 0) setHorsLigneDepuis(0);

  const visibles = commandes.filter((c) => !remises.includes(c.numero));

  function agir(c: Commande) {
    const note = `Cuisine · ${utilisateur.nom}`;
    if (c.statut === "confirmee") void changerStatut(c.numero, "preparation", note);
    else if (c.statut === "preparation") void changerStatut(c.numero, "prete", note);
    else if (c.statut === "prete") setRemises((r) => [...r, c.numero]);
  }

  return (
    <>
      {!enLigne ? (
        <div role="alert" className="flex shrink-0 items-center gap-3 bg-attention-fond px-7 py-3.5 text-lg font-bold text-encre">
          <Icon name="wifiOff" className="size-6 text-attention" />
          Connexion perdue : nouvelle tentative en cours. Les commandes déjà affichées restent visibles.
          <span className="ml-auto hidden text-[15px] font-medium text-[#5A4A2A] lg:inline">Imprimez un ticket en secours</span>
        </div>
      ) : null}

      <header className="flex h-[76px] shrink-0 items-center gap-6 border-b border-or/25 px-7">
        <div className="flex items-center gap-3">
          <LogoMark size={28} clair />
          <h1 className="m-0 text-[26px] font-bold">Cuisine</h1>
        </div>
        {enLigne ? (
          <span className="flex items-center gap-2 rounded-full bg-creme/8 px-3.5 py-2 text-base font-medium">
            <span className="size-2.5 rounded-full bg-en-ligne" />
            En ligne · actualisé toutes les 5 s
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-full bg-attention-fond/15 px-3.5 py-2 text-base font-bold text-attention-fond">
            <span className="size-2.5 rounded-full bg-attention-fond" />
            Hors ligne depuis {formatMinuteur(tic - horsLigneDepuis)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-7">
          <button
            type="button"
            onClick={() => setSon((s) => !s)}
            aria-pressed={son}
            className={cx("flex cursor-pointer items-center gap-2 text-base font-bold", son ? "text-or" : "text-creme/60")}
          >
            <Icon name="bell" className="size-5" />
            {son ? "Son activé" : "Son coupé"}
          </button>
          <span className="tabular text-[32px] font-bold">{heure}</span>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-[18px] overflow-y-auto px-[22px] pt-[18px] pb-[22px] md:grid-cols-3 md:overflow-hidden">
        {COLONNES.map((col) => {
          const cartes = visibles.filter((c) => c.statut === col.statut);
          return (
            <section key={col.statut} aria-label={col.titre} className="flex min-h-0 flex-col gap-3.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="m-0 text-lg font-bold tracking-[.14em] text-or">{col.titre}</h2>
                <span className="flex size-9 items-center justify-center rounded-full bg-creme/10 text-lg font-bold">{cartes.length}</span>
              </div>
              <ul className="flex min-h-0 flex-col gap-3.5 overflow-y-auto pb-2">
                {cartes.map((c) => {
                  const ecoule = ecouleDepuis(c.majLe);
                  const enRetard =
                    col.statut === "preparation" && (c.enRetard || retards.includes(c.numero) || ecoule > SEUIL_RETARD_SEC);
                  const nouvelle = col.statut === "confirmee" && ecoule < 120;
                  const [pLib, pFond, pIcone] = enRetard
                    ? ["En retard", "bg-[#F2C4AE]", "alert" as NomIcone]
                    : nouvelle
                      ? ["Nouvelle", "bg-[#E7C77F]", "bell" as NomIcone]
                      : col.pastille;
                  const mode = MODES_SERVICE[c.mode];
                  return (
                    <li
                      key={c.numero}
                      className={cx(
                        "relative flex flex-col gap-2.5 rounded-2xl bg-nuit-carte px-[18px] py-4",
                        enRetard ? "border-2 border-[#E07E58]" : nouvelle ? "border-2 border-or" : "border border-creme/8",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="tabular text-5xl leading-[52px] font-bold" title={`N° ${c.numero}`}>
                            {numeroCourt(c.numero)}
                          </span>
                          <span className="flex items-center gap-2 text-lg text-[#D9E0DB]">
                            <Icon name={mode.icone} className="size-5 text-or" />
                            {c.emplacement === "—" ? mode.libelle : mode.long(c.emplacement).replace(", chambre", "")}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cx("tabular text-[30px] font-bold", enRetard ? "text-[#F2A98A]" : "text-creme")} title="Temps écoulé">
                            {formatMinuteur(ecoule)}
                          </span>
                          <span className={cx("flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[15px] font-bold text-encre", pFond)}>
                            <Icon name={pIcone} className="size-4" />
                            {pLib}
                          </span>
                        </div>
                      </div>
                      <div className="h-px bg-creme/12" />
                      {c.lignes.map((l) => (
                        <span key={l.platId} className="text-2xl leading-[30px] font-bold">
                          {l.quantite} × {l.nom}
                        </span>
                      ))}
                      {c.note ? (
                        <span className="flex items-center gap-2 text-lg leading-6 text-[#E7C77F]">
                          <Icon name="note" className="size-5" />
                          {c.note}
                        </span>
                      ) : null}
                      <div className="mt-1 grid grid-cols-[1fr_64px] gap-2.5">
                        <button
                          type="button"
                          onClick={() => agir(c)}
                          className={cx("flex h-16 cursor-pointer items-center justify-center gap-2.5 rounded-xl text-xl font-bold", col.bouton[1])}
                        >
                          <Icon name={col.bouton[2]} className="size-[22px]" />
                          {col.bouton[0]}
                        </button>
                        <MenuActionsCuisine
                          commande={c}
                          enPreparation={col.statut === "preparation"}
                          onRetard={() => setRetards((r) => (r.includes(c.numero) ? r : [...r, c.numero]))}
                          onIndisponibilite={() => setIndispo(c)}
                          onTicket={() => setTicket(c)}
                        />
                      </div>
                    </li>
                  );
                })}
                {cartes.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-creme/15 p-6 text-center text-base text-creme/50">
                    {chargement ? "Chargement…" : "Aucune commande"}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </main>

      {indispo ? (
        <ModaleIndisponibilite commande={indispo} horsLigne={!enLigne} onFermer={() => setIndispo(null)} />
      ) : null}
      {ticket ? <TicketSecours commande={ticket} onFermer={() => setTicket(null)} /> : null}
    </>
  );
}
