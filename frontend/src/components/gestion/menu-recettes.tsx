"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Badge, Bouton, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { montant } from "@/lib/api/conversions";
import { listerIngredients, recetteActive, type IngredientApi, type RecetteApi } from "@/lib/api/gestion";
import {
  changerDisponibilite,
  creerPlat,
  listerCategories,
  listerPlats,
  modifierPlat,
  platDepuisApi,
  type CategorieApi,
} from "@/lib/api/menu";
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
  const [plats, setPlats] = useState<Plat[]>([]);
  const [categoriesApi, setCategoriesApi] = useState<CategorieApi[]>([]);
  const [ingredients, setIngredients] = useState<IngredientApi[]>([]);
  const [categorie, setCategorie] = useState<Categorie | "Toutes">("Toutes");
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Plat | null>(null);
  const [recette, setRecette] = useState<RecetteApi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const CATEGORIES = categoriesApi.map((c) => c.name);

  const charger = useCallback(async () => {
    try {
      const [cats, liste] = await Promise.all([listerCategories(), listerPlats()]);
      setCategoriesApi(cats.sort((a, b) => a.position - b.position));
      setPlats(liste.map((d) => platDepuisApi(d, cats)));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement depuis l'API
    void charger();
    listerIngredients()
      .then(setIngredients)
      .catch(() => undefined);
  }, [charger]);

  // Recette active du plat sélectionné.
  useEffect(() => {
    if (!selection) return;
    let actif = true;
    recetteActive(selection)
      .then((r) => actif && setRecette(r))
      .catch(() => actif && setRecette(null));
    return () => {
      actif = false;
    };
  }, [selection]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return plats.filter(
      (p) => (categorie === "Toutes" || p.categorie === categorie) && (!q || p.nom.toLowerCase().includes(q)),
    );
  }, [plats, categorie, recherche]);

  function ouvrir(p: Plat) {
    setRecette(null);
    setSelection(p.id);
    setBrouillon({ ...p });
  }

  function nouveau() {
    setRecette(null);
    setSelection(null);
    const cat = categoriesApi.find((c) => c.name === categorie) ?? categoriesApi.find((c) => c.is_active);
    setBrouillon({
      id: "",
      slug: "",
      nom: "",
      description: "",
      categorie: cat?.name ?? "",
      categorieId: cat?.id,
      prix: 0,
      preparationMin: 10,
      disponibilite: "disponible",
      allergenes: [],
    });
  }

  async function enregistrer() {
    if (!brouillon || !brouillon.nom.trim() || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const champs = {
        name: brouillon.nom.trim(),
        description: brouillon.description,
        price: brouillon.prix.toFixed(2),
        preparation_time: brouillon.preparationMin,
        ...(brouillon.categorieId ? { category: brouillon.categorieId } : {}),
      };
      let maj = brouillon.id
        ? await modifierPlat(brouillon.id, champs)
        : await creerPlat({ ...champs, category: brouillon.categorieId ?? "" });
      const disponible = brouillon.disponibilite === "disponible";
      if (maj.is_available !== disponible) maj = await changerDisponibilite(maj.id, disponible);
      const plat = platDepuisApi(maj, categoriesApi);
      // L'API ne distingue pas « temporaire » et « épuisé » : on garde le choix affiché.
      if (!disponible) plat.disponibilite = brouillon.disponibilite;
      setPlats((prev) => (prev.some((p) => p.id === plat.id) ? prev.map((p) => (p.id === plat.id ? plat : p)) : [...prev, plat]));
      setSelection(plat.id);
      setBrouillon({ ...plat });
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  const coutUnitaire = (id: number | string) => montant(ingredients.find((i) => String(i.id) === String(id))?.cost_per_unit);
  const lignesRecette = (brouillon?.id && recette?.menu_item_id === brouillon.id ? recette.items : []).map((r) => ({
    ingredient: r.ingredient_name,
    quantite: `${montant(r.quantity_required).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${r.ingredient_unit}`,
    cout: montant(r.quantity_required) * coutUnitaire(r.ingredient),
  }));
  const coutMatiere = lignesRecette.reduce((s, r) => s + r.cout, 0);
  const estNouveau = brouillon && !brouillon.id;

  return (
    <div className="-mx-4 -my-6 grid min-h-[calc(100dvh-64px)] grid-cols-1 md:-mx-8 md:-my-7 lg:min-h-dvh xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-[18px] px-4 py-6 md:px-8 md:py-7">
        <EntetePage
          titre="Menu et recettes"
          sousTitre={chargement ? "Chargement…" : `${plats.length} plats · ${CATEGORIES.length} catégories`}
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
        {erreur ? (
          <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
            {erreur}
          </div>
        ) : null}
        <Tableau colonnes={COLONNES} entetes={["PLAT", "PRIX", "PRÉP.", "DISPONIBILITÉ", "MENU"]} largeurMin={640}>
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
              <span className="tabular">{p.preparationMin ? `${p.preparationMin} min` : "—"}</span>
              <span className="flex">
                <Badge
                  apparence={DISPONIBILITES[p.disponibilite]}
                  libelle={p.disponibilite === "temporaire" ? "Indisponible" : LIBELLES_DISPO[p.disponibilite]}
                />
              </span>
              <span className="text-[13px] text-texte-2">{p.publie === false ? "Masqué" : "Publié"}</span>
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
              <select
                value={brouillon.categorieId ?? ""}
                aria-label="Catégorie"
                onChange={(e) => {
                  const cat = categoriesApi.find((c) => c.id === e.target.value);
                  setBrouillon({ ...brouillon, categorieId: cat?.id, categorie: cat?.name ?? "" });
                }}
                className="cursor-pointer self-start bg-transparent text-[13px] text-texte-3 outline-none"
              >
                {categoriesApi
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <span className="text-[13px] text-texte-3">
                {brouillon.disponibilite === "disponible" ? "actif sur le menu" : "masqué du menu client"}
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
                value={brouillon.preparationMin ?? ""}
                onChange={(e) => setBrouillon({ ...brouillon, preparationMin: e.target.value ? lireMontant(e.target.value) : null })}
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
              <span className="text-[15px] font-bold">
                Recette{lignesRecette.length && recette ? ` · version ${recette.version_number}` : ""}
              </span>
              {lignesRecette.length && recette?.valid_from ? (
                <span className="text-xs text-texte-3">depuis le {new Date(recette.valid_from).toLocaleDateString("fr-FR")}</span>
              ) : null}
            </div>
            {lignesRecette.length ? (
              <div className="overflow-hidden rounded-xl border border-ligne">
                {lignesRecette.map((r) => (
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
                Aucune recette active pour ce plat.
                <br />
                <span className="text-xs">La saisie des recettes (POST /recipe-versions/publish/) reste à câbler.</span>
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
                if (!original) setSelection(null);
              }}
            >
              Annuler
            </Bouton>
            <Bouton hauteur="lg" onClick={enregistrer} disabled={!brouillon.nom.trim() || !brouillon.prix || !brouillon.categorieId || envoi}>
              {envoi ? "Enregistrement…" : "Enregistrer"}
            </Bouton>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
