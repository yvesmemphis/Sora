"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Bouton, Encadre, classeChamp } from "@/components/ui/primitives";
import { ACCUEIL_PAR_ROLE, connexion, demanderReinitialisation } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/** Connexion du personnel via l'API Django (`POST /auth/login/`). */
export function FormulaireConnexion() {
  const router = useRouter();
  const [mode, setMode] = useState<"connexion" | "oubli" | "envoye">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function seConnecter(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const profil = await connexion(email.trim(), motDePasse);
      router.push(ACCUEIL_PAR_ROLE[profil.role] ?? "/");
    } catch (err) {
      if (err instanceof ApiError) {
        setErreur(
          err.status === 401
            ? "E-mail ou mot de passe incorrect."
            : err.status === 429
              ? "Trop de tentatives. Réessayez dans quelques minutes."
              : err.message,
        );
      } else setErreur("Une erreur inattendue est survenue.");
    } finally {
      setEnvoi(false);
    }
  }

  async function reinitialiser(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await demanderReinitialisation(email.trim());
      setMode("envoye");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Une erreur inattendue est survenue.");
    } finally {
      setEnvoi(false);
    }
  }

  if (mode === "envoye") {
    return (
      <div className="flex max-w-[420px] flex-col gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok-fond text-ok">
          <Icon name="check" className="size-6" />
        </span>
        <h2 className="m-0 font-serif text-[32px] font-semibold text-vert">Vérifiez vos e-mails</h2>
        <p className="m-0 text-[15px] text-texte-2">
          Si un compte existe pour {email}, un lien de réinitialisation vient d&apos;être envoyé.
        </p>
        <Bouton variante="contour" hauteur="lg" onClick={() => setMode("connexion")}>
          Retour à la connexion
        </Bouton>
      </div>
    );
  }

  const oubli = mode === "oubli";

  return (
    <form onSubmit={oubli ? reinitialiser : seConnecter} className="flex max-w-[420px] flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold tracking-[.18em] text-terracotta">ESPACE PERSONNEL</span>
        <h2 className="m-0 font-serif text-[32px] font-semibold text-vert">{oubli ? "Mot de passe oublié" : "Connexion"}</h2>
        {oubli ? (
          <p className="m-0 text-sm text-texte-2">Indiquez votre e-mail professionnel pour recevoir un lien.</p>
        ) : null}
      </div>

      {erreur ? (
        <Encadre icone="alert" ton="danger" className="text-sm">
          <span role="alert">{erreur}</span>
        </Encadre>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-texte-2">E-mail professionnel</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@maisonsora.ci"
          className={classeChamp}
        />
      </label>

      {!oubli ? (
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[13px] font-medium text-texte-2">
            Mot de passe
            <button
              type="button"
              onClick={() => {
                setMode("oubli");
                setErreur(null);
              }}
              className="cursor-pointer font-bold text-vert hover:text-terracotta"
            >
              Mot de passe oublié ?
            </button>
          </span>
          <span className="relative">
            <input
              type={voir ? "text" : "password"}
              required
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className={`${classeChamp} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVoir((v) => !v)}
              aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-texte-3 hover:bg-sable"
            >
              <Icon name="eye" className="size-5" />
            </button>
          </span>
        </label>
      ) : null}

      <Bouton type="submit" hauteur="xl" disabled={envoi || !email || (!oubli && !motDePasse)} iconeFin={oubli ? undefined : "arrow"}>
        {envoi ? "Patientez…" : oubli ? "Envoyer le lien" : "Se connecter"}
      </Bouton>

      {oubli ? (
        <button type="button" onClick={() => setMode("connexion")} className="cursor-pointer self-start text-sm font-bold text-vert">
          ← Retour à la connexion
        </button>
      ) : (
        <Link href="/" className="self-start text-sm text-texte-3 hover:text-vert">
          Voir tous les espaces (démonstration)
        </Link>
      )}
    </form>
  );
}
