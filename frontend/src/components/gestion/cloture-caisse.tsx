"use client";

import { useCallback, useEffect, useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Badge, Bouton, Carte, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import {
  commandeDepuisApi,
  enregistrerPaiement,
  listerCommandes,
  modePaiementDe,
  rapportPaiements,
} from "@/lib/api/commandes";
import { montant } from "@/lib/api/conversions";
import { dateIso } from "@/lib/api/gestion";
import { formatEcart, formatFCFA, formatNombre, lireMontant } from "@/lib/format";
import { MODES_SERVICE } from "@/lib/statuts";

interface Totaux {
  especes: { total: number; commandes: number };
  carte: { total: number; commandes: number };
  commandesPayees: number;
}


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
  const [especes, setEspeces] = useState("");
  const [carte, setCarte] = useState("");
  const [CAISSE, setCaisse] = useState<Totaux>({ especes: { total: 0, commandes: 0 }, carte: { total: 0, commandes: 0 }, commandesPayees: 0 });
  const [nonPayees, setNonPayees] = useState<{ id: number; numero: string; detail: string; total: number }[]>([]);
  const [cloturee, setCloturee] = useState(false);
  const [etat, setEtat] = useState<string | null>("Chargement…");

  /**
   * Totaux par mode : `GET /payments/?date=` ; commandes servies non soldées : `GET /orders/?date=`.
   */
  const charger = useCallback(async () => {
    try {
      const jour = dateIso(new Date());
      const [rapport, liste] = await Promise.all([rapportPaiements(jour), listerCommandes({ date: jour })]);
      const t: Totaux = { especes: { total: 0, commandes: 0 }, carte: { total: 0, commandes: 0 }, commandesPayees: 0 };
      for (const ligne of rapport.totals) {
        const bloc = modePaiementDe(ligne.payment_method) === "carte" ? t.carte : t.especes;
        bloc.total += montant(ligne.net_collected);
      }
      const confirmes = rapport.payments.filter((x) => x.status === "CONFIRMED" || x.status === "REFUNDED");
      for (const x of confirmes) (modePaiementDe(x.payment_method) === "carte" ? t.carte : t.especes).commandes += 1;
      t.commandesPayees = new Set(confirmes.map((x) => x.order)).size;
      setCaisse(t);
      setNonPayees(
        liste
          .filter((c) => c.status === "SERVED" && !c.is_paid)
          .map((c) => {
            const cmd = commandeDepuisApi(c);
            return {
              id: c.id,
              numero: cmd.numero,
              detail: `${MODES_SERVICE[cmd.mode].court(cmd.emplacement)} · passée ${cmd.passeeA}`,
              total: Math.max(0, (cmd.total ?? 0) - montant(c.amount_paid)),
            };
          }),
      );
      setEtat(null);
    } catch (e) {
      setEtat(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    void charger();
  }, [charger]);

  async function marquerPayee(id: number, totalCmd: number) {
    try {
      await enregistrerPaiement(id, totalCmd, "especes");
      await charger();
    } catch (e) {
      setEtat(messageErreur(e));
    }
  }

  const total = CAISSE.especes.total + CAISSE.carte.total;
  const ecartTotal = lireMontant(especes) + lireMontant(carte) - total;

  return (
    <>
      <EntetePage
        titre="Clôture de caisse"
        sousTitre={`${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ${CAISSE.commandesPayees} commandes payées · ventes validées uniquement`}
        actions={
          cloturee ? (
            <Badge apparence={{ libelle: "Journée clôturée", icone: "lock", classes: "text-ok bg-ok-fond" }} taille="md" />
          ) : (
            <Badge apparence={{ libelle: "Journée ouverte", icone: "clock", classes: "text-attention bg-attention-fond" }} taille="md" />
          )
        }
      />
      {etat ? (
        <div role="status" className={cx("rounded-xl px-4 py-3 text-sm font-bold", etat === "Chargement…" ? "bg-sable text-texte-2" : "bg-danger-fond text-danger")}>
          {etat}
        </div>
      ) : null}
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
                    onClick={() => void marquerPayee(u.id, u.total)}
                  >
                    Marquer payée (espèces)
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
          <span className="text-xs text-[#D9E0DB]">
            La clôture n&apos;est pas encore enregistrée côté serveur (aucune API de clôture de caisse).
          </span>
        </div>
      </div>
    </>
  );
}
