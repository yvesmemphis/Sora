"use client";

import { useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Bouton, Carte, Puce, cx } from "@/components/ui/primitives";
import { MOTIFS_PERTES, RECOMMANDATIONS, type StatutReco } from "@/lib/demo/gestion";

const TYPES: Record<(typeof RECOMMANDATIONS)[number]["type"], { libelle: string; icone: NomIcone; ton: string; texte: string }> = {
  augmenter: { libelle: "AUGMENTER LA PRODUCTION", icone: "trend", ton: "bg-servi-fond text-vert", texte: "text-vert" },
  reduire: { libelle: "RÉDUIRE LA PRODUCTION", icone: "flame", ton: "bg-terracotta-fond text-terracotta", texte: "text-terracotta" },
  approvisionner: { libelle: "APPROVISIONNEMENT", icone: "box", ton: "bg-attention-fond-2 text-attention", texte: "text-attention" },
};

const niveau = (c: number) => (c >= 70 ? "Bonne" : c >= 55 ? "Moyenne" : "Faible");

/** G5 · Prévisions et recommandations IA, toujours soumises à validation. */
export function Previsions() {
  const [recos, setRecos] = useState(RECOMMANDATIONS);
  const [onglet, setOnglet] = useState<StatutReco>("a_valider");
  const [ajustement, setAjustement] = useState<string | null>(null);
  const comptes = { a_valider: 0, validee: 12, ignoree: 4 };
  recos.forEach((r) => {
    if (r.statut === "a_valider") comptes.a_valider += 1;
    else comptes[r.statut] += 1;
  });
  const changer = (id: string, statut: StatutReco) => setRecos((prev) => prev.map((r) => (r.id === id ? { ...r, statut } : r)));
  const visibles = recos.filter((r) => r.statut === onglet);
  const maxPerte = Math.max(...MOTIFS_PERTES.map((m) => m.part));

  return (
    <>
      <EntetePage
        titre="Prévisions et recommandations"
        sousTitre="Semaine du 9 au 15 novembre · modèle « moyennes et saisonnalité » v1 · généré à 6 h 00"
        actions={
          <Bouton variante="contour" icone="refresh">
            Recalculer
          </Bouton>
        }
      />
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
            const t = TYPES[r.type];
            return (
              <Carte key={r.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-4 px-5 py-[18px] md:grid-cols-[44px_minmax(0,1fr)_210px]">
                <span className={cx("flex size-11 items-center justify-center rounded-xl", t.ton)}>
                  <Icon name={t.icone} className="size-[22px]" />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx("text-xs font-bold tracking-[.1em]", t.texte)}>{t.libelle}</span>
                    <span className="rounded-full border border-[#C9BFAE] px-2 py-0.5 text-[11px] font-bold text-texte-3">{r.etiquette}</span>
                  </div>
                  <span className="text-[17px] leading-[23px] font-bold">{r.titre}</span>
                  <span className="text-[13px] leading-[19px] text-texte-2">{r.detail}</span>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="w-[72px] text-xs text-texte-3">Confiance</span>
                    <div className="h-1.5 max-w-[200px] flex-1 rounded-[3px] bg-ligne-3">
                      <div className="h-1.5 rounded-[3px] bg-vert" style={{ width: `${r.confiance}%` }} />
                    </div>
                    <span className="text-xs font-bold">{niveau(r.confiance)}</span>
                  </div>
                  {ajustement === r.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sable p-3 text-sm">
                      <span>Quantité retenue :</span>
                      <input defaultValue={r.titre.match(/\d+(?= (portions|poissons|kg))/)?.[0] ?? ""} inputMode="numeric" className="h-10 w-20 rounded-lg border-[1.5px] border-vert bg-papier px-2.5 font-bold outline-none" />
                      <Bouton hauteur="sm" onClick={() => { changer(r.id, "validee"); setAjustement(null); }}>
                        Valider l&apos;ajustement
                      </Bouton>
                    </div>
                  ) : null}
                </div>
                {r.statut === "a_valider" ? (
                  <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
                    <Bouton icone="check" onClick={() => changer(r.id, "validee")}>
                      Valider
                    </Bouton>
                    <div className="grid grid-cols-2 gap-2">
                      <Bouton variante="fantome" hauteur="sm" className="border-bordure-2" onClick={() => setAjustement(r.id)}>
                        Ajuster
                      </Bouton>
                      <Bouton variante="fantome" hauteur="sm" className="border-bordure-2 text-texte-2" onClick={() => changer(r.id, "ignoree")}>
                        Ignorer
                      </Bouton>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-2 flex flex-col items-start gap-2 md:col-span-1 md:items-end">
                    <span className={cx("flex items-center gap-1.5 text-sm font-bold", r.statut === "validee" ? "text-ok" : "text-texte-3")}>
                      <Icon name={r.statut === "validee" ? "check" : "x"} className="size-4" />
                      {r.statut === "validee" ? "Validée" : "Ignorée"}
                    </span>
                    <button type="button" onClick={() => changer(r.id, "a_valider")} className="cursor-pointer text-xs text-vert underline">
                      Remettre à valider
                    </button>
                  </div>
                )}
              </Carte>
            );
          })}
          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-bordure p-6 text-center text-sm text-texte-3">
              {onglet === "a_valider" ? "Toutes les recommandations ont été traitées." : "Les recommandations plus anciennes apparaîtront ici une fois l'API branchée."}
            </p>
          ) : null}
          <div className="flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-[#C9BFAE] px-5 py-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-segment text-texte-3">
              <Icon name="info" className="size-[22px]" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">Brochettes de capitaine · Données insuffisantes</span>
              <span className="text-[13px] text-texte-2">Plat ajouté il y a 9 jours. Une prévision sera proposée après 4 semaines de ventes.</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <Carte className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-bold">Motifs de pertes · 4 semaines</h2>
              <span className="text-xs text-texte-3">déclarés</span>
            </div>
            {MOTIFS_PERTES.map((m) => (
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
