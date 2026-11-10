"use client";

import { useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Bouton, Carte, Interrupteur } from "@/components/ui/primitives";
import { DESCRIPTION_ROLES, PERMISSIONS, ROLE_BACKEND, ROLES, UTILISATEURS, type Role } from "@/lib/demo/admin";

const COLONNES = "2fr repeat(4, 1fr)";

/** Vue d'ensemble des permissions : tous les rôles côte à côte. */
export function MatricePermissions() {
  const [matrice, setMatrice] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.nom, p.roles])),
  );
  const [modifie, setModifie] = useState(false);

  const basculer = (perm: string, role: Role, actif: boolean) => {
    setModifie(true);
    setMatrice((m) => ({ ...m, [perm]: actif ? [...m[perm], role] : m[perm].filter((r) => r !== role) }));
  };

  return (
    <>
      <EntetePage
        titre="Rôles et permissions"
        sousTitre="Chaque rôle n'accède qu'aux écrans et actions nécessaires à son poste."
        actions={
          <Bouton disabled={!modifie} onClick={() => setModifie(false)}>
            {modifie ? "Enregistrer les modifications" : "Aucune modification"}
          </Bouton>
        }
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
              {UTILISATEURS.filter((u) => u.role === r).length} compte(s)
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
                <Interrupteur
                  actif={matrice[p.nom].includes(r)}
                  onChange={(v) => basculer(p.nom, r, v)}
                  libelle={`${p.nom} pour ${r}`}
                />
              </span>
            ))}
          </LigneTableau>
        ))}
      </Tableau>
    </>
  );
}
