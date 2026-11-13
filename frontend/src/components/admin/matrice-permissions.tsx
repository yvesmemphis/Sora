"use client";

import { useEffect, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Carte } from "@/components/ui/primitives";
import { toutesLesPages } from "@/lib/api/client";
import type { Employe } from "@/lib/api/personnel";
import { DESCRIPTION_ROLES, PERMISSIONS, ROLE_BACKEND, ROLES, type Role } from "@/lib/roles";

const COLONNES = "2fr repeat(4, 1fr)";

/** Vue d'ensemble des permissions : tous les rôles côte à côte. */
export function MatricePermissions() {
  const [comptes, setComptes] = useState<Employe[] | null>(null);
  useEffect(() => {
    toutesLesPages<Employe>("/staff/")
      .then(setComptes)
      .catch(() => setComptes(null));
  }, []);
  const autorise = (roles: Role[], r: Role) => roles.includes(r);

  return (
    <>
      <EntetePage
        titre="Rôles et permissions"
        sousTitre="Droits appliqués par le serveur : chaque rôle n'accède qu'aux écrans et actions de son poste. Pour changer les droits d'une personne, changez son rôle."
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <Carte key={r} className="flex flex-col gap-2 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="font-serif text-xl font-semibold text-vert">{r}</span>
              <span className="font-mono text-[11px] text-texte-3">{ROLE_BACKEND[r]}</span>
            </div>
            <span className="text-[13px] leading-[19px] text-texte-2">{DESCRIPTION_ROLES[r]}</span>
            <span className="mt-auto text-xs font-bold text-texte-3">
              {comptes ? `${comptes.filter((u) => u.role === ROLE_BACKEND[r] && u.is_active).length} compte(s) actif(s)` : "—"}
            </span>
          </Carte>
        ))}
      </div>
      <Tableau colonnes={COLONNES} entetes={["PERMISSION", ...ROLES.map((r) => r.toUpperCase())]} largeurMin={720}>
        {PERMISSIONS.map((p) => (
          <LigneTableau key={p.nom} colonnes={COLONNES}>
            <div className="flex flex-col">
              <span className="font-medium">{p.nom}</span>
              <span className="text-xs text-texte-3">{p.detail}</span>
            </div>
            {ROLES.map((r) => (
              <span key={r} className="flex">
                {autorise(p.roles, r) ? (
                  <Icon name="check" className="size-5 text-ok" title={`${p.nom} : autorisé pour ${r}`} />
                ) : (
                  <span className="text-texte-4" aria-label={`${p.nom} : non autorisé pour ${r}`}>
                    —
                  </span>
                )}
              </span>
            ))}
          </LigneTableau>
        ))}
      </Tableau>
    </>
  );
}
