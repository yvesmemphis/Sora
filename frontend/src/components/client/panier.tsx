"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Encadre, Quantite, cx } from "@/components/ui/primitives";
import { usePanier } from "@/lib/client/panier";
import { formatFCFA } from "@/lib/format";
import { MODES_PAIEMENT, MODES_SERVICE } from "@/lib/statuts";
import type { ModePaiement, ModeService } from "@/lib/types";

const classeChoix = (actif: boolean) =>
  actif ? "border-2 border-vert bg-vert text-creme" : "border border-bordure bg-papier text-vert";

/** C3 · Panier, mode de service et paiement. */
export function Panier() {
  const router = useRouter();
  const { lignes, total, nombreArticles, modifierQuantite, passerCommande, pret } = usePanier();
  const [mode, setMode] = useState<ModeService>("table");
  const [emplacement, setEmplacement] = useState("");
  const [paiement, setPaiement] = useState<ModePaiement>("especes");
  const [erreur, setErreur] = useState<string | null>(null);

  const modeInfo = MODES_SERVICE[mode];
  const emplacementRequis = mode !== "emporter";

  function commander() {
    if (emplacementRequis && !emplacement.trim()) {
      setErreur(`Indiquez le ${modeInfo.champ.toLowerCase()}.`);
      return;
    }
    const commande = passerCommande({
      mode,
      emplacement: emplacementRequis ? emplacement.trim() : "Au comptoir",
      paiement,
    });
    router.push(`/suivi/${commande.numero}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 px-5 pt-5 pb-2">
        <Link
          href="/menu"
          aria-label="Retour à la carte"
          className="flex size-11 items-center justify-center rounded-full border border-ligne-2 bg-papier text-vert"
        >
          <Icon name="left" className="size-5" />
        </Link>
        <h1 className="m-0 font-serif text-2xl font-semibold text-vert">Mon panier</h1>
      </header>

      {pret && lignes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-sable text-vert">
            <Icon name="bag" className="size-7" />
          </span>
          <p className="text-[15px] text-texte-2">Votre panier est vide.</p>
          <Link href="/menu" className="flex h-12 items-center rounded-xl bg-terracotta px-5 font-bold text-creme">
            Voir la carte
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-[18px] px-5 pt-2 pb-6">
            <ul className="rounded-2xl border border-ligne bg-papier px-3.5 py-1">
              {lignes.map((l, i) => (
                <li
                  key={l.platId}
                  className={cx("flex items-center gap-3 py-2.5", i < lignes.length - 1 && "border-b border-ligne-3")}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{l.plat.nom}</span>
                    <span className="tabular text-[13px] text-texte-3">
                      {formatFCFA(l.plat.prix)}
                      {l.note ? ` · ${l.note.toLowerCase()}` : ""}
                    </span>
                  </div>
                  <Quantite valeur={l.quantite} onChange={(q) => modifierQuantite(l.platId, q)} taille="sm" />
                </li>
              ))}
            </ul>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[15px] font-bold">Où souhaitez-vous être servi ?</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(MODES_SERVICE) as ModeService[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === mode}
                    onClick={() => {
                      setMode(m);
                      setErreur(null);
                    }}
                    className={cx(
                      "flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl text-sm font-bold",
                      classeChoix(m === mode),
                    )}
                  >
                    <Icon name={MODES_SERVICE[m].icone} className="size-[22px]" />
                    {MODES_SERVICE[m].libelle}
                  </button>
                ))}
              </div>
              {emplacementRequis ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-texte-2">{modeInfo.champ}</span>
                  <input
                    inputMode="numeric"
                    value={emplacement}
                    onChange={(e) => {
                      setEmplacement(e.target.value.replace(/[^\dA-Za-z-]/g, "").slice(0, 6));
                      setErreur(null);
                    }}
                    placeholder={mode === "table" ? "Ex. 6" : "Ex. 204"}
                    aria-invalid={!!erreur}
                    className={cx(
                      "tabular h-[52px] rounded-xl border-[1.5px] bg-papier px-3.5 text-[17px] font-bold outline-none",
                      erreur ? "border-danger" : "border-vert",
                    )}
                  />
                  {erreur ? <span className="text-[13px] font-medium text-danger">{erreur}</span> : null}
                  {mode === "chambre" ? (
                    <span className="text-xs text-texte-3">Un membre du personnel confirmera le numéro de chambre.</span>
                  ) : null}
                </label>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-texte-2">Retrait</span>
                  <div className="flex h-[52px] items-center rounded-xl border-[1.5px] border-vert bg-papier px-3.5 text-[17px] font-bold">
                    Au comptoir de la réception
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[15px] font-bold">Paiement au service</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MODES_PAIEMENT) as ModePaiement[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={p === paiement}
                    onClick={() => setPaiement(p)}
                    className={cx(
                      "flex h-[52px] cursor-pointer items-center gap-2.5 rounded-xl px-3.5 text-[15px] font-bold",
                      classeChoix(p === paiement),
                    )}
                  >
                    <Icon name={MODES_PAIEMENT[p].icone} className="size-[22px]" />
                    {MODES_PAIEMENT[p].libelle}
                  </button>
                ))}
              </div>
            </fieldset>

            <Encadre icone="clock">
              Vous pourrez annuler pendant 5 minutes après avoir commandé. Rien n&apos;est débité en ligne.
            </Encadre>
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-ligne-2 bg-creme px-5 pt-3.5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="flex justify-between text-[15px]">
              <span className="text-texte-2">
                Total · {nombreArticles} article{nombreArticles > 1 ? "s" : ""}
              </span>
              <span className="tabular font-bold">{formatFCFA(total)}</span>
            </div>
            <button
              type="button"
              onClick={commander}
              disabled={!pret || lignes.length === 0}
              className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-terracotta text-base font-bold text-creme disabled:opacity-50"
            >
              Commander · {formatFCFA(total)}
              <Icon name="arrow" className="size-[18px]" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
