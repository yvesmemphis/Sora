"use client";

import { useEffect, useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Bouton, Carte, Interrupteur, classeChamp, cx } from "@/components/ui/primitives";
import { lireReglages, modifierReglages, type ReglagesApi } from "@/lib/api/admin";
import { messageErreur } from "@/lib/api/client";

const BOOLEENS: { cle: "public_ordering_enabled" | "auto_confirm_orders"; nom: string; detail: string }[] = [
  {
    cle: "public_ordering_enabled",
    nom: "Commandes depuis le menu QR",
    detail: "Désactivé : la carte reste consultable, mais les clients ne peuvent plus commander.",
  },
  {
    cle: "auto_confirm_orders",
    nom: "Confirmation automatique",
    detail: "Les commandes sur place et à emporter partent directement en cuisine. Les commandes en chambre restent confirmées par un employé.",
  },
];

/** A2 (suite) · Paramètres du service (`/settings/`). */
export function Parametres() {
  const [valeurs, setValeurs] = useState<ReglagesApi | null>(null);
  const [etat, setEtat] = useState<"propre" | "modifie" | "envoi" | "enregistre">("propre");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    lireReglages()
      .then(setValeurs)
      .catch((e: unknown) => setErreur(messageErreur(e)));
  }, []);

  function changer<K extends keyof ReglagesApi>(cle: K, v: ReglagesApi[K]) {
    setValeurs((prev) => (prev ? { ...prev, [cle]: v } : prev));
    setEtat("modifie");
  }

  async function enregistrer() {
    if (!valeurs) return;
    setEtat("envoi");
    try {
      setValeurs(await modifierReglages(valeurs));
      setErreur(null);
      setEtat("enregistre");
    } catch (e) {
      setErreur(messageErreur(e));
      setEtat("modifie");
    }
  }

  return (
    <>
      <EntetePage titre="Paramètres du service" sousTitre="S'appliquent à tous les écrans dès l'enregistrement." />
      {erreur ? (
        <div role="alert" className="max-w-[880px] rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <Carte className="flex max-w-[880px] flex-col gap-1.5 p-5">
        {!valeurs ? (
          <p className="py-4 text-sm text-texte-3">{erreur ? "Paramètres indisponibles." : "Chargement…"}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div className="flex max-w-[560px] flex-col gap-0.5">
                <label htmlFor="param-nom" className="text-sm font-bold">
                  Nom du restaurant
                </label>
                <span className="text-xs leading-[17px] text-texte-3">Affiché en haut de la carte client.</span>
              </div>
              <input
                id="param-nom"
                value={valeurs.name}
                maxLength={180}
                onChange={(e) => changer("name", e.target.value)}
                className={cx(classeChamp, "h-10 min-w-[240px]")}
              />
            </div>
            {BOOLEENS.map((p) => (
              <div key={p.cle} className="flex flex-wrap items-center justify-between gap-4 border-t border-ligne-3 py-3.5">
                <div className="flex max-w-[560px] flex-col gap-0.5">
                  <span className="text-sm font-bold">{p.nom}</span>
                  <span className="text-xs leading-[17px] text-texte-3">{p.detail}</span>
                </div>
                <Interrupteur actif={valeurs[p.cle]} onChange={(v) => changer(p.cle, v)} libelle={p.nom} />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ligne-3 py-3.5">
              <div className="flex max-w-[560px] flex-col gap-0.5">
                <label htmlFor="param-desistement" className="text-sm font-bold">
                  Délai de désistement
                </label>
                <span className="text-xs leading-[17px] text-texte-3">
                  Temps pendant lequel le client peut annuler sa commande QR depuis l&apos;écran de suivi.
                </span>
              </div>
              <select
                id="param-desistement"
                value={valeurs.withdrawal_delay_minutes}
                onChange={(e) => changer("withdrawal_delay_minutes", Number(e.target.value))}
                className="h-10 min-w-[140px] cursor-pointer rounded-[10px] border border-bordure-2 bg-papier px-3 text-center text-sm font-bold outline-none"
              >
                {[...new Set([0, 3, 5, 10, 15, valeurs.withdrawal_delay_minutes])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "Aucun" : `${m} min`}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ligne-3 py-3.5">
              <div className="flex max-w-[560px] flex-col gap-0.5">
                <label htmlFor="param-peremption" className="text-sm font-bold">
                  Alerte de péremption
                </label>
                <span className="text-xs leading-[17px] text-texte-3">Nombre de jours avant la date limite d&apos;un lot.</span>
              </div>
              <select
                id="param-peremption"
                value={valeurs.expiry_alert_days}
                onChange={(e) => changer("expiry_alert_days", Number(e.target.value))}
                className="h-10 min-w-[140px] cursor-pointer rounded-[10px] border border-bordure-2 bg-papier px-3 text-center text-sm font-bold outline-none"
              >
                {[1, 2, 3, 5, 7, 14].map((j) => (
                  <option key={j} value={j}>
                    {j} jour{j > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="mt-3 flex items-center gap-4">
          <Bouton hauteur="lg" disabled={etat !== "modifie"} onClick={enregistrer}>
            {etat === "envoi" ? "Enregistrement…" : "Enregistrer les paramètres"}
          </Bouton>
          {etat === "enregistre" ? (
            <span className="flex items-center gap-1.5 text-sm font-bold text-ok">
              <Icon name="check" className="size-4" />
              Paramètres enregistrés
            </span>
          ) : null}
        </div>
      </Carte>
    </>
  );
}
