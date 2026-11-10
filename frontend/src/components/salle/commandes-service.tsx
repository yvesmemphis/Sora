"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Historique, Puce, cx } from "@/components/ui/primitives";
import { totalCommande } from "@/lib/demo/commandes";
import { formatFCFA } from "@/lib/format";
import { MODES_PAIEMENT, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import type { Commande } from "@/lib/types";
import { SERVEUR_DEMO } from "./barre-salle";
import { ModaleAnnulation } from "./modale-annulation";
import { ModaleEmplacement } from "./modale-emplacement";

type Filtre = "toutes" | "servir" | "encaisser" | "cuisine";

const FILTRES: { cle: Filtre; libelle: string; test: (c: Commande) => boolean }[] = [
  { cle: "toutes", libelle: "Toutes", test: () => true },
  { cle: "servir", libelle: "À servir", test: (c) => c.statut === "prete" },
  { cle: "encaisser", libelle: "À encaisser", test: (c) => !c.payee && c.statut !== "annulee" },
  { cle: "cuisine", libelle: "En cuisine", test: (c) => c.statut === "confirmee" || c.statut === "preparation" },
];

const APPARENCE_PAYEE = { libelle: "Payée", icone: "check" as const, classes: "text-ok bg-ok-fond" };
const APPARENCE_A_ENCAISSER = { libelle: "À encaisser", icone: "wallet" as const, classes: "text-attention bg-attention-fond-2" };

/** Action suivante proposée au serveur selon le statut. */
function actionSuivante(c: Commande): { libelle: string; possible: boolean } {
  switch (c.statut) {
    case "recue":
      return { libelle: "Désistement possible pendant 5 min", possible: false };
    case "confirmee":
    case "preparation":
      return { libelle: "En cuisine · à servir quand prête", possible: false };
    case "prete":
      return {
        libelle: c.mode === "chambre" ? "Marquer comme livrée" : c.mode === "emporter" ? "Marquer comme remise" : "Marquer comme servie",
        possible: true,
      };
    case "servie":
      return { libelle: c.payee ? "Clôturer la commande" : "Encaisser avant de clôturer", possible: c.payee };
    default:
      return { libelle: "Commande terminée", possible: false };
  }
}

/** S1 · Commandes du service, avec le détail de la commande sélectionnée. */
export function CommandesService() {
  const { commandes, selection, selectionner, changerStatut, marquerPayee, cloturer } = useService();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [annulation, setAnnulation] = useState(false);
  const [emplacement, setEmplacement] = useState(false);

  const actives = commandes.filter((c) => c.statut !== "annulee");
  const visibles = commandes.filter(FILTRES.find((f) => f.cle === filtre)!.test);
  const sel = commandes.find((c) => c.numero === selection) ?? null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[440px_1fr]">
      {/* Liste */}
      <section
        aria-label="Commandes du service"
        className={cx("flex min-h-0 flex-col border-ligne-2 lg:border-r", sel && "hidden lg:flex")}
      >
        <div className="flex flex-col gap-3.5 px-5 pt-5 pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="m-0 font-serif text-[26px] font-semibold text-vert">Service du soir</h1>
            <span className="text-[13px] text-texte-3">{actives.length} actives</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map((f) => (
              <Puce key={f.cle} actif={f.cle === filtre} onClick={() => setFiltre(f.cle)} compteur={commandes.filter(f.test).length}>
                {f.libelle}
              </Puce>
            ))}
          </div>
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 pt-1 pb-5">
          {visibles.map((c) => {
            const actif = c.numero === selection;
            const mode = MODES_SERVICE[c.mode];
            return (
              <li key={c.numero}>
                <button
                  type="button"
                  onClick={() => selectionner(c.numero)}
                  aria-pressed={actif}
                  className={cx(
                    "grid w-full cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-2xl bg-papier px-4 py-3.5 text-left",
                    actif ? "border-2 border-vert shadow-[0_8px_20px_-12px_rgba(31,61,54,.5)]" : "border border-ligne",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="tabular text-xl font-bold">N° {c.numero}</span>
                    <span className="flex items-center gap-1.5 text-sm text-texte-2">
                      <Icon name={mode.icone} className="size-4 text-vert" />
                      {mode.court(c.emplacement)}
                    </span>
                  </span>
                  <span className="tabular text-right text-[13px] text-texte-3">{c.passeeA}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge apparence={STATUTS_COMMANDE[c.statut]} libelle={c.statut === "servie" ? "Servie" : undefined} />
                    {c.statut !== "annulee" ? <Badge apparence={c.payee ? APPARENCE_PAYEE : APPARENCE_A_ENCAISSER} /> : null}
                  </span>
                  <span className="tabular text-right text-[15px] font-bold">{formatFCFA(totalCommande(c))}</span>
                </button>
              </li>
            );
          })}
          {visibles.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-bordure p-6 text-center text-sm text-texte-3">
              Aucune commande dans ce filtre.
            </li>
          ) : null}
        </ul>
      </section>

      {/* Détail */}
      {sel ? (
        <section aria-label={`Commande ${sel.numero}`} className="flex min-h-0 flex-col gap-[18px] overflow-y-auto px-5 py-6 md:px-7">
          <button
            type="button"
            onClick={() => selectionner(null)}
            className="flex items-center gap-1.5 self-start text-sm font-medium text-vert lg:hidden"
          >
            <Icon name="left" className="size-4" />
            Toutes les commandes
          </button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular text-4xl font-bold text-vert">N° {sel.numero}</span>
                <Badge apparence={STATUTS_COMMANDE[sel.statut]} taille="md" libelle={sel.statut === "servie" ? "Servie" : undefined} />
              </div>
              <span className="flex items-center gap-2 text-[15px] text-texte-2">
                <Icon name={MODES_SERVICE[sel.mode].icone} className="size-[18px] text-vert" />
                {MODES_SERVICE[sel.mode].long(sel.emplacement)} · passée à {sel.passeeA}
              </span>
            </div>
            {sel.statut !== "annulee" && sel.statut !== "servie" ? (
              <Bouton variante="fantome" hauteur="lg" icone="edit" onClick={() => setEmplacement(true)}>
                Modifier l&apos;emplacement
              </Bouton>
            ) : null}
          </div>

          <div className="grid gap-[18px] xl:grid-cols-[1.25fr_1fr]">
            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-3 rounded-2xl border border-ligne bg-papier p-[18px]">
                <span className="text-[13px] font-bold tracking-[.12em] text-texte-3">ARTICLES</span>
                {sel.lignes.map((l) => (
                  <div key={l.platId} className="tabular flex justify-between gap-3 text-[17px]">
                    <span>
                      <b>{l.quantite} ×</b> {l.nom}
                    </span>
                    <span className="shrink-0">{formatFCFA(l.quantite * l.prixUnitaire)}</span>
                  </div>
                ))}
                {sel.note ? (
                  <div className="flex items-center gap-2 rounded-[10px] bg-sable px-3 py-2.5 text-sm">
                    <Icon name="note" className="size-4 text-attention" />
                    {sel.note}
                  </div>
                ) : null}
                <div className="h-px bg-ligne" />
                <div className="tabular flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>{formatFCFA(totalCommande(sel))}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3.5 rounded-2xl border border-ligne bg-papier p-[18px]">
                <span className="text-[13px] font-bold tracking-[.12em] text-texte-3">PAIEMENT</span>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 text-[17px] font-bold">
                    <Icon name={MODES_PAIEMENT[sel.paiement].icone} className="size-6 text-vert" />
                    {MODES_PAIEMENT[sel.paiement].libelle}
                  </span>
                  <Badge apparence={sel.payee ? APPARENCE_PAYEE : APPARENCE_A_ENCAISSER} taille="md" />
                </div>
                {!sel.payee && sel.statut !== "recue" && sel.statut !== "annulee" ? (
                  <Bouton
                    hauteur="xl"
                    icone="check"
                    className="text-[17px]"
                    onClick={() => marquerPayee(sel.numero, SERVEUR_DEMO.nom)}
                  >
                    Marquer comme payé · {formatFCFA(totalCommande(sel))}
                  </Bouton>
                ) : null}
                {sel.payee ? (
                  <span className="text-sm font-medium text-ok">
                    Paiement enregistré{" "}
                    {sel.historique.find((h) => h.statut === "Payée")
                      ? `à ${sel.historique.find((h) => h.statut === "Payée")!.heure}`
                      : ""}
                    .
                  </span>
                ) : null}
                <span className="text-[13px] text-texte-3">Paiement en totalité uniquement. Rien n&apos;est encaissé en ligne.</span>
              </div>
            </div>

            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-3.5 rounded-2xl border border-ligne bg-papier p-[18px]">
                <span className="text-[13px] font-bold tracking-[.12em] text-texte-3">HISTORIQUE</span>
                <Historique evenements={sel.historique} largeurHeure={60} />
              </div>
              {sel.statut !== "annulee" ? (
                <div className="mt-auto flex flex-col gap-2.5">
                  {(() => {
                    const a = actionSuivante(sel);
                    return (
                      <Bouton
                        variante="contour"
                        hauteur="xl"
                        icone={sel.statut === "servie" ? "lock" : "truck"}
                        disabled={!a.possible}
                        onClick={() => {
                          if (sel.statut === "prete") changerStatut(sel.numero, "servie", SERVEUR_DEMO.nom);
                          else if (sel.statut === "servie") {
                            cloturer(sel.numero);
                            selectionner(null);
                          }
                        }}
                      >
                        {a.libelle}
                      </Bouton>
                    );
                  })()}
                  {sel.statut !== "servie" ? (
                    <Bouton variante="danger-texte" hauteur="lg" icone="x" onClick={() => setAnnulation(true)}>
                      Annuler la commande
                    </Bouton>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <div className="hidden items-center justify-center text-texte-3 lg:flex">Sélectionnez une commande.</div>
      )}

      {sel ? (
        <>
          <ModaleAnnulation key={`a-${sel.numero}`} commande={sel} ouverte={annulation} onFermer={() => setAnnulation(false)} />
          <ModaleEmplacement
            key={`e-${sel.numero}-${emplacement}`}
            commande={sel}
            ouverte={emplacement}
            onFermer={() => setEmplacement(false)}
          />
        </>
      ) : null}
    </div>
  );
}
