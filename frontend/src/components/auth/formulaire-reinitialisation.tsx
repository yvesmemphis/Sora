"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { Bouton, Encadre, classeChamp } from "@/components/ui/primitives";
import { confirmerReinitialisation } from "@/lib/api/auth";
import { messageErreur } from "@/lib/api/client";

/**
 * Choix du mot de passe depuis le lien reçu par e-mail
 * (`FRONTEND_URL/reset-password?uid=…&token=…`, invitation ou mot de passe oublié).
 */
export function FormulaireReinitialisation() {
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const lienValide = uid !== "" && token !== "";
  const tropCourt = motDePasse.length > 0 && motDePasse.length < 10;
  const different = confirmation.length > 0 && confirmation !== motDePasse;
  const valide = lienValide && motDePasse.length >= 10 && motDePasse === confirmation;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!valide) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await confirmerReinitialisation(uid, token, motDePasse);
      setFait(true);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <div className="flex max-w-[420px] flex-col gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok-fond text-ok">
          <Icon name="check" className="size-6" />
        </span>
        <h2 className="m-0 font-serif text-[28px] font-semibold text-vert">Mot de passe enregistré</h2>
        <p className="m-0 text-[15px] text-texte-2">Vous pouvez maintenant vous connecter avec votre adresse e-mail.</p>
        <Link href="/connexion" className="flex h-12 items-center justify-center rounded-xl bg-vert font-bold text-creme">
          Se connecter
        </Link>
      </div>
    );
  }

  if (!lienValide) {
    return (
      <div className="flex max-w-[420px] flex-col gap-4">
        <h2 className="m-0 font-serif text-[28px] font-semibold text-vert">Lien incomplet</h2>
        <p className="m-0 text-[15px] text-texte-2">
          Ce lien ne contient pas les informations nécessaires. Ouvrez le lien reçu par e-mail en entier, ou demandez-en un nouveau.
        </p>
        <Link href="/connexion" className="flex h-12 items-center justify-center rounded-xl border-[1.5px] border-vert font-bold text-vert">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="flex max-w-[420px] flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <h2 className="m-0 font-serif text-[30px] font-semibold text-vert">Choisir un mot de passe</h2>
        <p className="m-0 text-[15px] text-texte-2">Au moins 10 caractères. Évitez un mot de passe trop courant.</p>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Nouveau mot de passe</span>
        <span className="relative flex">
          <input
            type={voir ? "text" : "password"}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="new-password"
            aria-invalid={tropCourt}
            className={`${classeChamp} w-full pr-12`}
          />
          <button
            type="button"
            onClick={() => setVoir((v) => !v)}
            aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-texte-3"
          >
            <Icon name="eye" className="size-5" />
          </button>
        </span>
        {tropCourt ? <span className="text-[13px] font-medium text-danger">10 caractères minimum.</span> : null}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Confirmer le mot de passe</span>
        <input
          type={voir ? "text" : "password"}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          aria-invalid={different}
          className={classeChamp}
        />
        {different ? <span className="text-[13px] font-medium text-danger">Les deux mots de passe diffèrent.</span> : null}
      </label>
      {erreur ? (
        <Encadre icone="alert" ton="attention">
          {erreur} Le lien a peut-être expiré (1 h) : demandez-en un nouveau depuis la page de connexion.
        </Encadre>
      ) : null}
      <Bouton type="submit" hauteur="xl" disabled={!valide || envoi}>
        {envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Bouton>
      <Link href="/connexion" className="text-center text-sm font-medium text-vert underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
