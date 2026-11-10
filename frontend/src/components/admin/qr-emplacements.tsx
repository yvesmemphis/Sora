"use client";

import { useState } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, Carte, cx } from "@/components/ui/primitives";
import { CHAMBRES, QR_CODES, TABLES } from "@/lib/demo/admin";

/** A2 · QR codes du menu et emplacements. */
export function QrEmplacements() {
  const [qrs, setQrs] = useState(QR_CODES);
  const [tables, setTables] = useState(TABLES);
  const [toutesChambres, setToutesChambres] = useState(false);
  const chambres = toutesChambres ? CHAMBRES : CHAMBRES.slice(0, 16);

  const basculerQr = (jeton: string) =>
    setQrs((prev) =>
      prev.map((q) =>
        q.jeton === jeton
          ? { ...q, actif: !q.actif, usage: q.actif ? "révoqué aujourd'hui" : "réactivé aujourd'hui" }
          : q,
      ),
    );

  function nouveauQr() {
    const jeton = `qr_${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
    setQrs((prev) => [...prev, { nom: "Nouveau QR", jeton, usage: "0 scan", actif: true }]);
  }

  return (
    <>
      <EntetePage
        titre="QR codes et emplacements"
        sousTitre="Le QR ouvre le menu général. Il ne contient jamais de table ni de chambre."
      />
      <Carte className="flex flex-col gap-3.5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[17px] font-bold">QR codes du menu</h2>
          <Bouton variante="contour" hauteur="sm" icone="plus" onClick={nouveauQr}>
            Nouveau QR
          </Bouton>
        </div>
        {qrs.map((q) => (
          <div
            key={q.jeton}
            className="grid grid-cols-[64px_1fr] items-center gap-4 border-t border-ligne-3 py-3 text-sm md:grid-cols-[64px_1.4fr_1fr_.8fr_auto]"
          >
            <span
              className={cx(
                "flex size-16 items-center justify-center rounded-lg border border-bordure-2 bg-[repeating-linear-gradient(0deg,#22201C_0_3px,#FFFFFF_3px_6px)]",
                !q.actif && "opacity-35",
              )}
              aria-hidden
            >
              <span className="bg-white px-1 py-0.5 font-mono text-[9px]">QR</span>
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{q.nom}</span>
              <span className="font-mono text-xs text-texte-3">{q.jeton}</span>
            </div>
            <span className="text-[13px] text-texte-2">{q.usage}</span>
            <span className="flex">
              <Badge
                apparence={
                  q.actif
                    ? { libelle: "Actif", icone: "check", classes: "text-ok bg-ok-fond" }
                    : { libelle: "Révoqué", icone: "ban", classes: "text-danger bg-danger-fond" }
                }
              />
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-label={`Imprimer ${q.nom}`}
                onClick={() => window.print()}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] border border-bordure text-vert hover:bg-sable"
              >
                <Icon name="printer" className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => basculerQr(q.jeton)}
                className={cx(
                  "h-10 cursor-pointer rounded-[10px] border border-bordure px-3 text-[13px] font-bold hover:bg-sable",
                  q.actif ? "text-danger" : "text-vert",
                )}
              >
                {q.actif ? "Révoquer" : "Réactiver"}
              </button>
            </div>
          </div>
        ))}
      </Carte>

      <Carte className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[17px] font-bold">Emplacements</h2>
          <span className="text-[13px] text-texte-3">Utilisés seulement pour renseigner la destination d&apos;une commande</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <Icon name="table" className="size-[18px] text-vert" />
            Tables · {tables.length}
            <span className="font-normal text-texte-3">(touchez une table pour la désactiver)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button
                key={t.numero}
                type="button"
                aria-pressed={t.active}
                onClick={() => setTables((prev) => prev.map((x) => (x.numero === t.numero ? { ...x, active: !x.active } : x)))}
                className={cx(
                  "flex h-9 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-bordure px-2.5 text-[13px] font-bold",
                  t.active ? "bg-papier text-encre" : "bg-ligne-3 text-texte-4 line-through",
                )}
              >
                {t.numero}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <Icon name="bed" className="size-[18px] text-vert" />
            Chambres · {CHAMBRES.length}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {chambres.map((c) => (
              <span
                key={c}
                className="tabular flex h-9 min-w-[52px] items-center justify-center rounded-lg border border-bordure px-2.5 text-[13px] font-bold"
              >
                {c}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setToutesChambres((v) => !v)}
              className="flex h-9 cursor-pointer items-center rounded-lg px-3 text-[13px] text-texte-3 hover:text-vert"
            >
              {toutesChambres ? "Réduire" : `+ ${CHAMBRES.length - 16} autres`}
            </button>
          </div>
        </div>
      </Carte>
    </>
  );
}
