"use client";

import { useEffect, useMemo, useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Bouton, Carte, Puce, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { montant } from "@/lib/api/conversions";
import { deciderPrevision, listerInvendus, listerPrevisions, type InvenduApi, type PrevisionApi } from "@/lib/api/gestion";

type StatutReco = "a_valider" | "validee" | "ignoree";

const STATUT_RECO: Record<PrevisionApi["status"], StatutReco> = { DRAFT: "a_valider", APPROVED: "validee", REJECTED: "ignoree" };

const TYPE = { libelle: "PRÉVISION DE PRODUCTION", icone: "trend" as NomIcone, ton: "bg-servi-fond text-vert", texte: "text-vert" };

const COULEURS_MOTIFS = ["#A3481F", "#1F3D36", "#7A5200", "#5C574E", "#8C857A", "#2F6B3A"];

function periodeLisible(p: PrevisionApi): string {
  const f = (d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return p.period_start === p.period_end ? f(p.period_start) : `du ${f(p.period_start)} au ${f(p.period_end)}`;
}

function explication(e: Record<string, unknown>): string {
  const morceaux: string[] = [];
  const histo = e.history ?? e.historique;
  if (Array.isArray(histo)) morceaux.push(`${histo.length} jours d'historique`);
  for (const [cle, v] of Object.entries(e)) {
    if (cle === "history" || cle === "historique" || typeof v === "object") continue;
    morceaux.push(`${cle.replace(/_/g, " ")} : ${String(v)}`);
  }
  return morceaux.slice(0, 4).join(" · ");
}

const niveau = (c: number) => (c >= 70 ? "Bonne" : c >= 55 ? "Moyenne" : "Faible");

/** G5 · Prévisions et recommandations IA, toujours soumises à validation. */
export function Previsions() {
  const [previsions, setPrevisions] = useState<PrevisionApi[]>([]);
  const [invendus, setInvendus] = useState<InvenduApi[]>([]);
  const [onglet, setOnglet] = useState<StatutReco>("a_valider");
  const [etat, setEtat] = useState<string | null>("Chargement…");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerPrevisions()
      .then((p) => {
        setPrevisions(p);
        setEtat(null);
      })
      .catch((e: unknown) => setEtat(messageErreur(e)));
    listerInvendus()
      .then(setInvendus)
      .catch(() => undefined);
  }, []);

  const recos = previsions.map((p) => ({ ...p, statut: STATUT_RECO[p.status], confiance: Math.round(montant(p.confidence) * 100) }));
  const comptes = { a_valider: 0, validee: 0, ignoree: 0 };
  recos.forEach((r) => (comptes[r.statut] += 1));
  const visibles = recos.filter((r) => r.statut === onglet);

  async function changer(id: number, decision: "approve" | "reject") {
    try {
      const maj = await deciderPrevision(id, decision, decision === "reject" ? "Ignorée par le gestionnaire" : "");
      setPrevisions((prev) => prev.map((x) => (x.id === maj.id ? maj : x)));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  // Motifs de pertes : quantités jetées par motif, sur 4 semaines.
  const motifsPertes = useMemo(() => {
    const depuis = new Date().getTime() - 28 * 86_400_000;
    const parMotif = new Map<string, number>();
    for (const w of invendus) {
      if (new Date(w.declared_at).getTime() < depuis) continue;
      parMotif.set(w.reason, (parMotif.get(w.reason) ?? 0) + montant(w.remaining_quantity));
    }
    const total = [...parMotif.values()].reduce((s, v) => s + v, 0);
    return [...parMotif.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([motif, q], i) => ({ motif, part: total ? Math.round((q / total) * 100) : 0, couleur: COULEURS_MOTIFS[i] }));
  }, [invendus]);
  const maxPerte = Math.max(1, ...motifsPertes.map((m) => m.part));

  return (
    <>
      <EntetePage
        titre="Prévisions et recommandations"
        sousTitre="Générées côté serveur (commande « generate_forecasts »), toujours soumises à validation."
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Puce taille="sm" actif={onglet === "a_valider"} onClick={() => setOnglet("a_valider")}>
              À valider · {comptes.a_valider}
            </Puce>
            <Puce taille="sm" actif={onglet === "validee"} onClick={() => setOnglet("validee")}>
              Validées · {comptes.validee}
            </Puce>
            <Puce taille="sm" actif={onglet === "ignoree"} onClick={() => setOnglet("ignoree")}>
              Ignorées · {comptes.ignoree}
            </Puce>
          </div>
          {visibles.map((r) => {
            const t = TYPE;
            return (
              <Carte key={r.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-4 px-5 py-[18px] md:grid-cols-[44px_minmax(0,1fr)_210px]">
                <span className={cx("flex size-11 items-center justify-center rounded-xl", t.ton)}>
                  <Icon name={t.icone} className="size-[22px]" />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx("text-xs font-bold tracking-[.1em]", t.texte)}>{t.libelle}</span>
                    <span className="rounded-full border border-[#C9BFAE] px-2 py-0.5 text-[11px] font-bold text-texte-3">v{r.version}</span>
                  </div>
                  <span className="text-[17px] leading-[23px] font-bold">
                    {periodeLisible(r)} : préparer {Math.round(montant(r.predicted_quantity))} portions de {r.menu_item_name.toLowerCase()}.
                  </span>
                  <span className="text-[13px] leading-[19px] text-texte-2">
                    {explication(r.explanation)}
                    {r.rejection_reason ? ` · Motif : ${r.rejection_reason}` : ""}
                  </span>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="w-[72px] text-xs text-texte-3">Confiance</span>
                    <div className="h-1.5 max-w-[200px] flex-1 rounded-[3px] bg-ligne-3">
                      <div className="h-1.5 rounded-[3px] bg-vert" style={{ width: `${r.confiance}%` }} />
                    </div>
                    <span className="text-xs font-bold">{niveau(r.confiance)}</span>
                  </div>
                </div>
                {r.statut === "a_valider" ? (
                  <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
                    <Bouton icone="check" onClick={() => void changer(r.id, "approve")}>
                      Valider
                    </Bouton>
                    <Bouton variante="fantome" hauteur="sm" className="border-bordure-2 text-texte-2" onClick={() => void changer(r.id, "reject")}>
                      Ignorer
                    </Bouton>
                  </div>
                ) : (
                  <div className="col-span-2 flex flex-col items-start gap-2 md:col-span-1 md:items-end">
                    <span className={cx("flex items-center gap-1.5 text-sm font-bold", r.statut === "validee" ? "text-ok" : "text-texte-3")}>
                      <Icon name={r.statut === "validee" ? "check" : "x"} className="size-4" />
                      {r.statut === "validee" ? "Validée" : "Ignorée"}
                    </span>
                  </div>
                )}
              </Carte>
            );
          })}
          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-bordure p-6 text-center text-sm text-texte-3">
              {etat ?? (onglet === "a_valider" ? "Aucune prévision à valider." : "Aucune prévision dans cet onglet.")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3.5">
          <Carte className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-bold">Motifs de pertes · 4 semaines</h2>
              <span className="text-xs text-texte-3">déclarés</span>
            </div>
            {motifsPertes.length === 0 ? <span className="text-[13px] text-texte-3">Aucun invendu déclaré.</span> : null}
            {motifsPertes.map((m) => (
              <div key={m.motif} className="grid grid-cols-[130px_1fr_40px] items-center gap-2.5 text-[13px]">
                <span>{m.motif}</span>
                <div className="h-2.5 rounded-[5px] bg-ligne-3">
                  <div className="h-2.5 rounded-[5px]" style={{ width: `${(m.part / maxPerte) * 100}%`, background: m.couleur }} />
                </div>
                <span className="tabular text-right font-bold">{m.part} %</span>
              </div>
            ))}
          </Carte>
          <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-vert p-5 text-creme">
            <span className="flex items-center gap-2 text-[13px] font-bold text-or">
              <Icon name="spark" className="size-[18px]" />
              RAPPORT DE LA SEMAINE
              <span className="rounded-md bg-creme/15 px-2 py-0.5 text-[11px] text-creme">Exemple · pas encore d&apos;API</span>
            </span>
            <span className="font-serif text-xl leading-[26px] font-semibold">
              Le samedi soir concentre 21 % des ventes ; le mardi midi reste le service le plus faible.
            </span>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] leading-[19px] text-[#D9E0DB]">
              <li>· Écart de prévision moyen : 8 % sur les 6 plats principaux.</li>
              <li>
                · Les invendus de poisson braisé suivent les jours de forte chaleur.{" "}
                <span className="font-bold text-[#E7C77F]">Hypothèse</span> : cause non observable, à confirmer par l&apos;équipe.
              </li>
              <li>· Crème fraîche : 3 lots jetés pour péremption en octobre.</li>
            </ul>
            <button
              type="button"
              className="mt-auto flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-creme/40 text-sm font-bold hover:bg-creme/10"
            >
              <Icon name="note" className="size-4" />
              Ajouter un commentaire
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
