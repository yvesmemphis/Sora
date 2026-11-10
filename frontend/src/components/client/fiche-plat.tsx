"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Quantite, cx } from "@/components/ui/primitives";
import { usePanier } from "@/lib/client/panier";
import { formatFCFA } from "@/lib/format";
import { DISPONIBILITES } from "@/lib/statuts";
import type { Plat } from "@/lib/types";

/** C2 · Fiche plat. */
export function FichePlat({ plat }: { plat: Plat }) {
  const router = useRouter();
  const { ajouter } = usePanier();
  const [quantite, setQuantite] = useState(1);
  const [note, setNote] = useState("");
  const disponible = plat.disponibilite === "disponible";
  const dispo = DISPONIBILITES[plat.disponibilite];

  function valider() {
    ajouter(plat.id, quantite, note.trim() || undefined);
    router.push("/menu");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="photo-placeholder relative flex h-[310px] shrink-0 items-center justify-center font-mono text-xs text-[#7A7166]">
        photo du plat · 4:3 · vue à 45°
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour à la carte"
          className="absolute top-5 left-5 flex size-12 cursor-pointer items-center justify-center rounded-full bg-papier text-vert"
        >
          <Icon name="left" className="size-[22px]" />
        </button>
      </div>

      <div className="relative -mt-6 flex flex-1 flex-col gap-4 rounded-t-3xl bg-creme px-5 pt-[22px] pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[.14em] text-terracotta uppercase">{plat.categorie}</span>
          <div className="flex items-start justify-between gap-3">
            <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">{plat.nom}</h1>
            <span className="tabular mt-0.5 shrink-0 rounded-xl bg-vert px-3 py-2 text-[15px] font-bold text-creme">
              {formatFCFA(plat.prix)}
            </span>
          </div>
          <p className="m-0 text-base leading-6 text-pretty text-texte-2">{plat.descriptionLongue ?? plat.description}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1 rounded-xl border border-ligne bg-papier p-2.5">
            <Icon name="clock" className="size-5 text-vert" />
            <span className="text-sm font-bold">{plat.preparationMin} min</span>
            <span className="text-xs text-texte-3">Préparation</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-ligne bg-papier p-2.5">
            <Icon
              name={dispo.icone}
              className={cx("size-5", disponible ? "text-ok" : plat.disponibilite === "epuise" ? "text-danger" : "text-attention")}
            />
            <span
              className={cx(
                "text-sm font-bold",
                disponible ? "text-ok" : plat.disponibilite === "epuise" ? "text-danger" : "text-attention",
              )}
            >
              {dispo.libelle}
            </span>
            <span className="text-xs text-texte-3">Ce soir</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-ligne bg-papier p-2.5">
            <Icon name="info" className="size-5 text-attention" />
            <span className="text-sm font-bold">{plat.allergenes.length}</span>
            <span className="text-xs text-texte-3">Allergène{plat.allergenes.length > 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-bold">Allergènes déclarés</span>
          {plat.allergenes.length ? (
            <div className="flex flex-wrap gap-2">
              {plat.allergenes.map((a) => (
                <Badge
                  key={a}
                  taille="md"
                  libelle={a}
                  apparence={{ libelle: a, icone: "info", classes: "text-attention bg-attention-fond" }}
                />
              ))}
            </div>
          ) : (
            <span className="text-sm text-texte-3">Aucun allergène majeur déclaré.</span>
          )}
        </div>

        {disponible ? (
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-bold">Instructions pour la cuisine</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sans piment, s'il vous plaît."
              rows={2}
              maxLength={140}
              className="min-h-16 resize-none rounded-xl border border-bordure-2 bg-papier px-3.5 py-3 text-[15px] outline-none focus:border-[1.5px] focus:border-vert"
            />
          </label>
        ) : null}
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-ligne-2 bg-creme px-5 pt-3.5 pb-[max(24px,env(safe-area-inset-bottom))]">
        {disponible ? (
          <>
            <Quantite valeur={quantite} onChange={setQuantite} min={1} taille="lg" />
            <button
              type="button"
              onClick={valider}
              className="tabular flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-terracotta text-base font-bold text-creme"
            >
              Ajouter · {formatFCFA(plat.prix * quantite)}
            </button>
          </>
        ) : (
          <div className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-sable-2 text-[15px] font-bold text-texte-2">
            <Icon name={dispo.icone} className="size-5" />
            {plat.disponibilite === "epuise" ? "Épuisé pour ce service" : "Momentanément indisponible"}
          </div>
        )}
      </div>
    </div>
  );
}
