"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EntetePage } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Bouton, Carte, Champ, classeChamp, cx } from "@/components/ui/primitives";
import { messageErreur } from "@/lib/api/client";
import { montant } from "@/lib/api/conversions";
import {
  UNITES,
  ajusterLot,
  creerFournisseur,
  creerIngredient,
  dateIso,
  declarerPerteLot,
  listerFournisseurs,
  listerIngredients,
  listerLots,
  receptionnerLot,
  type FournisseurApi,
  type IngredientApi,
  type LotApi,
} from "@/lib/api/gestion";
import { creerCategorie, listerCategories, modifierCategorie, type CategorieApi } from "@/lib/api/menu";

const champ = cx(classeChamp, "h-10 text-sm");

/** Nombre décimal saisi (virgule acceptée) → chaîne attendue par l'API, ou null si invalide. */
function decimal(saisie: string, min = 0): string | null {
  const n = Number(saisie.replace(",", ".").trim());
  return saisie.trim() !== "" && Number.isFinite(n) && n >= min ? String(n) : null;
}

const libelleUnite = (code: string) => UNITES.find((u) => u.code === code)?.libelle ?? code;

function Section({ titre, detail, children }: { titre: string; detail: string; children: ReactNode }) {
  return (
    <Carte className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[17px] font-bold">{titre}</h2>
        <span className="text-[13px] text-texte-3">{detail}</span>
      </div>
      {children}
    </Carte>
  );
}

function Formulaire({ onSubmit, children }: { onSubmit: () => void | Promise<void>; children: ReactNode }) {
  return (
    <form
      className="flex flex-wrap items-end gap-2.5 border-t border-ligne-3 pt-3.5"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** G7 · Référentiel : catégories, fournisseurs, ingrédients, réception et inventaire des lots. */
export function Referentiel() {
  const [categories, setCategories] = useState<CategorieApi[]>([]);
  const [fournisseurs, setFournisseurs] = useState<FournisseurApi[]>([]);
  const [ingredients, setIngredients] = useState<IngredientApi[]>([]);
  const [lots, setLots] = useState<LotApi[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [fournisseur, setFournisseur] = useState({ name: "", contact_name: "", phone: "", email: "" });
  const [ingredient, setIngredient] = useState({ name: "", unit_of_measure: "KG", minimum_stock: "", maximum_stock: "", supplier: "" });
  const aujourdhui = dateIso(new Date());
  const [reception, setReception] = useState({
    ingredient: "",
    supplier: "",
    quantity_received: "",
    cost_per_unit: "",
    date_received: aujourdhui,
    date_expiration: "",
  });
  const [inventaire, setInventaire] = useState({ lot: "", type: "adjust" as "adjust" | "waste", quantite: "", motif: "" });

  const charger = useCallback(async () => {
    try {
      const [c, f, i, l] = await Promise.all([listerCategories(), listerFournisseurs(), listerIngredients(), listerLots()]);
      setCategories(c.sort((a, b) => a.position - b.position));
      setFournisseurs(f);
      setIngredients(i);
      setLots(l);
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
  }, [charger]);

  /** Exécute une saisie, affiche le résultat et recharge les listes. */
  async function enregistrer(action: () => Promise<unknown>, message: string): Promise<boolean> {
    setSucces(null);
    try {
      await action();
      setErreur(null);
      setSucces(message);
      await charger();
      return true;
    } catch (e) {
      setErreur(messageErreur(e));
      return false;
    }
  }

  const lotsActifs = lots.filter((l) => l.is_active && montant(l.quantity_remaining) > 0);
  const lotChoisi = lots.find((l) => String(l.id) === inventaire.lot);

  return (
    <>
      <EntetePage
        titre="Référentiel"
        sousTitre="Catégories du menu, fournisseurs, ingrédients et lots : tout ce qu'il faut saisir avant le premier service."
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      {succes ? (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-ok-fond px-4 py-3 text-sm font-bold text-ok">
          <Icon name="check" className="size-4" />
          {succes}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section titre="Catégories du menu" detail="Ordre d'affichage sur la carte. Une catégorie masquée cache ses plats.">
          <div className="flex flex-col">
            {categories.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border-t border-ligne-3 py-2 text-sm first:border-t-0">
                <span className={cx("font-bold", !c.is_active && "text-texte-4 line-through")}>{c.name}</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-label={`Monter ${c.name}`}
                    disabled={i === 0}
                    onClick={() => {
                      const prec = categories[i - 1];
                      void enregistrer(async () => {
                        await modifierCategorie(c.id, { position: prec.position });
                        await modifierCategorie(prec.id, { position: c.position === prec.position ? c.position + 1 : c.position });
                      }, "Ordre des catégories mis à jour.");
                    }}
                    className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-bordure text-vert hover:bg-sable disabled:opacity-30"
                  >
                    <Icon name="arrow" className="size-4 -rotate-90" />
                  </button>
                  <Bouton
                    variante="fantome"
                    hauteur="sm"
                    onClick={() =>
                      void enregistrer(
                        () => modifierCategorie(c.id, { is_active: !c.is_active }),
                        c.is_active ? `« ${c.name} » masquée.` : `« ${c.name} » affichée.`,
                      )
                    }
                  >
                    {c.is_active ? "Masquer" : "Afficher"}
                  </Bouton>
                </div>
              </div>
            ))}
            {!chargement && categories.length === 0 ? <span className="text-[13px] text-texte-3">Aucune catégorie : commencez ici.</span> : null}
          </div>
          <Formulaire
            onSubmit={async () => {
              const nom = nouvelleCategorie.trim();
              if (!nom) return;
              const position = Math.max(0, ...categories.map((c) => c.position)) + 1;
              if (await enregistrer(() => creerCategorie(nom, position), `Catégorie « ${nom} » créée.`)) setNouvelleCategorie("");
            }}
          >
            <Champ libelle="Nouvelle catégorie" className="min-w-[200px] flex-1">
              <input value={nouvelleCategorie} maxLength={120} onChange={(e) => setNouvelleCategorie(e.target.value)} placeholder="Entrées" className={champ} />
            </Champ>
            <Bouton type="submit" variante="contour" hauteur="sm" icone="plus" disabled={!nouvelleCategorie.trim()}>
              Ajouter
            </Bouton>
          </Formulaire>
        </Section>

        <Section titre="Fournisseurs" detail="Rattachés aux ingrédients et aux lots reçus.">
          <div className="flex flex-col">
            {fournisseurs.map((f) => (
              <div key={String(f.id)} className="flex flex-wrap items-center justify-between gap-2 border-t border-ligne-3 py-2 text-sm first:border-t-0">
                <span className="font-bold">{f.name}</span>
                <span className="text-texte-3">{[f.contact_name, f.phone, f.email].filter(Boolean).join(" · ") || "—"}</span>
              </div>
            ))}
            {!chargement && fournisseurs.length === 0 ? <span className="text-[13px] text-texte-3">Aucun fournisseur.</span> : null}
          </div>
          <Formulaire
            onSubmit={async () => {
              if (!fournisseur.name.trim()) return;
              const ok = await enregistrer(
                () =>
                  creerFournisseur({
                    name: fournisseur.name.trim(),
                    contact_name: fournisseur.contact_name.trim(),
                    phone: fournisseur.phone.trim(),
                    email: fournisseur.email.trim(),
                  }),
                `Fournisseur « ${fournisseur.name.trim()} » créé.`,
              );
              if (ok) setFournisseur({ name: "", contact_name: "", phone: "", email: "" });
            }}
          >
            <Champ libelle="Nom" className="min-w-[160px] flex-1">
              <input value={fournisseur.name} maxLength={120} onChange={(e) => setFournisseur((f) => ({ ...f, name: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Contact" className="w-36">
              <input value={fournisseur.contact_name} maxLength={100} onChange={(e) => setFournisseur((f) => ({ ...f, contact_name: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Téléphone" className="w-36">
              <input value={fournisseur.phone} maxLength={30} inputMode="tel" onChange={(e) => setFournisseur((f) => ({ ...f, phone: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="E-mail" className="w-48">
              <input type="email" value={fournisseur.email} maxLength={120} onChange={(e) => setFournisseur((f) => ({ ...f, email: e.target.value }))} className={champ} />
            </Champ>
            <Bouton type="submit" variante="contour" hauteur="sm" icone="plus" disabled={!fournisseur.name.trim()}>
              Ajouter
            </Bouton>
          </Formulaire>
        </Section>
      </div>

      <Section titre="Ingrédients" detail="Le seuil minimum déclenche l'alerte « stock bas ». Le coût unitaire est calculé à partir des lots reçus.">
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
          {ingredients.map((i) => (
            <div key={String(i.id)} className="flex items-center justify-between gap-2 border-t border-ligne-3 py-2 text-sm">
              <span className="font-bold">{i.name}</span>
              <span className="tabular text-texte-3">
                min {montant(i.minimum_stock).toLocaleString("fr-FR")} {libelleUnite(i.unit_of_measure)}
                {i.supplier_name ? ` · ${i.supplier_name}` : ""}
              </span>
            </div>
          ))}
        </div>
        {!chargement && ingredients.length === 0 ? <span className="text-[13px] text-texte-3">Aucun ingrédient.</span> : null}
        <Formulaire
          onSubmit={async () => {
            const min = decimal(ingredient.minimum_stock || "0");
            const max = decimal(ingredient.maximum_stock || "0");
            if (!ingredient.name.trim() || min === null || max === null) {
              setErreur("Indiquez un nom et des seuils positifs.");
              return;
            }
            const ok = await enregistrer(
              () =>
                creerIngredient({
                  name: ingredient.name.trim(),
                  unit_of_measure: ingredient.unit_of_measure,
                  minimum_stock: min,
                  maximum_stock: max,
                  supplier: ingredient.supplier || null,
                }),
              `Ingrédient « ${ingredient.name.trim()} » créé.`,
            );
            if (ok) setIngredient({ name: "", unit_of_measure: ingredient.unit_of_measure, minimum_stock: "", maximum_stock: "", supplier: "" });
          }}
        >
          <Champ libelle="Nom" className="min-w-[180px] flex-1">
            <input value={ingredient.name} maxLength={120} onChange={(e) => setIngredient((v) => ({ ...v, name: e.target.value }))} placeholder="Riz parfumé" className={champ} />
          </Champ>
          <Champ libelle="Unité" className="w-28">
            <select value={ingredient.unit_of_measure} onChange={(e) => setIngredient((v) => ({ ...v, unit_of_measure: e.target.value }))} className={cx(champ, "cursor-pointer")}>
              {UNITES.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.libelle}
                </option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Seuil minimum" className="w-32">
            <input inputMode="decimal" value={ingredient.minimum_stock} onChange={(e) => setIngredient((v) => ({ ...v, minimum_stock: e.target.value }))} placeholder="5" className={champ} />
          </Champ>
          <Champ libelle="Stock maximum" className="w-32">
            <input inputMode="decimal" value={ingredient.maximum_stock} onChange={(e) => setIngredient((v) => ({ ...v, maximum_stock: e.target.value }))} placeholder="50" className={champ} />
          </Champ>
          <Champ libelle="Fournisseur" className="w-48">
            <select value={ingredient.supplier} onChange={(e) => setIngredient((v) => ({ ...v, supplier: e.target.value }))} className={cx(champ, "cursor-pointer")}>
              <option value="">—</option>
              {fournisseurs.filter((f) => f.is_active).map((f) => (
                <option key={String(f.id)} value={String(f.id)}>
                  {f.name}
                </option>
              ))}
            </select>
          </Champ>
          <Bouton type="submit" variante="contour" hauteur="sm" icone="plus" disabled={!ingredient.name.trim()}>
            Ajouter
          </Bouton>
        </Formulaire>
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section titre="Réception de marchandise" detail="Crée un lot et un mouvement d'entrée. Les sorties suivent l'ordre FEFO (premier périmé, premier sorti).">
          <Formulaire
            onSubmit={async () => {
              const qte = decimal(reception.quantity_received, 0.001);
              const cout = decimal(reception.cost_per_unit);
              if (!reception.ingredient || qte === null || cout === null || !reception.date_expiration) {
                setErreur("Ingrédient, quantité, coût unitaire et date de péremption sont obligatoires.");
                return;
              }
              const nom = ingredients.find((i) => String(i.id) === reception.ingredient)?.name ?? "";
              const ok = await enregistrer(
                () =>
                  receptionnerLot({
                    ingredient: reception.ingredient,
                    supplier: reception.supplier || null,
                    quantity_received: qte,
                    cost_per_unit: cout,
                    date_received: reception.date_received,
                    date_expiration: reception.date_expiration,
                  }),
                `Lot de ${nom} réceptionné.`,
              );
              if (ok) setReception((r) => ({ ...r, quantity_received: "", cost_per_unit: "", date_expiration: "" }));
            }}
          >
            <Champ libelle="Ingrédient" className="min-w-[180px] flex-1">
              <select value={reception.ingredient} onChange={(e) => setReception((r) => ({ ...r, ingredient: e.target.value }))} className={cx(champ, "cursor-pointer")}>
                <option value="">Choisir…</option>
                {ingredients.filter((i) => i.is_active).map((i) => (
                  <option key={String(i.id)} value={String(i.id)}>
                    {i.name} ({libelleUnite(i.unit_of_measure)})
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Fournisseur" className="w-44">
              <select value={reception.supplier} onChange={(e) => setReception((r) => ({ ...r, supplier: e.target.value }))} className={cx(champ, "cursor-pointer")}>
                <option value="">—</option>
                {fournisseurs.filter((f) => f.is_active).map((f) => (
                  <option key={String(f.id)} value={String(f.id)}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Quantité" className="w-28">
              <input inputMode="decimal" value={reception.quantity_received} onChange={(e) => setReception((r) => ({ ...r, quantity_received: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Coût unitaire (FCFA)" className="w-36">
              <input inputMode="decimal" value={reception.cost_per_unit} onChange={(e) => setReception((r) => ({ ...r, cost_per_unit: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Reçu le" className="w-40">
              <input type="date" value={reception.date_received} max={aujourdhui} onChange={(e) => setReception((r) => ({ ...r, date_received: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Périme le" className="w-40">
              <input type="date" value={reception.date_expiration} min={reception.date_received} onChange={(e) => setReception((r) => ({ ...r, date_expiration: e.target.value }))} className={champ} />
            </Champ>
            <Bouton type="submit" hauteur="sm" icone="truck">
              Réceptionner
            </Bouton>
          </Formulaire>
        </Section>

        <Section titre="Inventaire et pertes" detail="Corrige un lot après comptage, ou déclare une perte (casse, péremption).">
          <Formulaire
            onSubmit={async () => {
              const qte = decimal(inventaire.quantite, inventaire.type === "waste" ? 0.001 : 0);
              if (!lotChoisi || qte === null || !inventaire.motif.trim()) {
                setErreur("Choisissez un lot, une quantité valide et un motif.");
                return;
              }
              const ok = await enregistrer(
                () =>
                  inventaire.type === "adjust"
                    ? ajusterLot(lotChoisi.id, qte, inventaire.motif.trim())
                    : declarerPerteLot(lotChoisi.id, qte, inventaire.motif.trim()),
                inventaire.type === "adjust" ? `Lot ${lotChoisi.lot_id.slice(0, 8)} ajusté.` : "Perte enregistrée.",
              );
              if (ok) setInventaire((v) => ({ ...v, quantite: "", motif: "" }));
            }}
          >
            <Champ libelle="Lot" className="min-w-[220px] flex-1">
              <select value={inventaire.lot} onChange={(e) => setInventaire((v) => ({ ...v, lot: e.target.value }))} className={cx(champ, "cursor-pointer")}>
                <option value="">Choisir…</option>
                {lotsActifs.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.ingredient_name} · reste {montant(l.quantity_remaining).toLocaleString("fr-FR")} · périme {new Date(l.date_expiration).toLocaleDateString("fr-FR")}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Opération" className="w-40">
              <select value={inventaire.type} onChange={(e) => setInventaire((v) => ({ ...v, type: e.target.value as "adjust" | "waste" }))} className={cx(champ, "cursor-pointer")}>
                <option value="adjust">Quantité comptée</option>
                <option value="waste">Perte</option>
              </select>
            </Champ>
            <Champ libelle={inventaire.type === "adjust" ? "Quantité comptée" : "Quantité perdue"} className="w-32">
              <input inputMode="decimal" value={inventaire.quantite} onChange={(e) => setInventaire((v) => ({ ...v, quantite: e.target.value }))} className={champ} />
            </Champ>
            <Champ libelle="Motif" className="min-w-[160px] flex-1">
              <input value={inventaire.motif} maxLength={200} onChange={(e) => setInventaire((v) => ({ ...v, motif: e.target.value }))} placeholder="Inventaire du soir" className={champ} />
            </Champ>
            <Bouton type="submit" variante="contour" hauteur="sm" disabled={!lotsActifs.length}>
              Enregistrer
            </Bouton>
          </Formulaire>
          {!chargement && lotsActifs.length === 0 ? <span className="text-[13px] text-texte-3">Aucun lot en stock.</span> : null}
        </Section>
      </div>
    </>
  );
}
