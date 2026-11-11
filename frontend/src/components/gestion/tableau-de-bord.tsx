"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { Bouton, Carte, Segments, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { listerCommandes, type CommandeApi } from "@/lib/api/commandes";
import { montant } from "@/lib/api/conversions";
import {
  apercu,
  chiffreAffaires,
  dateIso,
  deciderPrevision,
  listerAlertes,
  listerInvendus,
  listerPrevisions,
  listerProductions,
  type AlerteApi,
  type ApercuApi,
  type InvenduApi,
  type LotProductionApi,
  type PrevisionApi,
} from "@/lib/api/gestion";
import { formatNombre } from "@/lib/format";

type Periode = "jour" | "semaine" | "mois";

const TONS: Record<string, string> = {
  vert: "bg-servi-fond text-vert",
  terracotta: "bg-terracotta-fond text-terracotta",
  or: "bg-attention-fond-2 text-attention",
};

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DUREE: Record<Periode, number> = { jour: 1, semaine: 7, mois: 30 };
const JOUR_MS = 86_400_000;

function debutJour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")} %` : "—");

/** Courbe : plats vendus les 7 derniers jours, puis prévisions des 7 prochains. */
function GraphiqueVentes({ reel, prevision, libelles }: { reel: number[]; prevision: (number | null)[]; libelles: string[] }) {
  const L = 720;
  const pas = L / 14;
  const max = Math.max(10, ...reel, ...prevision.map((v) => v ?? 0)) * 1.15;
  const graduation = Math.ceil(max / 3 / 5) * 5;
  const X = (i: number) => ((i + 0.5) * pas).toFixed(1);
  const Y = (v: number) => (230 - (v / (graduation * 3)) * 210).toFixed(1);
  const pointsReel = reel.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  const prev = prevision.map((v, i) => (v === null ? null : `${X(i + 7)},${Y(v)}`)).filter(Boolean) as string[];
  const avecPrevision = prev.length > 0;

  return (
    <figure className="m-0 grid grid-cols-[32px_1fr] gap-1.5">
      <div className="tabular flex h-60 flex-col justify-between pt-3 pb-0.5 text-right text-xs text-texte-3" aria-hidden>
        <span>{graduation * 3}</span>
        <span>{graduation * 2}</span>
        <span>{graduation}</span>
        <span>0</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <svg viewBox="0 0 720 240" preserveAspectRatio="none" className="block h-60 w-full" role="img" aria-label="Plats vendus par jour sur les 7 derniers jours et prévision des 7 prochains">
          {[20, 90, 160].map((y) => (
            <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#EFE9DE" />
          ))}
          <line x1="0" x2="720" y1="230" y2="230" stroke="#D9D1C2" />
          <rect x="360" y="0" width="360" height="240" fill="#F6F0E6" opacity=".6" />
          {avecPrevision ? (
            <polyline points={[`${X(6)},${Y(reel[6] ?? 0)}`, ...prev].join(" ")} fill="none" stroke="#A3481F" strokeWidth="2.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          ) : null}
          <polyline points={pointsReel} fill="none" stroke="#1F3D36" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1="360" x2="360" y1="6" y2="230" stroke="#22201C" strokeDasharray="2 4" />
        </svg>
        <div className="grid grid-cols-7 text-center text-[11px] text-texte-3 sm:grid-cols-14">
          {libelles.map((l, i) => (
            <span key={`${l}-${i}`} className={cx(i === 7 && "font-bold", i % 2 === 1 && "hidden sm:inline")}>
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
  const [periode, setPeriode] = useState<Periode>("semaine");
  const [courant, setCourant] = useState<ApercuApi | null>(null);
  const [precedent, setPrecedent] = useState<ApercuApi | null>(null);
  const [commandes, setCommandes] = useState<CommandeApi[]>([]);
  const [alertes, setAlertes] = useState<AlerteApi[]>([]);
  const [previsions, setPrevisions] = useState<PrevisionApi[]>([]);
  const [productions, setProductions] = useState<LotProductionApi[]>([]);
  const [invendus, setInvendus] = useState<InvenduApi[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  // Données indépendantes de la période.
  useEffect(() => {
    const echec = (e: unknown) => setErreur(messageErreur(e));
    listerCommandes().then(setCommandes).catch(echec);
    listerAlertes()
      .then((a) => setAlertes(a.filter((x) => !x.is_resolved)))
      .catch(() => undefined);
    listerPrevisions().then(setPrevisions).catch(() => undefined);
    listerProductions().then(setProductions).catch(() => undefined);
    listerInvendus().then(setInvendus).catch(() => undefined);
  }, []);

  // Indicateurs de la période et de la période précédente.
  useEffect(() => {
    const duree = DUREE[periode];
    const fin = debutJour(new Date());
    const debut = new Date(fin.getTime() - (duree - 1) * JOUR_MS);
    const finPrec = new Date(debut.getTime() - JOUR_MS);
    const debutPrec = new Date(finPrec.getTime() - (duree - 1) * JOUR_MS);
    let actif = true;
    Promise.all([apercu(debut, fin), apercu(debutPrec, finPrec)])
      .then(([a, b]) => {
        if (!actif) return;
        setCourant(a);
        setPrecedent(b);
        setErreur(null);
      })
      .catch((e: unknown) => actif && setErreur(messageErreur(e)));
    return () => {
      actif = false;
    };
  }, [periode]);

  const debutPeriode = useMemo(() => dateIso(new Date(new Date().getTime() - (DUREE[periode] - 1) * JOUR_MS)), [periode]);

  const graphique = useMemo(() => {
    const aujourdHui = debutJour(new Date());
    const jours = Array.from({ length: 14 }, (_, i) => new Date(aujourdHui.getTime() + (i - 6) * JOUR_MS));
    const vendus = new Map<string, number>();
    for (const c of commandes) {
      if (c.status === "CANCELLED" || c.status === "REJECTED") continue;
      const j = dateIso(new Date(c.created_at));
      vendus.set(j, (vendus.get(j) ?? 0) + c.items.reduce((s, l) => s + l.quantity, 0));
    }
    const prevus = new Map<string, number>();
    for (const p of previsions) {
      if (p.status === "REJECTED") continue;
      prevus.set(p.period_start, (prevus.get(p.period_start) ?? 0) + montant(p.predicted_quantity));
    }
    return {
      reel: jours.slice(0, 7).map((d) => vendus.get(dateIso(d)) ?? 0),
      prevision: jours.slice(7).map((d) => prevus.get(dateIso(d)) ?? null),
      libelles: jours.map((d) => `${JOURS[d.getDay()]} ${d.getDate()}`),
    };
  }, [commandes, previsions]);

  const plusVendus = useMemo(() => {
    const parPlat = new Map<string, number>();
    for (const c of commandes) {
      if (c.status === "CANCELLED" || c.status === "REJECTED" || dateIso(new Date(c.created_at)) < debutPeriode) continue;
      for (const l of c.items) parPlat.set(l.menu_item_name, (parPlat.get(l.menu_item_name) ?? 0) + l.quantity);
    }
    return [...parPlat.entries()]
      .map(([nom, portions]) => ({ nom, portions }))
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 5);
  }, [commandes, debutPeriode]);

  // Invendus et pertes de la période (déclarations de production).
  const pertes = useMemo(() => {
    const lots = productions.filter((p) => p.production_date >= debutPeriode);
    const ids = new Set(lots.map((l) => String(l.id)));
    const declares = invendus.filter((w) => ids.has(String(w.batch)));
    const prepare = lots.filter((l) => declares.some((w) => String(w.batch) === String(l.id))).reduce((s, l) => s + montant(l.quantity_produced), 0);
    return {
      prepare,
      restant: declares.reduce((s, w) => s + montant(w.remaining_quantity), 0),
      jete: declares.reduce((s, w) => s + montant(w.discarded_quantity), 0),
    };
  }, [productions, invendus, debutPeriode]);

  const ca = courant ? chiffreAffaires(courant) : 0;
  const caPrec = precedent ? chiffreAffaires(precedent) : 0;
  const nb = courant?.orders?.total ?? 0;
  const nbPrec = precedent?.orders?.total ?? 0;
  const clos = courant?.orders?.completed ?? 0;
  const closPrec = precedent?.orders?.completed ?? 0;
  const panier = clos ? ca / clos : 0;
  const panierPrec = closPrec ? caPrec / closPrec : 0;
  const variation = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
  const libellePrec = periode === "jour" ? "hier" : periode === "semaine" ? "semaine précédente" : "30 jours précédents";

  const kpis: { libelle: string; valeur: string; unite: string; delta: string; hausse: boolean; icone: NomIcone; ton: string }[] = [
    (() => {
      const v = variation(ca, caPrec);
      return { libelle: "Chiffre d'affaires net", valeur: formatNombre(ca), unite: "FCFA", delta: v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v)} % vs ${libellePrec}`, hausse: (v ?? 0) >= 0, icone: "wallet", ton: "vert" };
    })(),
    { libelle: "Commandes", valeur: String(nb), unite: "commandes", delta: `${nb - nbPrec >= 0 ? "+" : "−"}${Math.abs(nb - nbPrec)} vs ${libellePrec}`, hausse: nb >= nbPrec, icone: "list", ton: "vert" },
    (() => {
      const v = variation(panier, panierPrec);
      return { libelle: "Panier moyen", valeur: formatNombre(panier), unite: "FCFA", delta: v === null ? "commandes clôturées" : `${v >= 0 ? "+" : "−"}${Math.abs(v)} % vs ${libellePrec}`, hausse: (v ?? 0) >= 0, icone: "bag", ton: "terracotta" };
    })(),
    { libelle: "Taux d'invendus", valeur: pct(pertes.restant, pertes.prepare), unite: "du préparé", delta: pertes.prepare ? "lots déclarés" : "aucune déclaration", hausse: true, icone: "flame", ton: "or" },
  ];

  const taux = [
    { libelle: "Taux d'annulation", detail: "commandes annulées", valeur: pct(courant?.orders?.cancelled ?? 0, nb) },
    { libelle: "Commandes clôturées", detail: "servies et soldées", valeur: pct(clos, nb) },
    { libelle: "Taux de pertes", detail: "jeté / préparé", valeur: pct(pertes.jete, pertes.prepare) },
  ];

  const reco = previsions.find((p) => p.status === "DRAFT");
  const [decision, setDecision] = useState<string | null>(null);
  const decider = useCallback(async (p: PrevisionApi, d: "approve" | "reject") => {
    try {
      const maj = await deciderPrevision(p.id, d, d === "reject" ? "Ignorée depuis le tableau de bord" : "");
      setPrevisions((prev) => prev.map((x) => (x.id === maj.id ? maj : x)));
      setDecision(d === "approve" ? "Validée" : "Ignorée");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  const max = Math.max(1, ...plusVendus.map((p) => p.portions));
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <EntetePage
        titre="Tableau de bord"
        sousTitre={`${aujourdhui.charAt(0).toUpperCase()}${aujourdhui.slice(1)}`}
        actions={
          <Segments
            valeur={periode}
            onChange={setPeriode}
            options={[
              { valeur: "jour", libelle: "Jour" },
              { valeur: "semaine", libelle: "Semaine" },
              { valeur: "mois", libelle: "Mois" },
            ]}
          />
        }
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Carte key={k.libelle} className="flex flex-col gap-2.5 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-texte-2">{k.libelle}</span>
              <span className={cx("flex size-9 items-center justify-center rounded-[10px]", TONS[k.ton])}>
                <Icon name={k.icone} className="size-[18px]" />
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="tabular font-serif text-[32px] leading-[38px] font-semibold text-vert">{courant ? k.valeur : "…"}</span>
              <span className="text-sm text-texte-3">{k.unite}</span>
            </div>
            <span className={cx("text-[13px] font-bold", k.hausse ? "text-ok" : "text-danger")}>{k.delta}</span>
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
              </div>
            </div>
            <GraphiqueVentes {...graphique} />
            <p className="m-0 text-xs text-texte-3">
              7 derniers jours : ventes réelles · 7 prochains jours : prévisions générées, jamais comptées comme ventes
            </p>
          </Carte>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {taux.map((t) => (
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
              <span className="rounded-full border border-or px-2.5 py-[3px] text-xs font-bold text-[#E7C77F]">Prévision</span>
            </div>
            {reco ? (
              <>
                <span className="font-serif text-[21px] leading-[27px] font-semibold">
                  {new Date(reco.period_start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} : préparer{" "}
                  {Math.round(montant(reco.predicted_quantity))} portions de {reco.menu_item_name.toLowerCase()}.
                </span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-[#D9E0DB]">
                    <span>Confiance</span>
                    <span>{Math.round(montant(reco.confidence) * 100)} %</span>
                  </div>
                  <div className="h-1.5 rounded-[3px] bg-creme/15">
                    <div className="h-1.5 rounded-[3px] bg-or" style={{ width: `${Math.round(montant(reco.confidence) * 100)}%` }} />
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Bouton variante="creme" icone="check" onClick={() => void decider(reco, "approve")}>
                    Valider
                  </Bouton>
                  <button
                    type="button"
                    onClick={() => void decider(reco, "reject")}
                    className="h-11 cursor-pointer rounded-xl border border-creme/40 text-sm font-bold hover:bg-creme/10"
                  >
                    Ignorer
                  </button>
                </div>
              </>
            ) : (
              <span className="text-[15px] text-[#D9E0DB]">
                {decision ? `${decision}. Aucune autre recommandation à valider.` : "Aucune recommandation à valider pour le moment."}
              </span>
            )}
          </div>

          <Carte className="flex flex-col gap-3 p-[18px]">
            <h2 className="m-0 text-[15px] font-bold">Alertes stock</h2>
            {alertes.slice(0, 5).map((a) => {
              const bas = a.alert_type !== "EXPIRING";
              return (
                <div key={String(a.id)} className="flex items-start gap-2.5">
                  <span
                    className={cx(
                      "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                      bas ? "bg-attention-fond-2 text-attention" : "bg-danger-fond text-danger",
                    )}
                  >
                    <Icon name={bas ? "alert" : "clock"} className="size-4" />
                  </span>
                  <div className="flex flex-col gap-px">
                    <span className={cx("text-[13px] font-bold", bas ? "text-attention" : "text-danger")}>
                      {a.alert_type === "EXPIRING" ? "Péremption proche" : a.alert_type === "OVERSTOCK" ? "Surstock" : "Stock bas"} · {a.ingredient_name}
                    </span>
                    <span className="text-[13px] leading-[18px] text-texte-2">{a.message}</span>
                  </div>
                </div>
              );
            })}
            {alertes.length === 0 ? <span className="text-[13px] text-texte-3">Aucune alerte en cours.</span> : null}
          </Carte>

          <Carte className="flex flex-1 flex-col gap-2.5 p-[18px]">
            <div className="flex justify-between">
              <h2 className="m-0 text-[15px] font-bold">Plus vendus</h2>
              <span className="text-[13px] text-texte-3">portions</span>
            </div>
            {plusVendus.map((p) => (
              <div key={p.nom} className="flex flex-col gap-1">
                <div className="flex justify-between text-[13px]">
                  <span>{p.nom}</span>
                  <span className="tabular font-bold">{p.portions}</span>
                </div>
                <div className="h-1.5 rounded-[3px] bg-ligne-3">
                  <div className="h-1.5 rounded-[3px] bg-vert" style={{ width: `${(p.portions / max) * 100}%` }} />
                </div>
              </div>
            ))}
            {plusVendus.length === 0 ? <span className="text-[13px] text-texte-3">Aucune vente sur la période.</span> : null}
          </Carte>
        </div>
      </div>
    </>
  );
}
