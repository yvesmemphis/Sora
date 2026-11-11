"use client";

/**
 * Panier du client (sans compte), conservé dans le navigateur.
 * La commande est envoyée à `POST /public/orders/` ; le jeton de suivi signé
 * renvoyé par le backend sert d'identifiant à l'écran de suivi.
 * Le suivi public ne renvoie ni prix ni emplacement : un récapitulatif est
 * donc gardé localement, indexé par le jeton.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cleIdempotence } from "../api/client";
import { passerCommandePublique } from "../api/commandes";
import { montant, referenceSaisie, TYPE_EMPLACEMENT } from "../api/conversions";
import { MODES_PAIEMENT } from "../statuts";
import type { LigneCommande, ModePaiement, ModeService, Plat } from "../types";
import { useMenu } from "./menu";

export interface LignePanier {
  platId: string;
  quantite: number;
  note?: string;
}

export interface LignePanierDetaillee extends LignePanier {
  plat: Plat;
  sousTotal: number;
}

/** Récapitulatif local d'une commande passée depuis ce navigateur. */
export interface CommandeLocale {
  jeton: string;
  numero: string;
  mode: ModeService;
  emplacement: string;
  paiement: ModePaiement;
  total: number;
  lignes: LigneCommande[];
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
  passerCommande: (choix: { mode: ModeService; emplacement: string; paiement: ModePaiement }) => Promise<CommandeLocale>;
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

export function lireCommandeLocale(jeton: string): CommandeLocale | undefined {
  return lire<CommandeLocale[]>(CLE_COMMANDES, []).find((c) => c.jeton === jeton);
}

function enregistrerCommandeLocale(commande: CommandeLocale) {
  const toutes = lire<CommandeLocale[]>(CLE_COMMANDES, []).filter((c) => c.jeton && c.jeton !== commande.jeton);
  ecrire(CLE_COMMANDES, [commande, ...toutes].slice(0, 20));
}

export function PanierProvider({ children }: { children: ReactNode }) {
  const { menu } = useMenu();
  const [brut, setBrut] = useState<LignePanier[]>([]);
  const [pret, setPret] = useState(false);
  // Une clé par panier : un double envoi (réseau lent) ne crée pas deux commandes.
  const cle = useRef<string | null>(null);

  // Lecture différée : le stockage local n'existe pas pendant le rendu serveur.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec le stockage du navigateur
    setBrut(lire<LignePanier[]>(CLE_PANIER, []));
    setPret(true);
  }, []);

  useEffect(() => {
    if (pret) ecrire(CLE_PANIER, brut);
    cle.current = null;
  }, [brut, pret]);

  const lignes = useMemo<LignePanierDetaillee[]>(
    () =>
      brut.flatMap((l) => {
        const plat = menu?.plats.find((p) => p.id === l.platId);
        return plat ? [{ ...l, plat, sousTotal: plat.prix * l.quantite }] : [];
      }),
    [brut, menu],
  );

  const ajouter = useCallback((platId: string, quantite = 1, note?: string) => {
    setBrut((prev) => {
      const existant = prev.find((l) => l.platId === platId);
      if (existant) {
        return prev.map((l) =>
          l.platId === platId ? { ...l, quantite: Math.min(20, l.quantite + quantite), note: note ?? l.note } : l,
        );
      }
      return [...prev, { platId, quantite, note }];
    });
  }, []);

  const modifierQuantite = useCallback((platId: string, quantite: number) => {
    setBrut((prev) =>
      quantite <= 0
        ? prev.filter((l) => l.platId !== platId)
        : prev.map((l) => (l.platId === platId ? { ...l, quantite: Math.min(20, quantite) } : l)),
    );
  }, []);

  const vider = useCallback(() => setBrut([]), []);

  const passerCommande = useCallback<PanierContexte["passerCommande"]>(
    async ({ mode, emplacement, paiement }) => {
      cle.current ??= cleIdempotence();
      const type = TYPE_EMPLACEMENT[mode];
      const reference = mode === "emporter" ? "" : referenceSaisie(type, emplacement);
      const rep = await passerCommandePublique(
        {
          mode,
          emplacement: mode === "emporter" ? undefined : { type, reference },
          // Le backend ne stocke pas le mode de paiement : il est annoncé dans la note.
          note: `Paiement prévu : ${MODES_PAIEMENT[paiement].libelle.toLowerCase()}`,
          lignes: lignes.map((l) => ({ platId: l.platId, quantite: l.quantite, note: l.note })),
        },
        cle.current,
      );
      const commande: CommandeLocale = {
        jeton: rep.tracking_token,
        numero: rep.number,
        mode,
        emplacement: mode === "emporter" ? "Au comptoir" : emplacement,
        paiement,
        total: montant(rep.total),
        creeeLe: Date.now(),
        lignes: lignes.map((l) => ({
          platId: l.platId,
          nom: l.plat.nom,
          quantite: l.quantite,
          prixUnitaire: l.plat.prix,
          note: l.note,
        })),
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
      pret: pret && menu !== null,
      ajouter,
      modifierQuantite,
      vider,
      passerCommande,
    }),
    [lignes, pret, menu, ajouter, modifierQuantite, vider, passerCommande],
  );

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function usePanier(): PanierContexte {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePanier doit être utilisé dans <PanierProvider>.");
  return ctx;
}
