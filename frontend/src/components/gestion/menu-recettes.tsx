"use client";

import { useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, cx } from "@/components/ui/primitives";
import { RECETTES } from "@/lib/demo/gestion";
import { CATEGORIES, PLATS } from "@/lib/demo/menu";
import { formatFCFA, formatNombre, lireMontant } from "@/lib/format";
import { DISPONIBILITES } from "@/lib/statuts";
import type { Categorie, Disponibilite, Plat } from "@/lib/types";

const COLONNES = "2.1fr 1fr .9fr 1.7fr .6fr";

const LIBELLES_DISPO: Record<Disponibilite, string> = {
  disponible: "Disponible",
  temporaire: "Temporairement indisponible",
  epuise: "Épuisé",
};

/** G2 · Menu et recettes. */
export function MenuRecettes() {
  const [plats, setPlats] = useState<Plat[]>(PLATS);
  const [categorie, setCategorie] = useState<Categorie | "Toutes">("Toutes");
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string | null>("PLAT-010");
  const [brouillon, setBrouillon] = useState<Plat | null>(() => PLATS.find((p) => p.id === "PLAT-010") ?? null);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return plats.filter(
      (p) => (categorie === "Toutes" || p.categorie === categorie) && (!q || p.nom.toLowerCase().includes(q)),
    );
  }, [plats, categorie, recherche]);

  function ouvrir(p: Plat) {
    setSelection(p.id);
    setBrouillon({ ...p });
  }

  function nouveau() {
    const id = `PLAT-${String(100 + plats.length).padStart(3, "0")}`;
    setSelection(id);
    setBrouillon({
      id,
      slug: id.toLowerCase(),
      nom: "",
      description: "",
      categorie: categorie === "Toutes" ? "Plats" : categorie,
      prix: 0,
      preparationMin: 10,
      disponibilite: "disponible",
      allergenes: [],
      versionRecette: "v1",
    });
  }

  function enregistrer() {
    if (!brouillon || !brouillon.nom.trim()) return;
    setPlats((prev) =>
      prev.some((p) => p.id === brouillon.id) ? prev.map((p) => (p.id === brouillon.id ? brouillon : p)) : [...prev, brouillon],
    );
  }

  const recette = brouillon ? RECETTES[brouillon.id] : undefined;
  const coutMatiere = recette?.reduce((s, r) => s + r.cout, 0) ?? 0;
  const estNouveau = brouillon && !plats.some((p) => p.id === brouillon.id);

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100dvh-64px)] grid-cols-1 md:-mx-8 md:-my-7 lg:min-h-dvh xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-[18px] px-4 py-6 md:px-8 md:py-7">
        <EntetePage
          titre="Menu et recettes"
          sousTitre={`${plats.length} plats · ${CATEGORIES.length} catégories`}
          actions={
            <Bouton icone="plus" onClick={nouveau}>
              Nouveau plat
            </Bouton>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-60 flex-1 items-center gap-2.5 rounded-xl border border-ligne-2 bg-papier px-3.5 text-texte-3 focus-within:border-vert">
            <Icon name="search" className="size-[18px]" />
            <span className="sr-only">Rechercher un plat</span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un plat"
              className="h-full flex-1 bg-transparent text-sm text-encre outline-none placeholder:text-texte-3"
            />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-xl border border-bordure bg-papier px-3.5 text-sm font-medium">
            Catégorie :
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as Categorie | "Toutes")}
              className="cursor-pointer bg-transparent font-bold text-vert outline-none"
            >
              <option>Toutes</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <Tableau colonnes={COLONNES} entetes={["PLAT", "PRIX", "PRÉP.", "DISPONIBILITÉ", "RECETTE"]} largeurMin={640}>
          {visibles.map((p) => (
            <LigneTableau key={p.id} colonnes={COLONNES} onClick={() => ouvrir(p)} selectionnee={p.id === selection}>
              <div className="flex items-center gap-3">
                <span className="photo-placeholder h-[33px] w-11 shrink-0 rounded-lg" />
                <div className="flex flex-col">
                  <span className="font-bold">{p.nom}</span>
                  <span className="text-xs text-texte-3">{p.categorie}</span>
                </div>
              </div>
              <span className="tabular font-medium whitespace-nowrap">{formatFCFA(p.prix)}</span>
              <span className="tabular">{p.preparationMin} min</span>
              <span className="flex">
                <Badge
                  apparence={DISPONIBILITES[p.disponibilite]}
                  libelle={p.disponibilite === "temporaire" ? "Indisponible" : LIBELLES_DISPO[p.disponibilite]}
                />
              </span>
              <span className="text-[13px] text-texte-2">{p.versionRecette ?? "—"}</span>
            </LigneTableau>
          ))}
        </Tableau>
      </div>

      {brouillon ? (
        <aside
          aria-label="Modifier le plat"
          className="flex flex-col gap-[18px] border-ligne-2 bg-papier p-7 xl:sticky xl:top-0 xl:h-dvh xl:overflow-y-auto xl:border-l"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[.14em] text-terracotta">{estNouveau ? "NOUVEAU PLAT" : "MODIFIER LE PLAT"}</span>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => {
                setBrouillon(null);
                setSelection(null);
              }}
              className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-ligne-2"
            >
              <Icon name="x" className="size-[18px]" />
            </button>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <div className="photo-placeholder flex h-[90px] items-end justify-center rounded-xl pb-1.5 font-mono text-[10px] text-[#7A7166]">
              photo 4:3
            </div>
            <div className="flex flex-col gap-1">
              <input
                value={brouillon.nom}
                onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
                placeholder="Nom du plat"
                aria-label="Nom du plat"
                className="rounded-lg bg-transparent font-serif text-2xl font-semibold text-vert outline-none focus:bg-creme"
              />
              <span className="text-[13px] text-texte-3">
                {brouillon.categorie} · {brouillon.disponibilite === "disponible" ? "actif sur le menu" : "masqué du menu client"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Prix (FCFA)</span>
              <input
                inputMode="numeric"
                value={brouillon.prix ? formatNombre(brouillon.prix) : ""}
                onChange={(e) => setBrouillon({ ...brouillon, prix: lireMontant(e.target.value) })}
                className="tabular h-12 rounded-xl border-[1.5px] border-vert px-3.5 text-base font-bold outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium">Temps de préparation (min)</span>
              <input
                inputMode="numeric"
                value={brouillon.preparationMin}
                onChange={(e) => setBrouillon({ ...brouillon, preparationMin: lireMontant(e.target.value) })}
                className="tabular h-12 rounded-xl border border-bordure-2 px-3.5 text-base outline-none focus:border-vert"
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Disponibilité</span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["disponible", "Disponible"],
                  ["temporaire", "Temporaire"],
                  ["epuise", "Épuisé"],
                ] as const
              ).map(([cle, lib]) => (
                <button
                  key={cle}
                  type="button"
                  aria-pressed={brouillon.disponibilite === cle}
                  onClick={() => setBrouillon({ ...brouillon, disponibilite: cle })}
                  className={cx(
                    "h-11 cursor-pointer rounded-xl text-[13px]",
                    brouillon.disponibilite === cle ? "bg-vert font-bold text-creme" : "border border-bordure-2 font-medium",
                  )}
                >
                  {lib}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">Recette · version {brouillon.versionRecette?.replace("v", "") ?? "1"}</span>
              {recette ? <span className="text-xs text-texte-3">depuis le 12/10/2026 · v2 archivée</span> : null}
            </div>
            {recette ? (
              <div className="overflow-hidden rounded-xl border border-ligne">
                {recette.map((r) => (
                  <div key={r.ingredient} className="tabular grid grid-cols-[1fr_90px_90px] border-b border-ligne-3 px-3.5 py-[9px] text-[13px]">
                    <span>{r.ingredient}</span>
                    <span className="text-right font-bold">{r.quantite}</span>
                    <span className="text-right text-texte-3">{formatFCFA(r.cout)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_90px] bg-entete-table px-3.5 py-2.5 text-[13px] font-bold">
                  <span>Coût matière estimé · {brouillon.prix ? Math.round((coutMatiere / brouillon.prix) * 100) : 0} % du prix</span>
                  <span className="text-right">{formatFCFA(coutMatiere)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-bordure p-4 text-center text-[13px] text-texte-3">
                Aucune fiche recette détaillée pour ce plat.
                <br />
                <button type="button" className="mt-2 cursor-pointer font-bold text-vert underline">
                  Ajouter des ingrédients
                </button>
              </div>
            )}
            <span className="text-xs text-texte-3">
              Toute modification crée une nouvelle version. Les analyses passées gardent la recette en vigueur à la date de vente.
            </span>
          </div>
          <div className="mt-auto grid grid-cols-[1fr_1.4fr] gap-2.5">
            <Bouton
              variante="contour"
              hauteur="lg"
              onClick={() => {
                const original = plats.find((p) => p.id === brouillon.id);
                setBrouillon(original ? { ...original } : null);
              }}
            >
              Annuler
            </Bouton>
            <Bouton hauteur="lg" onClick={enregistrer} disabled={!brouillon.nom.trim() || !brouillon.prix}>
              Enregistrer
            </Bouton>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
