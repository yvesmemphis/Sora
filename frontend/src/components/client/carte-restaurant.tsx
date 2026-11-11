"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Logo, cx } from "@/components/ui/primitives";
import { memoriserEmplacementQr, useMenu } from "@/lib/client/menu";
import { usePanier } from "@/lib/client/panier";
import { formatFCFA } from "@/lib/format";
import { DISPONIBILITES } from "@/lib/statuts";
import type { Categorie } from "@/lib/types";
import { BarrePanier } from "./barre-panier";

/** C1 · Carte du restaurant. */
export function CarteRestaurant() {
  const { ajouter, nombreArticles } = usePanier();
  const { menu, erreur, recharger } = useMenu();
  const PLATS = useMemo(() => menu?.plats ?? [], [menu]);
  const CATEGORIES = menu?.categories ?? [];
  const [choix, setCategorie] = useState<Categorie | null>(null);
  const categorie = choix && CATEGORIES.includes(choix) ? choix : (CATEGORIES.find((c) => c === "Plats") ?? CATEGORIES[0] ?? "");
  const [recherche, setRecherche] = useState("");
  // Plat mis en avant : le premier de la catégorie « Plats », s'il existe.
  const platDuJour = PLATS.find((p) => p.categorie === "Plats");

  // QR code de table ou de chambre : `/menu?table=T6`.
  useEffect(() => memoriserEmplacementQr(new URLSearchParams(window.location.search)), []);

  const plats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q) return PLATS.filter((p) => `${p.nom} ${p.description}`.toLowerCase().includes(q));
    return PLATS.filter((p) => p.categorie === categorie);
  }, [PLATS, categorie, recherche]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-5 pb-32">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/panier"
            aria-label={`Mon panier, ${nombreArticles} article${nombreArticles > 1 ? "s" : ""}`}
            className="relative flex size-12 items-center justify-center rounded-full border border-ligne-2 bg-papier text-vert"
          >
            <Icon name="bag" className="size-[22px]" />
            {nombreArticles > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-creme bg-terracotta px-1 text-[11px] font-bold text-creme">
                {nombreArticles}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-serif text-[28px] leading-[34px] font-semibold text-vert">
            Bonsoir.
            <br />
            Voici la carte du soir.
          </h1>
          <p className="flex items-center gap-1.5 text-[13px] text-texte-3">
            <Icon name="clock" className="size-[15px]" />
            Service de 19 h à 23 h · paiement espèces ou carte
          </p>
        </div>

        {erreur && !menu ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-2xl bg-danger-fond p-4 text-sm text-danger">
            <span className="font-bold">La carte n&apos;a pas pu être chargée.</span>
            <span>{erreur}</span>
            <button type="button" onClick={recharger} className="cursor-pointer font-bold underline">
              Réessayer
            </button>
          </div>
        ) : null}
        {menu && !menu.commandesOuvertes ? (
          <div role="status" className="rounded-2xl bg-attention-fond p-4 text-sm font-bold text-attention">
            Les commandes en ligne sont fermées pour le moment. La carte reste consultable.
          </div>
        ) : null}

        <label className="flex h-12 items-center gap-2.5 rounded-xl border border-ligne-2 bg-papier px-3.5 text-texte-3 focus-within:border-vert">
          <Icon name="search" className="size-5" />
          <span className="sr-only">Rechercher un plat</span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un plat"
            className="h-full flex-1 bg-transparent text-[15px] text-encre outline-none placeholder:text-texte-3"
          />
        </label>

        {!recherche ? (
          <nav aria-label="Catégories" className="no-scrollbar -mr-5 flex gap-2 overflow-x-auto pr-5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategorie(c)}
                aria-pressed={c === categorie}
                className={cx(
                  "flex h-10 shrink-0 cursor-pointer items-center rounded-full px-4 text-sm",
                  c === categorie ? "bg-vert font-bold text-creme" : "border border-ligne-2 bg-papier font-medium",
                )}
              >
                {c}
              </button>
            ))}
          </nav>
        ) : null}

        {platDuJour && !recherche && categorie === "Plats" && menu?.commandesOuvertes ? (
          <div className="grid shrink-0 grid-cols-[1fr_128px] overflow-hidden rounded-2xl bg-vert text-creme">
            <div className="flex flex-col gap-1.5 py-4 pl-[18px]">
              <span className="text-[11px] font-bold tracking-[.16em] text-or">PLAT DU JOUR</span>
              <Link href={`/menu/${platDuJour.slug}`} className="font-serif text-xl leading-[1.15] font-semibold">
                {platDuJour.nom}
              </Link>
              <span className="text-[13px] opacity-85">
                {formatFCFA(platDuJour.prix)}
              </span>
              <button
                type="button"
                onClick={() => ajouter(platDuJour.id)}
                className="mt-1.5 flex h-9 cursor-pointer items-center gap-1.5 self-start rounded-[10px] bg-terracotta px-3.5 text-sm font-bold"
              >
                <Icon name="plus" className="size-4" />
                Ajouter
              </button>
            </div>
            <div className="photo-placeholder-vert flex items-end justify-center p-2.5 font-mono text-[10px] text-[#C9D3CC]">
              photo 4:3
            </div>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl font-semibold text-vert">{recherche ? "Résultats" : categorie}</h2>
          <span className="text-[13px] text-texte-3">
            {plats.length} plat{plats.length > 1 ? "s" : ""}
          </span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {plats.map((p) => (
            <li key={p.id} className="grid grid-cols-[88px_1fr] gap-3 rounded-2xl border border-ligne bg-papier p-2.5">
              <Link
                href={`/menu/${p.slug}`}
                className="photo-placeholder flex size-[88px] items-end justify-center overflow-hidden rounded-xl bg-cover bg-center pb-1.5 font-mono text-[9px] text-[#7A7166]"
                style={p.image ? { backgroundImage: `url(${JSON.stringify(p.image)})` } : undefined}
                aria-label={`Voir ${p.nom}`}
              >
                {p.image ? null : "photo"}
              </Link>
              <div className="flex min-w-0 flex-col gap-1">
                <Link href={`/menu/${p.slug}`} className="text-base leading-5 font-bold">
                  {p.nom}
                </Link>
                <span className="text-[13px] leading-[17px] text-texte-3">{p.description}</span>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="tabular text-[15px] font-bold text-vert">{formatFCFA(p.prix)}</span>
                  {p.disponibilite === "disponible" && menu?.commandesOuvertes ? (
                    <button
                      type="button"
                      onClick={() => ajouter(p.id)}
                      className="flex h-[34px] cursor-pointer items-center gap-1 rounded-[10px] bg-terracotta px-3 text-sm font-bold text-creme"
                    >
                      <Icon name="plus" className="size-4" />
                      Ajouter
                    </button>
                  ) : p.disponibilite !== "disponible" ? (
                    <Badge apparence={DISPONIBILITES[p.disponibilite]} />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {plats.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-bordure p-6 text-center text-sm text-texte-3">
              {!menu ? "Chargement de la carte…" : recherche ? `Aucun plat ne correspond à « ${recherche} ».` : "Aucun plat dans cette catégorie."}
            </li>
          ) : null}
        </ul>
      </div>
      <BarrePanier />
    </>
  );
}
