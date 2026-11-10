"use client";

import { useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Bouton, Carte, Segments, cx } from "@/components/ui/primitives";
import { ALERTES_STOCK, JOURS, KPIS, PLUS_VENDUS, PREVISION_SEMAINE, TAUX, VENTES_SEMAINE_PASSEE } from "@/lib/demo/gestion";

const TONS: Record<string, string> = {
  vert: "bg-servi-fond text-vert",
  terracotta: "bg-terracotta-fond text-terracotta",
  or: "bg-attention-fond-2 text-attention",
};

/** Courbe ventes réelles / prévision avec intervalle probable. */
function GraphiqueVentes() {
  const L = 720;
  const pas = L / 14;
  const X = (i: number) => ((i + 0.5) * pas).toFixed(1);
  const Y = (v: number) => (230 - (v / 300) * 210).toFixed(1);
  const reel = VENTES_SEMAINE_PASSEE.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  const prev = [`${X(6)},${Y(VENTES_SEMAINE_PASSEE[6])}`, ...PREVISION_SEMAINE.map((v, i) => `${X(i + 7)},${Y(v)}`)].join(" ");
  const haut = PREVISION_SEMAINE.map((v, i) => `${X(i + 7)},${Y(v * 1.14)}`);
  const bas = PREVISION_SEMAINE.map((v, i) => `${X(i + 7)},${Y(v * 0.86)}`).reverse();
  const libelles = [...JOURS.map((j, i) => `${j} ${2 + i}`), ...JOURS.map((j, i) => `${j} ${9 + i}`)];

  return (
    <figure className="m-0 grid grid-cols-[32px_1fr] gap-1.5">
      <div className="tabular flex h-60 flex-col justify-between pt-3 pb-0.5 text-right text-xs text-texte-3" aria-hidden>
        <span>300</span>
        <span>200</span>
        <span>100</span>
        <span>0</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <svg viewBox="0 0 720 240" preserveAspectRatio="none" className="block h-60 w-full" role="img" aria-label="Plats vendus par jour : semaine passée réelle et prévision de la semaine en cours">
          {[20, 90, 160].map((y) => (
            <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#EFE9DE" />
          ))}
          <line x1="0" x2="720" y1="230" y2="230" stroke="#D9D1C2" />
          <rect x="360" y="0" width="360" height="240" fill="#F6F0E6" opacity=".6" />
          <polygon points={[...haut, ...bas].join(" ")} fill="#F0DCD1" />
          <polyline points={prev} fill="none" stroke="#A3481F" strokeWidth="2.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          <polyline points={reel} fill="none" stroke="#1F3D36" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="360" x2="360" y1="6" y2="230" stroke="#22201C" strokeDasharray="2 4" />
        </svg>
        <div className="grid grid-cols-7 text-center text-[11px] text-texte-3 sm:grid-cols-14">
          {libelles.map((l, i) => (
            <span key={l} className={cx(i === 7 && "font-bold", i % 2 === 1 && "hidden sm:inline")}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

/** G1 · Tableau de bord. */
export function TableauDeBord() {
  const [periode, setPeriode] = useState<"jour" | "semaine" | "mois" | "periode">("semaine");
  const [reco, setReco] = useState<"a_valider" | "validee" | "ignoree">("a_valider");
  const max = Math.max(...PLUS_VENDUS.map((p) => p.portions));

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        sousTitre="Lundi 9 novembre · semaine du 2 au 8 novembre"
        actions={
          <>
            <Segments
              valeur={periode}
              onChange={setPeriode}
              options={[
                { valeur: "jour", libelle: "Jour" },
                { valeur: "semaine", libelle: "Semaine" },
                { valeur: "mois", libelle: "Mois" },
                {
                  valeur: "periode",
                  libelle: (
                    <>
                      <Icon name="calendar" className="size-4" />
                      Période
                    </>
                  ),
                },
              ]}
            />
            <Bouton icone="download">Exporter</Bouton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <Carte key={k.libelle} className="flex flex-col gap-2.5 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-texte-2">{k.libelle}</span>
              <span className={cx("flex size-9 items-center justify-center rounded-[10px]", TONS[k.ton])}>
                <Icon name={k.icone as NomIcone} className="size-[18px]" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="tabular font-serif text-[32px] leading-[38px] font-semibold text-vert">{k.valeur}</span>
              <span className="text-sm text-texte-3">{k.unite}</span>
            </div>
            <span className={cx("text-[13px] font-bold", k.tendance === "hausse" ? "text-ok" : "text-danger")}>{k.delta}</span>
          </Carte>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <Carte className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-[17px] font-bold">Plats vendus par jour</h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-texte-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-[3px] w-[18px] rounded-sm bg-vert" />
                  Réel
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-[18px] border-t-[2.5px] border-dashed border-terracotta" />
                  Prévision
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-sm bg-[#F0DCD1]" />
                  Intervalle probable
                </span>
              </div>
            </div>
            <GraphiqueVentes />
            <p className="m-0 text-xs text-texte-3">
              Semaine passée : ventes réelles · Semaine en cours : prévision, jamais comptée comme vente
            </p>
          </Carte>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {TAUX.map((t) => (
              <Carte key={t.libelle} className="flex items-center justify-between px-[18px] py-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-texte-2">{t.libelle}</span>
                  <span className="text-xs text-texte-3">{t.detail}</span>
                </div>
                <span className="font-serif text-[26px] font-semibold text-vert">{t.valeur}</span>
              </Carte>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-2xl bg-vert p-5 text-creme">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-bold text-or">
                <Icon name="spark" className="size-[18px]" />
                RECOMMANDATION
              </span>
              <span className="rounded-full border border-or px-2.5 py-[3px] text-xs font-bold text-[#E7C77F]">Hypothèse</span>
            </div>
            <span className="font-serif text-[21px] leading-[27px] font-semibold">
              Vendredi 13, déjeuner : préparer 18 portions de kedjenou.
            </span>
            <span className="text-[13px] leading-[19px] text-[#D9E0DB]">
              Intervalle probable : 14 à 22. Fondé sur 6 semaines de ventes et la tendance récente (+9 %).
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-[#D9E0DB]">
                <span>Confiance</span>
                <span>moyenne</span>
              </div>
              <div className="h-1.5 rounded-[3px] bg-creme/15">
                <div className="h-1.5 w-[62%] rounded-[3px] bg-or" />
              </div>
            </div>
            {reco === "a_valider" ? (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Bouton variante="creme" icone="check" onClick={() => setReco("validee")}>
                  Valider
                </Bouton>
                <button
                  type="button"
                  onClick={() => setReco("ignoree")}
                  className="h-11 cursor-pointer rounded-xl border border-creme/40 text-sm font-bold hover:bg-creme/10"
                >
                  Ignorer
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-creme/10 px-3.5 py-3 text-sm font-bold">
                <span className="flex items-center gap-2">
                  <Icon name={reco === "validee" ? "check" : "x"} className="size-4" />
                  {reco === "validee" ? "Validée · ajoutée au plan de production" : "Ignorée"}
                </span>
                <button type="button" onClick={() => setReco("a_valider")} className="cursor-pointer text-xs font-medium underline">
                  Annuler
                </button>
              </div>
            )}
          </div>

          <Carte className="flex flex-col gap-3 p-[18px]">
            <h2 className="m-0 text-[15px] font-bold">Alertes stock</h2>
            {ALERTES_STOCK.map((a, i) => {
              const bas = a.type === "bas";
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={cx(
                      "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                      bas ? "bg-attention-fond-2 text-attention" : "bg-danger-fond text-danger",
                    )}
                  >
                    <Icon name={bas ? "alert" : "clock"} className="size-4" />
                  </span>
                  <div className="flex flex-col gap-px">
                    <span className={cx("text-[13px] font-bold", bas ? "text-attention" : "text-danger")}>{a.titre}</span>
                    <span className="text-[13px] leading-[18px] text-texte-2">{a.detail}</span>
                  </div>
                </div>
              );
            })}
          </Carte>

          <Carte className="flex flex-1 flex-col gap-2.5 p-[18px]">
            <div className="flex justify-between">
              <h2 className="m-0 text-[15px] font-bold">Plus vendus</h2>
              <span className="text-[13px] text-texte-3">portions</span>
            </div>
            {PLUS_VENDUS.map((p, i) => (
              <div key={p.nom} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px]">
                  <span>{p.nom}</span>
                  <span className="tabular font-bold">{p.portions}</span>
                </div>
                <div className="h-1.5 rounded-[3px] bg-ligne-3">
                  <div
                    className={cx("h-1.5 rounded-[3px]", i === PLUS_VENDUS.length - 1 ? "bg-terracotta" : "bg-vert")}
                    style={{ width: `${(p.portions / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Carte>
        </div>
      </div>
    </>
  );
}
