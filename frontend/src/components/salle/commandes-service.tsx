"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Historique, Puce, cx } from "@/components/ui/primitives";
import { formatFCFA } from "@/lib/format";
import { MODES_PAIEMENT, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import { useService } from "@/lib/staff/service";
import { useSession } from "@/lib/staff/session";
import type { Commande, ModePaiement, StatutCommande } from "@/lib/types";
import { ModaleAnnulation } from "./modale-annulation";
import { ModaleEmplacement } from "./modale-emplacement";

/** Total serveur si connu, sinon somme des lignes. */
export function totalCommande(c: Pick<Commande, "lignes" | "total">): number {
  return c.total ?? c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
}

const TERMINEES: StatutCommande[] = ["annulee", "refusee", "cloturee"];

type Filtre = "toutes" | "servir" | "encaisser" | "cuisine";

const FILTRES: { cle: Filtre; libelle: string; test: (c: Commande) => boolean }[] = [
  { cle: "toutes", libelle: "Toutes", test: () => true },
  { cle: "servir", libelle: "À servir", test: (c) => c.statut === "prete" },
  { cle: "encaisser", libelle: "À encaisser", test: (c) => !c.payee && !TERMINEES.includes(c.statut) },
  { cle: "cuisine", libelle: "En cuisine", test: (c) => c.statut === "confirmee" || c.statut === "preparation" },
];

const APPARENCE_PAYEE = { libelle: "Payée", icone: "check" as const, classes: "text-ok bg-ok-fond" };
const APPARENCE_A_ENCAISSER = { libelle: "À encaisser", icone: "wallet" as const, classes: "text-attention bg-attention-fond-2" };

/** Action suivante proposée au serveur selon le statut. */
function actionSuivante(c: Commande): { libelle: string; cible: StatutCommande | null } {
  switch (c.statut) {
    case "recue":
      return { libelle: "Confirmer et transmettre en cuisine", cible: "confirmee" };
    case "confirmee":
    case "preparation":
      return { libelle: "En cuisine · à servir quand prête", cible: null };
    case "prete":
      return c.mode === "chambre"
        ? { libelle: "Partir en livraison", cible: "livraison" }
        : { libelle: c.mode === "emporter" ? "Marquer comme remise" : "Marquer comme servie", cible: "servie" };
    case "livraison":
      return { libelle: "Marquer comme livrée", cible: "servie" };
    case "servie":
      return c.payee ? { libelle: "Clôturer la commande", cible: "cloturee" } : { libelle: "Encaisser pour clôturer", cible: null };
    default:
      return { libelle: "Commande terminée", cible: null };
  }
}

/** S1 · Commandes du service, avec le détail de la commande sélectionnée. */
export function CommandesService() {
  const { commandes, chargement, selection, selectionner, changerStatut, marquerPayee } = useService();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const { utilisateur } = useSession();
  // Le serveur annule avant la préparation ; le gestionnaire à tout moment avant clôture.
  const peutAnnuler = (s: StatutCommande) => utilisateur.role !== "WAITER" || s === "recue" || s === "confirmee";
  const [annulation, setAnnulation] = useState(false);
  const [emplacement, setEmplacement] = useState(false);
  const [modeChoisi, setModeChoisi] = useState<{ numero: string; mode: ModePaiement } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const actives = commandes.filter((c) => !TERMINEES.includes(c.statut));
  const visibles = commandes.filter(FILTRES.find((f) => f.cle === filtre)!.test);
  const sel = commandes.find((c) => c.numero === selection) ?? null;
  const modePaiement = sel && modeChoisi?.numero === sel.numero ? modeChoisi.mode : (sel?.paiement ?? "especes");

  async function agir(f: () => Promise<boolean>) {
    setEnvoi(true);
    await f();
    setEnvoi(false);
  }

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
                    {!["annulee", "refusee"].includes(c.statut) ? <Badge apparence={c.payee ? APPARENCE_PAYEE : APPARENCE_A_ENCAISSER} /> : null}
                  </span>
                  <span className="tabular text-right text-[15px] font-bold">{formatFCFA(totalCommande(c))}</span>
                </button>
              </li>
            );
          })}
          {visibles.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-bordure p-6 text-center text-sm text-texte-3">
              {chargement ? "Chargement des commandes…" : "Aucune commande dans ce filtre."}
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
            {sel.mode !== "emporter" && (sel.statut === "recue" || sel.statut === "confirmee") ? (
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
                  {sel.payee ? (
                    <span className="flex items-center gap-2.5 text-[17px] font-bold">
                      <Icon name={MODES_PAIEMENT[sel.paiement].icone} className="size-6 text-vert" />
                      {MODES_PAIEMENT[sel.paiement].libelle}
                    </span>
                  ) : (
                    <div className="flex gap-1.5" role="group" aria-label="Mode de paiement">
                      {(Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((m) => (
                        <Puce key={m} actif={m === modePaiement} onClick={() => setModeChoisi({ numero: sel.numero, mode: m })}>
                          {MODES_PAIEMENT[m].libelle}
                        </Puce>
                      ))}
                    </div>
                  )}
                  <Badge apparence={sel.payee ? APPARENCE_PAYEE : APPARENCE_A_ENCAISSER} taille="md" />
                </div>
                {!sel.payee && !TERMINEES.includes(sel.statut) && sel.statut !== "recue" ? (
                  <Bouton
                    hauteur="xl"
                    icone="check"
                    className="text-[17px]"
                    disabled={envoi}
                    onClick={() => agir(() => marquerPayee(sel.numero, modePaiement))}
                  >
                    Marquer comme payé · {formatFCFA(totalCommande(sel))}
                  </Bouton>
                ) : null}
                {sel.payee ? <span className="text-sm font-medium text-ok">Paiement enregistré.</span> : null}
                <span className="text-[13px] text-texte-3">Paiement en totalité uniquement. Rien n&apos;est encaissé en ligne.</span>
              </div>
            </div>

            <div className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-3.5 rounded-2xl border border-ligne bg-papier p-[18px]">
                <span className="text-[13px] font-bold tracking-[.12em] text-texte-3">HISTORIQUE</span>
                <Historique evenements={sel.historique} largeurHeure={60} />
              </div>
              {!TERMINEES.includes(sel.statut) ? (
                <div className="mt-auto flex flex-col gap-2.5">
                  {(() => {
                    const a = actionSuivante(sel);
                    const cible = a.cible;
                    return (
                      <Bouton
                        variante="contour"
                        hauteur="xl"
                        icone={sel.statut === "servie" ? "lock" : sel.statut === "recue" ? "check" : "truck"}
                        disabled={!cible || envoi}
                        onClick={() => cible && agir(() => changerStatut(sel.numero, cible))}
                      >
                        {a.libelle}
                      </Bouton>
                    );
                  })()}
                  {sel.statut !== "servie" && peutAnnuler(sel.statut) ? (
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
          <ModaleEmplacement key={`e-${sel.numero}-${emplacement}`} commande={sel} ouverte={emplacement} onFermer={() => setEmplacement(false)} />
        </>
      ) : null}
    </div>
  );
}
