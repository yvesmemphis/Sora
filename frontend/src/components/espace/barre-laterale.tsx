"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type NomIcone } from "@/components/ui/icon";
import { LogoMark, cx } from "@/components/ui/primitives";

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: NomIcone;
}

/**
 * Barre latérale des espaces bureau (gestion, administration).
 * Sur petit écran, elle devient un bandeau avec un menu déroulant.
 */
export function BarreLaterale({
  sousTitre,
  entrees,
  utilisateur,
}: {
  sousTitre: string;
  entrees: EntreeNavigation[];
  utilisateur: { nom: string; initiales: string; role: string };
}) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const racine = entrees[0]?.href;
  const estActif = (href: string) => (href === racine ? chemin === href : chemin.startsWith(href));

  const logo = (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <LogoMark size={28} clair />
      <div className="flex flex-col">
        <span className="font-serif text-lg leading-none font-semibold">Maison Sora</span>
        <span className="mt-1 text-[9px] tracking-[.28em] text-or">{sousTitre}</span>
      </div>
    </Link>
  );

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={sousTitre}>
      {entrees.map((e) => {
        const actif = estActif(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            onClick={() => setOuvert(false)}
            aria-current={actif ? "page" : undefined}
            className={cx(
              "flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm",
              actif ? "bg-creme font-bold text-vert" : "font-medium text-[#DCE3DE] hover:bg-creme/8",
            )}
          >
            <Icon name={e.icone} className="size-5" />
            {e.libelle}
          </Link>
        );
      })}
    </nav>
  );

  const profil = (
    <div className="flex items-center gap-2.5 rounded-xl bg-creme/7 p-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-or text-[13px] font-bold text-nuit">
        {utilisateur.initiales}
      </span>
      <div className="flex flex-1 flex-col text-[13px]">
        <span className="font-bold">{utilisateur.nom}</span>
        <span className="opacity-75">{utilisateur.role}</span>
      </div>
      <Link href="/connexion" aria-label="Se déconnecter" className="rounded-lg p-1.5 opacity-75 hover:bg-creme/10 hover:opacity-100">
        <Icon name="logout" className="size-[18px]" />
      </Link>
    </div>
  );

  return (
    <>
      {/* Bureau */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-7 bg-vert px-4 py-6 text-creme lg:flex">
        {logo}
        {nav}
        <div className="mt-auto">{profil}</div>
      </aside>

      {/* Mobile et tablette portrait */}
      <div className="sticky top-0 z-40 bg-vert text-creme lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          {logo}
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-label="Menu"
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl hover:bg-creme/10"
          >
            <Icon name={ouvert ? "x" : "menu"} className="size-6" />
          </button>
        </div>
        {ouvert ? (
          <div className="flex flex-col gap-4 border-t border-creme/10 px-4 pt-3 pb-4">
            {nav}
            {profil}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** En-tête de page d'un espace bureau. */
export function EntetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-serif text-[32px] font-semibold text-vert">{titre}</h1>
        {sousTitre ? <span className="text-sm text-texte-3">{sousTitre}</span> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/** Tableau à colonnes fixes, avec défilement horizontal sur petit écran. */
export function Tableau({
  colonnes,
  entetes,
  children,
  largeurMin = 760,
  className,
}: {
  colonnes: string;
  entetes: ReactNode[];
  children: ReactNode;
  largeurMin?: number;
  className?: string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-2xl border border-ligne bg-papier", className)}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: largeurMin }}>
          <div
            className="grid gap-2 bg-entete-table px-[18px] py-3 text-xs font-bold tracking-[.06em] text-texte-3"
            style={{ gridTemplateColumns: colonnes }}
            role="row"
          >
            {entetes.map((e, i) => (
              <span key={i} role="columnheader">
                {e}
              </span>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LigneTableau({
  colonnes,
  children,
  className,
  style,
  onClick,
  selectionnee,
}: {
  colonnes: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  selectionnee?: boolean;
}) {
  return (
    <div
      role="row"
      onClick={onClick}
      className={cx(
        "grid items-center gap-2 border-t border-ligne-3 px-[18px] py-3 text-sm",
        onClick && "cursor-pointer hover:bg-entete",
        selectionnee && "bg-entete shadow-[inset_3px_0_0_#1F3D36]",
        className,
      )}
      style={{ gridTemplateColumns: colonnes, ...style }}
    >
      {children}
    </div>
  );
}
