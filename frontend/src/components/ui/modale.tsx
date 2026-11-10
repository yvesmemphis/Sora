"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./primitives";

/**
 * Fenêtre modale accessible : fond assombri, fermeture par Échap
 * ou clic à l'extérieur, focus placé dans la fenêtre à l'ouverture.
 */
export function Modale({
  ouverte,
  onFermer,
  titreId,
  children,
  className,
  fond = "bg-nuit/55",
}: {
  ouverte: boolean;
  onFermer: () => void;
  titreId: string;
  children: ReactNode;
  className?: string;
  fond?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Référence stable : un nouveau callback à chaque rendu ne doit pas voler le focus.
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    if (!ouverte) return;
    const precedent = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("keydown", surTouche);
      precedent?.focus();
    };
  }, [ouverte]);

  if (!ouverte) return null;

  return (
    <div
      className={cx("fixed inset-0 z-50 flex items-center justify-center p-4", fond)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        tabIndex={-1}
        className={cx(
          "max-h-[calc(100dvh-32px)] w-full overflow-y-auto rounded-[20px] bg-creme shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)] outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
