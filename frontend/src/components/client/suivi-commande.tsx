"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Encadre, Historique, cx } from "@/components/ui/primitives";
import { enregistrerCommandeLocale, lireCommandeLocale, type CommandeLocale } from "@/lib/client/panier";
import { formatFCFA, formatHeure, formatMinuteur } from "@/lib/format";
import { COULEUR_HISTORIQUE, DELAI_DESISTEMENT_SEC, MODES_PAIEMENT, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import type { EvenementCommande, StatutCommande } from "@/lib/types";
import { totalCommande } from "@/lib/demo/commandes";

/**
 * Simulation locale de l'avancement tant que l'API `orders` n'est pas branchée :
 * reçue (5 min) → confirmée (1 min) → en préparation (temps du plat le plus long) → prête.
 */
const CONFIRMATION_VERS_PREPARATION_SEC = 60;

function commandeDemo(numero: string): CommandeLocale {
  return {
    numero,
    statut: "recue",
    mode: "chambre",
    emplacement: "204",
    paiement: "carte",
    payee: false,
    passeeA: "",
    creeeLe: Date.now() - 48 * 1000,
    lignes: [
      { platId: "PLAT-010", nom: "Kedjenou de poulet", quantite: 2, prixUnitaire: 6500, note: "Sans piment" },
      { platId: "PLAT-030", nom: "Alloco", quantite: 1, prixUnitaire: 1500 },
      { platId: "PLAT-050", nom: "Jus de bissap", quantite: 1, prixUnitaire: 500 },
    ],
    historique: [],
  };
}

function avancement(c: CommandeLocale, maintenant: number) {
  const ecoule = (maintenant - c.creeeLe) / 1000;
  const preparation = 15 * 60;
  const tConfirmee = DELAI_DESISTEMENT_SEC;
  const tPreparation = tConfirmee + CONFIRMATION_VERS_PREPARATION_SEC;
  const tPrete = tPreparation + preparation;
  let statut: StatutCommande = "recue";
  if (c.statut === "annulee") statut = "annulee";
  else if (ecoule >= tPrete) statut = "prete";
  else if (ecoule >= tPreparation) statut = "preparation";
  else if (ecoule >= tConfirmee) statut = "confirmee";

  const h = (s: number) => formatHeure(new Date(c.creeeLe + s * 1000));
  const historique: EvenementCommande[] = [
    { heure: h(0), statut: "Reçue", detail: "Commande passée depuis le menu", couleur: COULEUR_HISTORIQUE.recue },
  ];
  if (statut === "annulee") {
    historique.unshift(c.historique[0] ?? { heure: h(ecoule), statut: "Annulée", detail: "Désistement", couleur: "#B3261E" });
  } else {
    if (ecoule >= tConfirmee)
      historique.unshift({ heure: h(tConfirmee), statut: "Confirmée", detail: "Automatiquement, fin du délai", couleur: COULEUR_HISTORIQUE.confirmee });
    if (ecoule >= tPreparation)
      historique.unshift({ heure: h(tPreparation), statut: "En préparation", detail: "Cuisine", couleur: COULEUR_HISTORIQUE.preparation });
    if (ecoule >= tPrete)
      historique.unshift({ heure: h(tPrete), statut: "Prête", detail: "Cuisine", couleur: COULEUR_HISTORIQUE.prete });
  }

  return {
    statut,
    restantDesistement: Math.max(0, tConfirmee - ecoule),
    heurePrete: h(tPrete),
    minutesAvantPrete: Math.max(0, Math.ceil((tPrete - ecoule) / 60)),
    historique,
  };
}

const ETAPES: { cle: StatutCommande; libelle: string; icone: NomIcone }[] = [
  { cle: "recue", libelle: "Reçue", icone: "clock" },
  { cle: "confirmee", libelle: "Confirmée", icone: "check" },
  { cle: "preparation", libelle: "Préparation", icone: "flame" },
  { cle: "prete", libelle: "Prête", icone: "bag" },
];

function Etapes({ statut }: { statut: StatutCommande }) {
  const courant = ETAPES.findIndex((e) => e.cle === statut);
  return (
    <ol className="flex items-start" aria-label="Étapes de la commande">
      {ETAPES.map((e, i) => {
        const etat = i < courant || statut === "prete" ? "fait" : i === courant ? "cours" : "afaire";
        const dernier = i === ETAPES.length - 1;
        return (
          <li key={e.cle} className="relative flex flex-1 flex-col items-center gap-1.5" aria-current={etat === "cours" ? "step" : undefined}>
            {!dernier ? (
              <div className={cx("absolute top-[15px] left-1/2 h-0.5 w-full", etat === "fait" ? "bg-vert" : "bg-[#D6CDBD]")} />
            ) : null}
            <span
              className={cx(
                "relative flex size-8 items-center justify-center rounded-full",
                etat === "fait" && "border-2 border-vert bg-vert text-creme",
                etat === "cours" && "border-2 border-vert bg-papier text-vert",
                etat === "afaire" && "border-[1.5px] border-[#CFC6B6] bg-creme",
              )}
            >
              {etat === "fait" ? <Icon name="check" className="size-4" /> : etat === "cours" ? <Icon name={e.icone} className="size-4" /> : null}
            </span>
            <span className={cx("text-xs", etat === "afaire" ? "font-normal" : "font-bold")}>{e.libelle}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** C4 · Suivi pendant le délai de désistement, puis C5 · Suivi en préparation. */
export function SuiviCommande({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = use(params);
  const [commande, setCommande] = useState<CommandeLocale | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage du navigateur
    setCommande(lireCommandeLocale(numero) ?? commandeDemo(numero));
    const iv = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [numero]);

  if (!commande) return <div className="flex flex-1 items-center justify-center text-texte-3">Chargement…</div>;

  const a = avancement(commande, maintenant);
  const mode = MODES_SERVICE[commande.mode];
  const total = totalCommande(commande);
  const lieu = commande.mode === "emporter" ? "à emporter" : `${mode.libelle.toLowerCase()}, ${mode.court(commande.emplacement).toLowerCase()}`;

  function annuler() {
    if (!commande) return;
    const annulee: CommandeLocale = {
      ...commande,
      statut: "annulee",
      historique: [{ heure: formatHeure(new Date()), statut: "Annulée", detail: "Désistement pendant le délai", couleur: "#B3261E" }],
    };
    enregistrerCommandeLocale(annulee);
    setCommande(annulee);
  }

  const recap = (
    <div className="tabular flex flex-col gap-2.5 rounded-2xl border border-ligne bg-papier p-3.5 text-[15px]">
      {commande.lignes.map((l) => (
        <div key={l.platId} className="flex justify-between gap-3">
          <span>
            {l.quantite} × {l.nom}
          </span>
          <span className="shrink-0">{formatFCFA(l.quantite * l.prixUnitaire)}</span>
        </div>
      ))}
      <div className="h-px bg-ligne" />
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{formatFCFA(total)}</span>
      </div>
      <div className="flex items-center gap-2 text-[13px] text-texte-3">
        <Icon name={MODES_PAIEMENT[commande.paiement].icone} className="size-4" />
        Paiement au service : {MODES_PAIEMENT[commande.paiement].libelle.toLowerCase()}
      </div>
    </div>
  );

  /* ---------- Annulée */
  if (a.statut === "annulee") {
    return (
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-8 pb-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-danger-fond text-danger">
            <Icon name="x" className="size-6" />
          </span>
          <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">Commande annulée</h1>
          <span className="text-sm text-texte-3">N° {commande.numero} · rien ne vous sera facturé</span>
        </div>
        {recap}
        <Link href="/menu" className="flex h-14 items-center justify-center rounded-xl bg-terracotta font-bold text-creme">
          Retour à la carte
        </Link>
      </div>
    );
  }

  /* ---------- C4 · Délai de désistement */
  if (a.statut === "recue") {
    const pct = (a.restantDesistement / DELAI_DESISTEMENT_SEC) * 100;
    return (
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-6 pb-8">
        <div className="flex flex-col items-center gap-2 pt-1.5 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-neutre-fond">
            <Icon name="check" className="size-6" />
          </span>
          <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">Commande reçue</h1>
          <span className="text-sm text-texte-3">
            N° {commande.numero} · {lieu}
          </span>
        </div>
        <Etapes statut="recue" />
        <div className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] bg-vert p-5 text-creme">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[.14em] text-or">DÉSISTEMENT POSSIBLE</span>
            <Badge apparence={STATUTS_COMMANDE.recue} />
          </div>
          <div className="flex items-baseline gap-2.5" role="timer" aria-live="off">
            <span className="tabular text-[56px] leading-none font-bold tracking-[-.01em]">
              {formatMinuteur(a.restantDesistement)}
            </span>
            <span className="text-sm opacity-85">restantes</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-creme/20">
            <div className="h-1.5 rounded-[3px] bg-or transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <p className="m-0 text-sm leading-5 text-[#E4E9E5]">
            Sans annulation de votre part, la commande sera confirmée à la fin du délai et transmise à la cuisine.
          </p>
          <button
            type="button"
            onClick={annuler}
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-creme text-base font-bold text-danger"
          >
            <Icon name="x" className="size-[18px]" />
            Annuler ma commande
          </button>
        </div>
        {recap}
      </div>
    );
  }

  /* ---------- C5 · Confirmée, en préparation ou prête */
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <h1 className="m-0 font-serif text-2xl font-semibold text-vert">Ma commande</h1>
        <Badge apparence={STATUTS_COMMANDE[a.statut]} taille="md" />
      </header>
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-2 pb-8">
        <div className="overflow-hidden rounded-[20px] bg-vert text-creme">
          <div className="grid grid-cols-[1fr_auto] items-end gap-4 p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[.14em] text-or">{a.statut === "prete" ? "PRÊTE DEPUIS" : "PRÊTE VERS"}</span>
              <span className="font-serif text-[40px] leading-none font-semibold">{a.heurePrete}</span>
              <span className="text-sm opacity-85">
                {a.statut === "prete"
                  ? commande.mode === "emporter"
                    ? "À retirer au comptoir"
                    : "Le personnel vous l'apporte"
                  : `environ ${a.minutesAvantPrete} min`}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-xs font-bold text-or">N°</span>
              <span className="tabular text-[30px] font-bold">{commande.numero}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-dashed border-or/60 px-5 py-3.5 text-xs">
            <div className="flex flex-col gap-[3px]">
              <span className="font-bold text-or">MODE</span>
              <span className="text-sm font-bold">{mode.libelle}</span>
            </div>
            <div className="flex flex-col gap-[3px]">
              <span className="font-bold text-or">{commande.mode === "table" ? "TABLE" : commande.mode === "chambre" ? "CHAMBRE" : "RETRAIT"}</span>
              <span className="text-sm font-bold">{commande.mode === "emporter" ? "Comptoir" : commande.emplacement}</span>
            </div>
            <div className="flex flex-col gap-[3px]">
              <span className="font-bold text-or">PAIEMENT</span>
              <span className="text-sm font-bold">{MODES_PAIEMENT[commande.paiement].libelle}</span>
            </div>
          </div>
        </div>
        <Etapes statut={a.statut} />
        <div className="flex flex-col gap-3.5 rounded-2xl border border-ligne bg-papier p-4">
          <span className="text-[15px] font-bold">Historique</span>
          <Historique evenements={a.historique} />
        </div>
        {recap}
        <Encadre icone="info">
          Le délai d&apos;annulation est passé. Pour toute modification, adressez-vous au personnel.
        </Encadre>
      </div>
    </div>
  );
}
