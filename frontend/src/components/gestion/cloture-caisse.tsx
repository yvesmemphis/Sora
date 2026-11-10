"use client";

import { useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Bouton, Carte, cx } from "@/components/ui/primitives";
import { CAISSE } from "@/lib/demo/gestion";
import { formatEcart, formatFCFA, formatNombre, lireMontant } from "@/lib/format";

function BlocCaisse({
  libelle,
  detail,
  icone,
  theorique,
  libelleSaisie,
  saisie,
  onSaisie,
  verrouille,
}: {
  libelle: string;
  detail: string;
  icone: NomIcone;
  theorique: number;
  libelleSaisie: string;
  saisie: string;
  onSaisie: (v: string) => void;
  verrouille: boolean;
}) {
  const ecart = lireMontant(saisie) - theorique;
  const conforme = ecart === 0;
  const id = `saisie-${libelle}`;
  return (
    <Carte className="flex flex-col gap-4 p-[22px]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-servi-fond text-vert">
          <Icon name={icone} className="size-[22px]" />
        </span>
        <div className="flex flex-col">
          <span className="text-lg font-bold">{libelle}</span>
          <span className="text-[13px] text-texte-3">{detail}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-texte-2">Total enregistré</span>
          <span className="tabular font-serif text-[30px] font-semibold text-vert">{formatNombre(theorique)}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-[13px] text-texte-2">
            {libelleSaisie}
          </label>
          <input
            id={id}
            inputMode="numeric"
            value={saisie}
            disabled={verrouille}
            onChange={(e) => onSaisie(e.target.value)}
            className="tabular h-[52px] w-full rounded-xl border-[1.5px] border-vert bg-papier px-3.5 text-xl font-bold outline-none disabled:opacity-60"
          />
        </div>
      </div>
      <div className={cx("flex items-center justify-between rounded-xl px-3.5 py-3", conforme ? "bg-ok-fond text-ok" : "bg-attention-fond-2 text-attention")}>
        <span className="flex items-center gap-2 text-sm font-bold">
          <Icon name={conforme ? "check" : "alert"} className="size-[18px]" />
          {conforme ? "Caisse conforme" : "Écart à justifier"}
        </span>
        <span className="tabular text-base font-bold">{formatEcart(ecart)}</span>
      </div>
    </Carte>
  );
}

/** G6 · Clôture de caisse journalière. */
export function ClotureCaisse() {
  const [especes, setEspeces] = useState("410 000");
  const [carte, setCarte] = useState("832 500");
  const [nonPayees, setNonPayees] = useState(CAISSE.nonPayees);
  const [cloturee, setCloturee] = useState(false);
  const total = CAISSE.especes.total + CAISSE.carte.total;
  const ecartTotal = lireMontant(especes) + lireMontant(carte) - total;

  return (
    <>
      <EntetePage
        titre="Clôture de caisse"
        sousTitre={`${CAISSE.date} · ${CAISSE.commandesPayees} commandes payées · ventes validées uniquement`}
        actions={
          cloturee ? (
            <Badge apparence={{ libelle: "Journée clôturée", icone: "lock", classes: "text-ok bg-ok-fond" }} taille="md" />
          ) : (
            <Badge apparence={{ libelle: "Journée ouverte", icone: "clock", classes: "text-attention bg-attention-fond" }} taille="md" />
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BlocCaisse
          libelle="Espèces"
          detail={`${CAISSE.especes.commandes} commandes payées`}
          icone="cash"
          theorique={CAISSE.especes.total}
          libelleSaisie="Montant compté en caisse"
          saisie={especes}
          onSaisie={setEspeces}
          verrouille={cloturee}
        />
        <BlocCaisse
          libelle="Carte"
          detail={`${CAISSE.carte.commandes} commandes payées`}
          icone="card"
          theorique={CAISSE.carte.total}
          libelleSaisie="Total du terminal"
          saisie={carte}
          onSaisie={setCarte}
          verrouille={cloturee}
        />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Carte className="flex flex-col gap-3 p-5">
          {nonPayees.length ? (
            <>
              <div className="flex items-center gap-2.5">
                <Icon name="alert" className="size-5 text-attention" />
                <h2 className="m-0 text-[15px] font-bold">
                  {nonPayees.length} commande{nonPayees.length > 1 ? "s" : ""} servie{nonPayees.length > 1 ? "s" : ""} non marquée
                  {nonPayees.length > 1 ? "s" : ""} payée{nonPayees.length > 1 ? "s" : ""}
                </h2>
              </div>
              <span className="text-[13px] text-texte-2">
                Elles ne sont pas incluses dans les totaux. Vérifiez avec la salle avant de clôturer.
              </span>
              {nonPayees.map((u) => (
                <div
                  key={u.numero}
                  className="tabular grid grid-cols-[90px_1fr] items-center gap-3 border-t border-ligne-3 py-3 text-sm sm:grid-cols-[90px_1fr_120px_150px]"
                >
                  <span className="font-bold">N° {u.numero}</span>
                  <span className="text-texte-2">{u.detail}</span>
                  <span className="font-bold sm:text-right">{formatFCFA(u.total)}</span>
                  <Bouton
                    variante="fantome"
                    hauteur="sm"
                    className="border-[1.5px] border-vert"
                    disabled={cloturee}
                    onClick={() => setNonPayees((p) => p.filter((x) => x.numero !== u.numero))}
                  >
                    Marquer payée
                  </Bouton>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-[15px] font-bold text-ok">
              <Icon name="check" className="size-5" />
              Toutes les commandes servies sont payées.
            </div>
          )}
        </Carte>
        <div className="flex flex-col gap-3.5 rounded-2xl bg-vert p-[22px] text-creme">
          <span className="text-[13px] font-bold tracking-[.12em] text-or">TOTAL DE LA JOURNÉE</span>
          <span className="tabular font-serif text-[38px] font-semibold">{formatFCFA(total)}</span>
          <div className="tabular flex flex-col gap-2 text-sm text-[#D9E0DB]">
            <div className="flex justify-between">
              <span>Espèces</span>
              <span>{formatNombre(CAISSE.especes.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Carte</span>
              <span>{formatNombre(CAISSE.carte.total)}</span>
            </div>
            <div className={cx("flex justify-between font-bold", ecartTotal === 0 ? "text-en-ligne" : "text-[#E7C77F]")}>
              <span>Écart total</span>
              <span>{formatEcart(ecartTotal)}</span>
            </div>
          </div>
          <Bouton
            variante="creme"
            hauteur="lg"
            icone="lock"
            className="mt-auto h-[52px]"
            disabled={cloturee}
            onClick={() => setCloturee(true)}
          >
            {cloturee ? "Journée clôturée" : "Clôturer la journée"}
          </Bouton>
          {!cloturee && ecartTotal !== 0 ? (
            <span className="text-xs text-[#D9E0DB]">L&apos;écart sera enregistré avec la clôture et visible dans le journal.</span>
          ) : null}
        </div>
      </div>
    </>
  );
}
