"use client";

/**
 * Session du personnel : profil `GET /auth/me/` et protection des espaces par rôle.
 * Les jetons sont en `localStorage` (voir `lib/api/client.ts`), la vérification se fait
 * donc côté navigateur : sans jeton valide, retour à `/connexion`.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCUEIL_PAR_ROLE, deconnexion, moi, type Moi } from "../api/auth";
import { ApiError, estConnecte } from "../api/client";
import { initiales } from "../format";
import type { RoleBackend } from "../types";

export const LIBELLE_ROLE: Record<RoleBackend, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Gestionnaire",
  WAITER: "Serveur",
  KITCHEN: "Cuisine",
};

export interface Session {
  utilisateur: Moi;
  nom: string;
  initiales: string;
  role: string;
  seDeconnecter: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

function nomDe(u: Moi): string {
  const complet = `${u.first_name} ${u.last_name}`.trim();
  return complet || u.email.split("@")[0];
}

/** Garde un espace du personnel : n'affiche les enfants qu'aux rôles autorisés. */
export function SessionProvider({ roles, children, sombre = false }: { roles: RoleBackend[]; children: ReactNode; sombre?: boolean }) {
  const router = useRouter();
  const chemin = usePathname();
  const [utilisateur, setUtilisateur] = useState<Moi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const versConnexion = () => router.replace(`/connexion?suite=${encodeURIComponent(chemin)}`);
    if (!estConnecte()) {
      versConnexion();
      return;
    }
    let actif = true;
    moi()
      .then((u) => actif && setUtilisateur(u))
      .catch((e: unknown) => {
        if (!actif) return;
        if (e instanceof ApiError && e.status === 401) versConnexion();
        else setErreur(e instanceof ApiError ? e.message : "Impossible de charger votre profil.");
      });
    return () => {
      actif = false;
    };
    // Le profil n'est chargé qu'une fois par espace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seDeconnecter = useCallback(async () => {
    await deconnexion().catch(() => undefined);
    router.replace("/connexion");
  }, [router]);

  const session = useMemo<Session | null>(
    () =>
      utilisateur
        ? {
            utilisateur,
            nom: nomDe(utilisateur),
            initiales: initiales(nomDe(utilisateur)) || "?",
            role: LIBELLE_ROLE[utilisateur.role] ?? utilisateur.role,
            seDeconnecter,
          }
        : null,
    [utilisateur, seDeconnecter],
  );

  const fond = sombre ? "bg-nuit text-creme" : "bg-creme text-encre";

  if (erreur) {
    return (
      <div className={`flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center ${fond}`}>
        <p className="text-lg font-bold">{erreur}</p>
        <button type="button" onClick={() => window.location.reload()} className="h-12 cursor-pointer rounded-xl bg-terracotta px-5 font-bold text-creme">
          Réessayer
        </button>
      </div>
    );
  }

  if (!session) {
    return <div className={`flex min-h-dvh items-center justify-center ${fond} opacity-70`}>Chargement…</div>;
  }

  if (!roles.includes(session.utilisateur.role)) {
    return (
      <div className={`flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center ${fond}`}>
        <p className="font-serif text-2xl font-semibold">Accès réservé</p>
        <p className="max-w-md text-[15px] opacity-80">
          Votre rôle ({session.role}) ne donne pas accès à cet espace.
        </p>
        <div className="flex gap-3">
          <Link href={ACCUEIL_PAR_ROLE[session.utilisateur.role] ?? "/"} className="flex h-12 items-center rounded-xl bg-terracotta px-5 font-bold text-creme">
            Aller à mon espace
          </Link>
          <button type="button" onClick={seDeconnecter} className="h-12 cursor-pointer rounded-xl border border-current px-5 font-bold">
            Changer de compte
          </button>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession doit être utilisé dans <SessionProvider>.");
  return ctx;
}
