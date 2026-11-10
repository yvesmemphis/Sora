"use client";

/**
 * État du service en cours, partagé par les écrans du personnel (salle, cuisine).
 * Données de démonstration en mémoire : à remplacer par l'API `orders`
 * (actualisation toutes les 5 s, puis WebSockets via Django Channels).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { COMMANDES_SERVICE } from "../demo/commandes";
import { trouverPlat } from "../demo/menu";
import { formatHeure } from "../format";
import { COULEUR_HISTORIQUE } from "../statuts";
import type { Commande, Disponibilite, EvenementCommande, ModePaiement, ModeService, StatutCommande } from "../types";

export const MOTIFS_ANNULATION = ["Demande du client", "Plat indisponible", "Erreur de saisie", "Autre"] as const;

interface ServiceContexte {
  commandes: Commande[];
  selection: string | null;
  selectionner: (numero: string | null) => void;
  changerStatut: (numero: string, statut: StatutCommande, acteur: string) => void;
  marquerPayee: (numero: string, acteur: string) => void;
  modifierEmplacement: (numero: string, mode: ModeService, emplacement: string) => void;
  annuler: (numero: string, motif: string, commentaire: string, acteur: string) => void;
  cloturer: (numero: string) => void;
  creer: (c: {
    mode: ModeService;
    emplacement: string;
    paiement: ModePaiement;
    lignes: { platId: string; quantite: number }[];
    note?: string;
    acteur: string;
  }) => Commande;
  indisponibilites: Record<string, Disponibilite>;
  signalerIndisponibilite: (platId: string, d: Disponibilite) => void;
}

const Ctx = createContext<ServiceContexte | null>(null);

const LIBELLES: Record<StatutCommande, string> = {
  recue: "Reçue",
  confirmee: "Confirmée",
  preparation: "En préparation",
  prete: "Prête",
  servie: "Servie",
  annulee: "Annulée",
  refusee: "Refusée",
};

const COULEURS: Record<StatutCommande, string> = {
  recue: COULEUR_HISTORIQUE.recue,
  confirmee: COULEUR_HISTORIQUE.confirmee,
  preparation: COULEUR_HISTORIQUE.preparation,
  prete: COULEUR_HISTORIQUE.prete,
  servie: COULEUR_HISTORIQUE.servie,
  annulee: "#B3261E",
  refusee: "#B3261E",
};

function evenement(statut: string, detail: string, couleur: string): EvenementCommande {
  return { heure: formatHeure(new Date()), statut, detail, couleur };
}

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [commandes, setCommandes] = useState<Commande[]>(COMMANDES_SERVICE);
  const [selection, setSelection] = useState<string | null>(COMMANDES_SERVICE[0]?.numero ?? null);
  const [clotures, setClotures] = useState<string[]>([]);
  const [indisponibilites, setIndispo] = useState<Record<string, Disponibilite>>({});

  const maj = useCallback((numero: string, f: (c: Commande) => Commande) => {
    setCommandes((prev) => prev.map((c) => (c.numero === numero ? f(c) : c)));
  }, []);

  const changerStatut = useCallback<ServiceContexte["changerStatut"]>(
    (numero, statut, acteur) =>
      maj(numero, (c) => ({
        ...c,
        statut,
        nouvelle: false,
        enRetard: statut === "preparation" ? c.enRetard : false,
        ecouleSec: statut === "preparation" ? 0 : c.ecouleSec,
        historique: [evenement(LIBELLES[statut], acteur, COULEURS[statut]), ...c.historique],
      })),
    [maj],
  );

  const marquerPayee = useCallback<ServiceContexte["marquerPayee"]>(
    (numero, acteur) =>
      maj(numero, (c) => ({
        ...c,
        payee: true,
        historique: [
          evenement("Payée", `${c.paiement === "carte" ? "Carte" : "Espèces"} · ${acteur}`, COULEUR_HISTORIQUE.payee),
          ...c.historique,
        ],
      })),
    [maj],
  );

  const modifierEmplacement = useCallback<ServiceContexte["modifierEmplacement"]>(
    (numero, mode, emplacement) => maj(numero, (c) => ({ ...c, mode, emplacement })),
    [maj],
  );

  const annuler = useCallback<ServiceContexte["annuler"]>(
    (numero, motif, commentaire, acteur) =>
      maj(numero, (c) => ({
        ...c,
        statut: "annulee",
        historique: [
          evenement("Annulée", `${motif}${commentaire ? ` · ${commentaire}` : ""} · ${acteur}`, "#B3261E"),
          ...c.historique,
        ],
      })),
    [maj],
  );

  const cloturer = useCallback((numero: string) => setClotures((prev) => [...prev, numero]), []);

  const creer = useCallback<ServiceContexte["creer"]>(({ mode, emplacement, paiement, lignes, note, acteur }) => {
    const numero = String(145 + Math.floor(Math.random() * 800)).padStart(4, "0");
    const commande: Commande = {
      numero,
      statut: "recue",
      mode,
      emplacement,
      paiement,
      payee: false,
      passeeA: formatHeure(new Date()),
      note,
      ecouleSec: 0,
      lignes: lignes.flatMap((l) => {
        const p = trouverPlat(l.platId);
        return p ? [{ platId: p.id, nom: p.nom, quantite: l.quantite, prixUnitaire: p.prix }] : [];
      }),
      historique: [evenement("Reçue", `Serveur · ${acteur}`, COULEUR_HISTORIQUE.recue)],
    };
    setCommandes((prev) => [commande, ...prev]);
    setSelection(numero);
    return commande;
  }, []);

  const signalerIndisponibilite = useCallback(
    (platId: string, d: Disponibilite) => setIndispo((prev) => ({ ...prev, [platId]: d })),
    [],
  );

  const valeur = useMemo<ServiceContexte>(
    () => ({
      commandes: commandes.filter((c) => !clotures.includes(c.numero)),
      selection,
      selectionner: setSelection,
      changerStatut,
      marquerPayee,
      modifierEmplacement,
      annuler,
      cloturer,
      creer,
      indisponibilites,
      signalerIndisponibilite,
    }),
    [commandes, clotures, selection, changerStatut, marquerPayee, modifierEmplacement, annuler, cloturer, creer, indisponibilites, signalerIndisponibilite],
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useService(): ServiceContexte {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useService doit être utilisé dans <ServiceProvider>.");
  return ctx;
}
