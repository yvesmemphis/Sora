"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntetePage, LigneTableau, Tableau } from "@/components/espace/barre-laterale";
import { Icon } from "@/components/ui/icon";
import { Modale } from "@/components/ui/modale";
import { Avatar, Bouton, classeChamp, cx } from "@/components/ui/primitives";
import { messageErreur, toutesLesPages } from "@/lib/api/client";
import { inviterEmploye, modifierEmploye, type Employe } from "@/lib/api/personnel";
import { ROLE_BACKEND, ROLES, type Role } from "@/lib/demo/admin";
import { initiales } from "@/lib/format";
import { LIBELLE_ROLE } from "@/lib/staff/session";
import type { Utilisateur } from "@/lib/types";
import { PanneauPermissions } from "./permissions";

const COLONNES = "2fr 1.1fr .9fr 36px";

function versUtilisateur(e: Employe): Utilisateur {
  return {
    id: e.id,
    nom: `${e.first_name} ${e.last_name}`.trim() || e.email,
    email: e.email,
    role: LIBELLE_ROLE[e.role] as Role,
    statut: e.is_active ? "Actif" : "Suspendu",
    derniereConnexion: "",
  };
}

const COULEUR_STATUT: Record<Utilisateur["statut"], string> = {
  Actif: "text-ok bg-ok",
  Invité: "text-attention bg-attention",
  Suspendu: "text-danger bg-danger",
};

/** A1 · Utilisateurs, rôles et permissions. */
export function Utilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const liste = await toutesLesPages<Employe>("/staff/");
      setUtilisateurs(liste.map(versUtilisateur));
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
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<Role | "Tous">("Tous");
  const [invitation, setInvitation] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  // Le menu contextuel est positionné en `fixed` : on le ferme au défilement.
  useEffect(() => {
    if (!menu) return;
    const fermer = () => setMenu(null);
    window.addEventListener("scroll", fermer, true);
    window.addEventListener("resize", fermer);
    return () => {
      window.removeEventListener("scroll", fermer, true);
      window.removeEventListener("resize", fermer);
    };
  }, [menu]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return utilisateurs.filter(
      (u) =>
        (filtreRole === "Tous" || u.role === filtreRole) &&
        (!q || `${u.nom} ${u.email} ${u.role}`.toLowerCase().includes(q)),
    );
  }, [utilisateurs, recherche, filtreRole]);

  const actifs = utilisateurs.filter((u) => u.statut === "Actif").length;

  async function inviter(nom: string, email: string, role: Role): Promise<string | null> {
    const [prenom, ...reste] = nom.split(/\s+/);
    try {
      const cree = await inviterEmploye({ email, first_name: prenom ?? "", last_name: reste.join(" "), role: ROLE_BACKEND[role] });
      setUtilisateurs((prev) => [...prev, versUtilisateur(cree)]);
      setInvitation(false);
      return null;
    } catch (e) {
      return messageErreur(e);
    }
  }

  async function modifier(id: string, donnees: { role?: Role; actif?: boolean }) {
    setMenu(null);
    try {
      const maj = await modifierEmploye(id, {
        ...(donnees.role ? { role: ROLE_BACKEND[donnees.role] } : {}),
        ...(donnees.actif !== undefined ? { is_active: donnees.actif } : {}),
      });
      setUtilisateurs((prev) => prev.map((u) => (u.id === id ? versUtilisateur(maj) : u)));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <>
      <EntetePage
        titre="Utilisateurs"
        sousTitre={`${utilisateurs.length} comptes · ${actifs} actifs`}
        actions={
          <Bouton icone="plus" onClick={() => setInvitation(true)}>
            Inviter un utilisateur
          </Bouton>
        }
      />
      {erreur ? (
        <div role="alert" className="rounded-xl bg-danger-fond px-4 py-3 text-sm font-bold text-danger">
          {erreur}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col self-start overflow-hidden rounded-2xl border border-ligne bg-papier">
          <div className="flex flex-wrap items-center gap-2 border-b border-ligne-3 px-[18px] py-3.5">
            <label className="flex h-10 min-w-52 flex-1 items-center gap-2.5 rounded-[10px] border border-ligne-2 px-3 text-texte-3 focus-within:border-vert">
              <Icon name="search" className="size-[18px]" />
              <span className="sr-only">Rechercher</span>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom, e-mail ou rôle"
                className="h-full flex-1 bg-transparent text-sm text-encre outline-none placeholder:text-texte-3"
              />
            </label>
            <label className="flex h-10 items-center gap-2 rounded-[10px] border border-bordure px-3.5 text-sm font-medium">
              <Icon name="filter" className="size-4" />
              <span className="sr-only">Filtrer par rôle</span>
              <select
                value={filtreRole}
                onChange={(e) => setFiltreRole(e.target.value as Role | "Tous")}
                className="cursor-pointer bg-transparent outline-none"
              >
                <option value="Tous">Tous les rôles</option>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <Tableau
            className="rounded-none border-0"
            colonnes={COLONNES}
            entetes={["UTILISATEUR", "RÔLE", "STATUT", ""]}
            largeurMin={660}
          >
            {visibles.map((u, i) => (
              <LigneTableau key={u.id} colonnes={COLONNES} className="py-[11px]">
                <div className="flex items-center gap-3">
                  <Avatar initiales={initiales(u.nom)} index={i} />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-bold">{u.nom}</span>
                    <span className="truncate text-xs text-texte-3">{u.email}</span>
                  </div>
                </div>
                <span className="flex">
                  <span className="rounded-lg bg-servi-fond px-2.5 py-1 text-xs font-bold text-vert">{u.role}</span>
                </span>
                <span className={cx("flex items-center gap-1.5 bg-transparent text-[13px] font-bold", COULEUR_STATUT[u.statut].split(" ")[0])}>
                  <span className={cx("size-2 rounded-full", COULEUR_STATUT[u.statut].split(" ")[1])} />
                  {u.statut}
                </span>
                <div>
                  <button
                    type="button"
                    aria-label={`Actions pour ${u.nom}`}
                    aria-expanded={menu === u.id}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setPosition({ top: r.bottom + 4, right: window.innerWidth - r.right });
                      setMenu(menu === u.id ? null : u.id);
                    }}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-texte-3 hover:bg-sable"
                  >
                    <Icon name="more" className="size-[18px]" />
                  </button>
                  {menu === u.id ? (
                    <div
                      style={position}
                      className="fixed z-30 flex w-52 flex-col overflow-hidden rounded-xl border border-ligne bg-papier text-sm shadow-[0_12px_30px_-12px_rgba(0,0,0,.3)]"
                    >
                      <span className="px-4 pt-2.5 pb-1 text-xs font-bold text-texte-3">Changer le rôle</span>
                      {ROLES.filter((r) => r !== u.role).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => void modifier(u.id, { role: r })}
                          className="cursor-pointer px-4 py-2 text-left hover:bg-sable"
                        >
                          {r}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => void modifier(u.id, { actif: u.statut === "Suspendu" })}
                        className={cx("cursor-pointer px-4 py-2.5 text-left hover:bg-sable", u.statut !== "Suspendu" && "text-danger")}
                      >
                        {u.statut === "Suspendu" ? "Réactiver le compte" : "Suspendre le compte"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </LigneTableau>
            ))}
            {visibles.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-texte-3">{chargement ? "Chargement…" : "Aucun utilisateur."}</p>
            ) : null}
          </Tableau>
        </div>
        <PanneauPermissions />
      </div>
      <ModaleInvitation ouverte={invitation} onFermer={() => setInvitation(false)} onInviter={inviter} />
    </>
  );
}

function ModaleInvitation({
  ouverte,
  onFermer,
  onInviter,
}: {
  ouverte: boolean;
  onFermer: () => void;
  onInviter: (nom: string, email: string, role: Role) => Promise<string | null>;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Serveur");
  const valide = nom.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  return (
    <Modale ouverte={ouverte} onFermer={onFermer} titreId="titre-invitation" className="max-w-[480px]">
      <form
        className="flex flex-col gap-4 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valide || envoi) return;
          setEnvoi(true);
          const err = await onInviter(nom.trim(), email.trim(), role);
          setEnvoi(false);
          setErreur(err);
          if (!err) {
            setNom("");
            setEmail("");
          }
        }}
      >
        <h2 id="titre-invitation" className="m-0 font-serif text-2xl font-semibold text-vert">
          Inviter un utilisateur
        </h2>
        <p className="m-0 text-sm text-texte-2">Un e-mail d&apos;invitation lui permettra de définir son mot de passe.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Nom complet</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className={classeChamp} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Adresse e-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={classeChamp} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Rôle</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={cx(classeChamp, "cursor-pointer")}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {erreur ? <span className="text-[13px] font-bold text-danger">{erreur}</span> : null}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Bouton variante="contour" hauteur="lg" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" hauteur="lg" disabled={!valide || envoi}>
            Envoyer l&apos;invitation
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
