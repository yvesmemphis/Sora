"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Carte, Interrupteur, Puce } from "@/components/ui/primitives";
import { DESCRIPTION_ROLES, PERMISSIONS, ROLES, type Role } from "@/lib/demo/admin";

/** Permissions modifiables d'un rôle (panneau de droite de A1). */
export function PanneauPermissions() {
  const [role, setRole] = useState<Role>("Serveur");
  const [matrice, setMatrice] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(PERMISSIONS.map((p) => [p.nom, p.roles])),
  );

  const basculer = (perm: string, actif: boolean) =>
    setMatrice((m) => ({
      ...m,
      [perm]: actif ? [...m[perm], role] : m[perm].filter((r) => r !== role),
    }));

  return (
    <Carte className="flex flex-col gap-3.5 self-start p-5">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[17px] font-bold">Permissions par rôle</h2>
        <Icon name="shield" className="size-5 text-vert" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <Puce key={r} taille="sm" actif={r === role} onClick={() => setRole(r)}>
            {r}
          </Puce>
        ))}
      </div>
      <p className="m-0 text-[13px] leading-[19px] text-texte-2">{DESCRIPTION_ROLES[role]}</p>
      <ul className="m-0 flex list-none flex-col p-0">
        {PERMISSIONS.map((p) => {
          const actif = matrice[p.nom].includes(role);
          return (
            <li key={p.nom} className="flex items-center justify-between gap-3 border-t border-ligne-3 py-2.5 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{p.nom}</span>
                <span className="text-xs text-texte-3">{p.detail}</span>
              </div>
              <Interrupteur actif={actif} onChange={(v) => basculer(p.nom, v)} libelle={`${p.nom} pour ${role}`} />
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
