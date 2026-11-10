/**
 * Composants de base partagés par toutes les interfaces.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type NomIcone } from "./icon";
import type { Apparence } from "@/lib/statuts";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Logo */

export function LogoMark({ size = 30, clair = false }: { size?: number; clair?: boolean }) {
  return (
    <svg width={size} height={(size * 34) / 30} viewBox="0 0 30 34" aria-hidden="true" className="shrink-0">
      <path
        d="M4 30V15a11 11 0 0 1 22 0v15"
        fill="none"
        stroke={clair ? "#F6F0E6" : "#1F3D36"}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="15" cy="21" r="5.5" fill="#A3481F" />
      <path d="M7 31h16" stroke="#C99A3B" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({
  sousTitre = "HÔTEL · TABLE",
  clair = false,
  taille = "md",
}: {
  sousTitre?: string;
  clair?: boolean;
  taille?: "md" | "lg";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={taille === "lg" ? 40 : 28} clair={clair} />
      <div className="flex flex-col">
        <span
          className={cx(
            "font-serif font-semibold leading-none",
            taille === "lg" ? "text-[26px]" : "text-lg",
            clair ? "text-creme" : "text-vert",
          )}
        >
          Maison Sora
        </span>
        <span
          className={cx(
            "mt-1 text-[9px] font-medium tracking-[.28em]",
            clair ? "text-or" : "text-texte-3",
          )}
        >
          {sousTitre}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Badges */

/** Pastille de statut : toujours une icône et un libellé. */
export function Badge({
  apparence,
  libelle,
  taille = "sm",
}: {
  apparence: Apparence;
  libelle?: string;
  taille?: "xs" | "sm" | "md";
}) {
  const t = {
    xs: "gap-1 px-2.5 py-1 text-xs [&_svg]:size-[13px]",
    sm: "gap-1.5 px-2.5 py-1 text-xs [&_svg]:size-[13px]",
    md: "gap-1.5 px-3 py-1.5 text-[13px] [&_svg]:size-3.5",
  }[taille];
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full font-bold", t, apparence.classes)}>
      <Icon name={apparence.icone} />
      {libelle ?? apparence.libelle}
    </span>
  );
}

/** Surtitre en capitales espacées. */
export function Surtitre({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("text-xs font-bold tracking-[.14em] uppercase", className)}>{children}</span>;
}

/* -------------------------------------------------------------- Boutons */

type Variante = "vert" | "terracotta" | "contour" | "fantome" | "danger" | "creme" | "danger-texte";

const VARIANTES: Record<Variante, string> = {
  vert: "bg-vert text-creme hover:bg-[#183129]",
  terracotta: "bg-terracotta text-creme hover:bg-[#8f3e1a] shadow-[0_12px_24px_-12px_rgba(163,72,31,.6)]",
  contour: "border-2 border-vert text-vert bg-papier hover:bg-sable",
  fantome: "border border-bordure text-vert bg-papier hover:bg-sable",
  danger: "bg-danger text-papier hover:bg-[#9a2019]",
  creme: "bg-creme text-vert hover:bg-white",
  "danger-texte": "text-danger hover:bg-danger-fond",
};

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icone?: NomIcone;
  iconeFin?: NomIcone;
  hauteur?: "sm" | "md" | "lg" | "xl";
}

export function Bouton({
  variante = "vert",
  icone,
  iconeFin,
  hauteur = "md",
  className,
  children,
  type = "button",
  ...rest
}: BoutonProps) {
  const h = { sm: "h-10 px-3 text-[13px]", md: "h-11 px-4 text-sm", lg: "h-12 px-4 text-[15px]", xl: "h-14 px-5 text-base" }[
    hauteur
  ];
  return (
    <button
      type={type}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        h,
        VARIANTES[variante],
        className,
      )}
      {...rest}
    >
      {icone ? <Icon name={icone} className="size-[18px]" /> : null}
      {children}
      {iconeFin ? <Icon name={iconeFin} className="size-[18px]" /> : null}
    </button>
  );
}

/* ------------------------------------------------------------ Puces filtre */

export function Puce({
  actif,
  onClick,
  children,
  compteur,
  taille = "md",
}: {
  actif: boolean;
  onClick?: () => void;
  children: ReactNode;
  compteur?: number;
  taille?: "sm" | "md" | "lg";
}) {
  const h = { sm: "h-9 px-3.5 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-11 px-[18px] text-[15px]" }[taille];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cx(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border transition-colors",
        h,
        actif ? "border-vert bg-vert font-bold text-creme" : "border-bordure bg-papier font-medium text-encre hover:border-vert",
      )}
    >
      {children}
      {compteur !== undefined ? (
        <span className={cx("rounded-full px-[7px] py-px text-xs font-bold text-vert", actif ? "bg-creme" : "bg-sable-2")}>
          {compteur}
        </span>
      ) : null}
    </button>
  );
}

/** Sélecteur segmenté (Jour / Semaine / Mois…). */
export function Segments<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { valeur: T; libelle: ReactNode }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-xl bg-segment p-1" role="radiogroup">
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.valeur)}
            className={cx(
              "flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] px-3.5 text-sm",
              actif ? "bg-papier font-bold text-vert shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "font-medium",
            )}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- Cartes */

export function Carte({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-ligne bg-papier", className)}>{children}</div>;
}

/** Encadré d'information neutre. */
export function Encadre({
  icone = "info",
  ton = "neutre",
  children,
  className,
}: {
  icone?: NomIcone;
  ton?: "neutre" | "attention" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const t = {
    neutre: ["bg-sable-2 text-texte-2", "text-vert"],
    attention: ["bg-attention-fond-2 text-encre", "text-attention"],
    danger: ["bg-danger-fond text-encre", "text-danger"],
  }[ton];
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-[18px]", t[0], className)}>
      <Icon name={icone} className={cx("size-[18px]", t[1])} />
      <div>{children}</div>
    </div>
  );
}

/* --------------------------------------------------------- Quantité +/- */

export function Quantite({
  valeur,
  onChange,
  min = 0,
  taille = "md",
}: {
  valeur: number;
  onChange: (v: number) => void;
  min?: number;
  taille?: "sm" | "md" | "lg";
}) {
  const s = {
    sm: ["h-9 rounded-[10px]", "w-[34px]", "text-[15px]", "size-4"],
    md: ["h-10 rounded-[10px]", "w-10", "text-[15px]", "size-4"],
    lg: ["h-14 rounded-xl", "w-12", "text-[17px]", "size-5"],
  }[taille];
  return (
    <div className={cx("flex items-center border border-bordure-2 bg-papier text-vert", s[0])}>
      <button
        type="button"
        aria-label="Retirer un"
        disabled={valeur <= min}
        onClick={() => onChange(Math.max(min, valeur - 1))}
        className={cx("flex h-full cursor-pointer items-center justify-center disabled:opacity-40", s[1])}
      >
        <Icon name="minus" className={s[3]} />
      </button>
      <span className={cx("tabular min-w-6 text-center font-bold text-encre", s[2])} aria-live="polite">
        {valeur}
      </span>
      <button
        type="button"
        aria-label="Ajouter un"
        onClick={() => onChange(valeur + 1)}
        className={cx("flex h-full cursor-pointer items-center justify-center", s[1])}
      >
        <Icon name="plus" className={s[3]} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ Interrupteur */

export function Interrupteur({
  actif,
  onChange,
  libelle,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  libelle: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      onClick={() => onChange(!actif)}
      className={cx(
        "flex h-[26px] w-11 shrink-0 cursor-pointer rounded-full p-[3px] transition-colors",
        actif ? "justify-end bg-vert" : "justify-start bg-[#D6CDBD]",
      )}
    >
      <span className="size-5 rounded-full bg-papier shadow-[0_1px_2px_rgba(0,0,0,.2)]" />
    </button>
  );
}

/* ------------------------------------------------------------- Avatar */

const FONDS_AVATAR = ["bg-servi-fond", "bg-terracotta-fond", "bg-attention-fond-2", "bg-neutre-fond"];

export function Avatar({
  initiales,
  index = 0,
  taille = 36,
  className,
}: {
  initiales: string;
  index?: number;
  taille?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: taille, height: taille, fontSize: taille < 32 ? 11 : 13 }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-vert",
        className ?? FONDS_AVATAR[index % FONDS_AVATAR.length],
      )}
    >
      {initiales}
    </span>
  );
}

/* ------------------------------------------------------------- Historique */

export function Historique({
  evenements,
  largeurHeure = 56,
}: {
  evenements: { heure: string; statut: string; detail: string; couleur: string }[];
  largeurHeure?: number;
}) {
  return (
    <ol className="flex flex-col gap-3.5">
      {evenements.map((h, i) => (
        <li
          key={i}
          className="grid items-start gap-2.5"
          style={{ gridTemplateColumns: `${largeurHeure}px 12px 1fr` }}
        >
          <span className="tabular text-sm font-bold text-vert">{h.heure}</span>
          <span className="mt-[5px] size-2.5 rounded-full" style={{ background: h.couleur }} />
          <div className="flex flex-col gap-px">
            <span className="text-sm font-bold">{h.statut}</span>
            <span className="text-[13px] text-texte-3">{h.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------- Champ */

export function Champ({
  libelle,
  children,
  className,
}: {
  libelle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-texte-2">{libelle}</span>
      {children}
    </label>
  );
}

export const classeChamp =
  "h-12 w-full rounded-xl border border-bordure-2 bg-papier px-3.5 text-base text-encre outline-none focus:border-[1.5px] focus:border-vert";
