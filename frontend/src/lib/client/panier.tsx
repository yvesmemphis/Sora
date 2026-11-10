"use client";

/**
 * Panier du client (sans compte), conservé dans le navigateur.
 * Les commandes passées sont aussi gardées localement pour l'écran de suivi
 * tant que l'API `orders` du backend n'est pas branchée.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PLATS } from "../demo/menu";
import type { Commande, ModePaiement, ModeService, Plat } from "../types";
import { COULEUR_HISTORIQUE } from "../statuts";
import { formatHeure } from "../format";

export interface LignePanier {
  platId: string;
  quantite: number;
  note?: string;
}

export interface LignePanierDetaillee extends LignePanier {
  plat: Plat;
  sousTotal: number;
}

/** Commande enregistrée localement, avec son horodatage réel. */
export interface CommandeLocale extends Commande {
  creeeLe: number; // timestamp ms
}

interface PanierContexte {
  lignes: LignePanierDetaillee[];
  nombreArticles: number;
  total: number;
  pret: boolean;
  ajouter: (platId: string, quantite?: number, note?: string) => void;
  modifierQuantite: (platId: string, quantite: number) => void;
  vider: () => void;
  passerCommande: (choix: { mode: ModeService; emplacement: string; paiement: ModePaiement }) => CommandeLocale;
}

const CLE_PANIER = "sora.panier";
const CLE_COMMANDES = "sora.commandes";

const Ctx = createContext<PanierContexte | null>(null);

function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible (navigation privée) : le panier reste en mémoire */
  }
}

export function lireCommandeLocale(numero: string): CommandeLocale | undefined {
  return lire<CommandeLocale[]>(CLE_COMMANDES, []).find((c) => c.numero === numero);
}

export function enregistrerCommandeLocale(commande: CommandeLocale) {
  const toutes = lire<CommandeLocale[]>(CLE_COMMANDES, []).filter((c) => c.numero !== commande.numero);
  ecrire(CLE_COMMANDES, [commande, ...toutes].slice(0, 20));
}

export function PanierProvider({ children }: { children: ReactNode }) {
  const [brut, setBrut] = useState<LignePanier[]>([]);
  const [pret, setPret] = useState(false);

  // Lecture différée : le stockage local n'existe pas pendant le rendu serveur.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec le stockage du navigateur
    setBrut(lire<LignePanier[]>(CLE_PANIER, []));
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) ecrire(CLE_PANIER, brut);
  }, [brut, pret]);

  const lignes = useMemo<LignePanierDetaillee[]>(
    () =>
      brut.flatMap((l) => {
        const plat = PLATS.find((p) => p.id === l.platId);
        return plat ? [{ ...l, plat, sousTotal: plat.prix * l.quantite }] : [];
      }),
    [brut],
  );

  const ajouter = useCallback((platId: string, quantite = 1, note?: string) => {
    setBrut((prev) => {
      const existant = prev.find((l) => l.platId === platId);
      if (existant) {
        return prev.map((l) =>
          l.platId === platId ? { ...l, quantite: l.quantite + quantite, note: note ?? l.note } : l,
        );
      }
      return [...prev, { platId, quantite, note }];
    });
  }, []);

  const modifierQuantite = useCallback((platId: string, quantite: number) => {
    setBrut((prev) =>
      quantite <= 0 ? prev.filter((l) => l.platId !== platId) : prev.map((l) => (l.platId === platId ? { ...l, quantite } : l)),
    );
  }, []);

  const vider = useCallback(() => setBrut([]), []);

  const passerCommande = useCallback<PanierContexte["passerCommande"]>(
    ({ mode, emplacement, paiement }) => {
      const maintenant = new Date();
      const numero = String(140 + Math.floor(Math.random() * 860)).padStart(4, "0");
      const commande: CommandeLocale = {
        numero,
        statut: "recue",
        mode,
        emplacement,
        paiement,
        payee: false,
        passeeA: formatHeure(maintenant),
        creeeLe: maintenant.getTime(),
        lignes: lignes.map((l) => ({
          platId: l.platId,
          nom: l.plat.nom,
          quantite: l.quantite,
          prixUnitaire: l.plat.prix,
          note: l.note,
        })),
        note: lignes.find((l) => l.note)?.note,
        historique: [
          {
            heure: formatHeure(maintenant),
            statut: "Reçue",
            detail: "Commande passée depuis le menu",
            couleur: COULEUR_HISTORIQUE.recue,
          },
        ],
      };
      enregistrerCommandeLocale(commande);
      setBrut([]);
      return commande;
    },
    [lignes],
  );

  const valeur = useMemo<PanierContexte>(
    () => ({
      lignes,
      nombreArticles: lignes.reduce((s, l) => s + l.quantite, 0),
      total: lignes.reduce((s, l) => s + l.sousTotal, 0),
      pret,
      ajouter,
      modifierQuantite,
      vider,
      passerCommande,
    }),
    [lignes, pret, ajouter, modifierQuantite, vider, passerCommande],
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function usePanier(): PanierContexte {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePanier doit être utilisé dans <PanierProvider>.");
  return ctx;
}
