"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Encadre, Historique, cx } from "@/components/ui/primitives";
import { ApiError, messageErreur } from "@/lib/api/client";
import { heureDe, statutFront } from "@/lib/api/conversions";
import { suivreCommande, type SuiviApi } from "@/lib/api/commandes";
import { lireCommandeLocale, type CommandeLocale } from "@/lib/client/panier";
import { formatFCFA } from "@/lib/format";
import { ACTUALISATION_MS, COULEUR_HISTORIQUE, MODES_PAIEMENT, MODES_SERVICE, STATUTS_COMMANDE } from "@/lib/statuts";
import type { EvenementCommande, StatutCommande } from "@/lib/types";

const TERMINAUX: StatutCommande[] = ["servie", "cloturee", "annulee", "refusee"];

const ETAPES: { cle: StatutCommande; libelle: string; icone: NomIcone }[] = [
  { cle: "recue", libelle: "Reçue", icone: "clock" },
  { cle: "confirmee", libelle: "Confirmée", icone: "check" },
  { cle: "preparation", libelle: "Préparation", icone: "flame" },
  { cle: "prete", libelle: "Prête", icone: "bag" },
];

function Etapes({ statut }: { statut: StatutCommande }) {
  const apres = ["livraison", "servie", "cloturee"].includes(statut);
  const courant = apres ? ETAPES.length : ETAPES.findIndex((e) => e.cle === statut);
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

/** Message principal du bandeau selon le statut. */
function message(statut: StatutCommande, mode: CommandeLocale["mode"] | undefined): string {
  switch (statut) {
    case "confirmee":
      return "Transmise à la cuisine";
    case "preparation":
      return "La cuisine prépare votre commande";
    case "prete":
      return mode === "emporter" ? "À retirer au comptoir" : "Le personnel vous l'apporte";
    case "livraison":
      return "En route vers votre chambre";
    case "servie":
    case "cloturee":
      return "Bon appétit !";
    default:
      return "";
  }
}

/** C4 · Commande reçue (en attente de confirmation), puis C5 · Suivi en préparation. */
export function SuiviCommande({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton: brut } = use(params);
  const jeton = decodeURIComponent(brut);
  const [locale, setLocale] = useState<CommandeLocale | null>(null);
  const [suivi, setSuivi] = useState<SuiviApi | null>(null);
  const [historique, setHistorique] = useState<EvenementCommande[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage du navigateur
    setLocale(lireCommandeLocale(jeton) ?? null);
    const ctrl = new AbortController();
    const charger = async () => {
      try {
        const s = await suivreCommande(jeton, ctrl.signal);
        setSuivi(s);
        setErreur(null);
        const statut = statutFront(s.status);
        // Historique reconstruit au fil des changements observés sur cet appareil.
        setHistorique((h) => {
          const libelle = STATUTS_COMMANDE[statut].libelle;
          if (h[0]?.statut === libelle) return h;
          const base = h.length
            ? h
            : [{ heure: heureDe(s.created_at), statut: "Reçue", detail: "Commande passée depuis le menu", couleur: COULEUR_HISTORIQUE.recue }];
          if (statut === "recue") return base;
          const couleurs: Partial<Record<StatutCommande, string>> = COULEUR_HISTORIQUE;
          return [{ heure: heureDe(new Date().toISOString()), statut: libelle, detail: "Mise à jour", couleur: couleurs[statut] ?? "#B3261E" }, ...base];
        });
        if (TERMINAUX.includes(statut)) clearInterval(iv);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof ApiError && e.status === 404) {
          setIntrouvable(true);
          clearInterval(iv);
        } else setErreur(messageErreur(e));
      }
    };
    // `iv` n'est lu qu'après un `await` : il est déjà initialisé.
    const iv = setInterval(() => void charger(), ACTUALISATION_MS);
    void charger();
    return () => {
      ctrl.abort();
      clearInterval(iv);
    };
  }, [jeton]);

  if (introuvable) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-[15px] text-texte-2">Ce lien de suivi n&apos;est pas valide.</p>
        <Link href="/menu" className="flex h-12 items-center rounded-xl bg-terracotta px-5 font-bold text-creme">
          Voir la carte
        </Link>
      </div>
    );
  }

  if (!suivi) {
    return <div className="flex flex-1 items-center justify-center px-8 text-center text-texte-3">{erreur ?? "Chargement…"}</div>;
  }

  const statut = statutFront(suivi.status);
  const numero = suivi.number;
  const mode = locale ? MODES_SERVICE[locale.mode] : null;
  const lieu = !locale || !mode ? "" : locale.mode === "emporter" ? "à emporter" : mode.court(locale.emplacement).toLowerCase();

  const recap = (
    <div className="tabular flex flex-col gap-2.5 rounded-2xl border border-ligne bg-papier p-3.5 text-[15px]">
      {locale
        ? locale.lignes.map((l) => (
            <div key={l.platId} className="flex justify-between gap-3">
              <span>
                {l.quantite} × {l.nom}
              </span>
              <span className="shrink-0">{formatFCFA(l.quantite * l.prixUnitaire)}</span>
            </div>
          ))
        : suivi.items.map((l, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span>
                {l.quantity} × {l.name}
              </span>
            </div>
          ))}
      {locale ? (
        <>
          <div className="h-px bg-ligne" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatFCFA(locale.total)}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-texte-3">
            <Icon name={MODES_PAIEMENT[locale.paiement].icone} className="size-4" />
            Paiement au service : {MODES_PAIEMENT[locale.paiement].libelle.toLowerCase()}
          </div>
        </>
      ) : null}
    </div>
  );

  const bandeauErreur = erreur ? (
    <div role="status" className="rounded-xl bg-attention-fond px-3.5 py-2.5 text-[13px] font-bold text-attention">
      Connexion instable : nouvelle tentative en cours.
    </div>
  ) : null;

  /* ---------- Annulée ou refusée */
  if (statut === "annulee" || statut === "refusee") {
    return (
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-8 pb-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-danger-fond text-danger">
            <Icon name="x" className="size-6" />
          </span>
          <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">
            Commande {statut === "annulee" ? "annulée" : "refusée"}
          </h1>
          <span className="text-sm text-texte-3">N° {numero} · rien ne vous sera facturé</span>
        </div>
        {recap}
        <Link href="/menu" className="flex h-14 items-center justify-center rounded-xl bg-terracotta font-bold text-creme">
          Retour à la carte
        </Link>
      </div>
    );
  }

  /* ---------- C4 · Reçue, en attente de confirmation */
  if (statut === "recue") {
    return (
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-6 pb-8">
        <div className="flex flex-col items-center gap-2 pt-1.5 text-center">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-neutre-fond">
            <Icon name="check" className="size-6" />
          </span>
          <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">Commande reçue</h1>
          <span className="text-sm text-texte-3">
            N° {numero}
            {lieu ? ` · ${lieu}` : ""}
          </span>
        </div>
        <Etapes statut="recue" />
        {bandeauErreur}
        <div className="flex flex-col gap-3 rounded-[20px] bg-vert p-5 text-creme">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[.14em] text-or">EN ATTENTE</span>
            <Badge apparence={STATUTS_COMMANDE.recue} />
          </div>
          <p className="m-0 text-lg leading-6 font-bold">Un membre du personnel va confirmer votre commande.</p>
          <p className="m-0 text-sm leading-5 text-[#E4E9E5]">
            Elle sera ensuite transmise à la cuisine. Cette page se met à jour toute seule. Pour annuler, adressez-vous au personnel.
          </p>
        </div>
        {recap}
      </div>
    );
  }

  /* ---------- C5 · Confirmée, en préparation, prête, servie */
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <h1 className="m-0 font-serif text-2xl font-semibold text-vert">Ma commande</h1>
        <Badge apparence={STATUTS_COMMANDE[statut]} taille="md" />
      </header>
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-2 pb-8">
        {bandeauErreur}
        <div className="overflow-hidden rounded-[20px] bg-vert text-creme">
          <div className="grid grid-cols-[1fr_auto] items-end gap-4 p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[.14em] text-or">PASSÉE À {heureDe(suivi.created_at).toUpperCase()}</span>
              <span className="font-serif text-[30px] leading-tight font-semibold">{STATUTS_COMMANDE[statut].libelle}</span>
              <span className="text-sm opacity-85">{message(statut, locale?.mode)}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-xs font-bold text-or">N°</span>
              <span className="tabular text-xl font-bold">{numero}</span>
            </div>
          </div>
          {locale && mode ? (
            <div className="grid grid-cols-3 gap-2 border-t border-dashed border-or/60 px-5 py-3.5 text-xs">
              <div className="flex flex-col gap-[3px]">
                <span className="font-bold text-or">MODE</span>
                <span className="text-sm font-bold">{mode.libelle}</span>
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="font-bold text-or">{locale.mode === "table" ? "TABLE" : locale.mode === "chambre" ? "CHAMBRE" : "RETRAIT"}</span>
                <span className="text-sm font-bold">{locale.mode === "emporter" ? "Comptoir" : locale.emplacement}</span>
              </div>
              <div className="flex flex-col gap-[3px]">
                <span className="font-bold text-or">PAIEMENT</span>
                <span className="text-sm font-bold">{MODES_PAIEMENT[locale.paiement].libelle}</span>
              </div>
            </div>
          ) : null}
        </div>
        <Etapes statut={statut} />
        <div className="flex flex-col gap-3.5 rounded-2xl border border-ligne bg-papier p-4">
          <span className="text-[15px] font-bold">Historique</span>
          <Historique evenements={historique} />
        </div>
        {recap}
        <Encadre icone="info">Pour toute modification, adressez-vous au personnel.</Encadre>
      </div>
    </div>
  );
}
