"use client";

/**
 * Carte publique (`GET /public/menu/`), chargée une fois par visite et partagée
 * par la carte, la fiche plat et le panier. Elle est rafraîchie toutes les minutes
 * pour refléter les plats rendus indisponibles par la cuisine.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messageErreur } from "../api/client";
import { chargerMenuPublic, type MenuPublic } from "../api/menu";
import type { ModeService, Plat } from "../types";

interface MenuContexte {
  menu: MenuPublic | null;
  erreur: string | null;
  recharger: () => void;
  trouverPlat: (id: string) => Plat | undefined;
}

const Ctx = createContext<MenuContexte | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuPublic | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const charger = () =>
      chargerMenuPublic(ctrl.signal)
        .then((m) => {
          setMenu(m);
          setErreur(null);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setErreur(messageErreur(e));
        });
    void charger();
    const iv = setInterval(() => void charger(), 60_000);
    return () => {
      ctrl.abort();
      clearInterval(iv);
    };
  }, [version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  const trouverPlat = useCallback((id: string) => menu?.plats.find((p) => p.id === id || p.slug === id), [menu]);

  const valeur = useMemo(() => ({ menu, erreur, recharger, trouverPlat }), [menu, erreur, recharger, trouverPlat]);
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useMenu(): MenuContexte {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMenu doit être utilisé dans <MenuProvider>.");
  return ctx;
}

/* ------------------------------------------------- Emplacement du QR code */

/**
 * Le QR code d'une table ou d'une chambre ouvre `/menu?table=T6` ou `/menu?chambre=204`.
 * L'emplacement est mémorisé pour pré-remplir le panier.
 */
export interface EmplacementQr {
  mode: ModeService;
  reference: string;
}

const CLE_QR = "sora.emplacement";

export function memoriserEmplacementQr(recherche: URLSearchParams) {
  const table = recherche.get("table");
  const chambre = recherche.get("chambre");
  // QR généré par le backend (`/public/menu/qr/`) : `?mode=TAKEAWAY` pour le comptoir.
  const valeur: EmplacementQr | null = table
    ? { mode: "table", reference: table }
    : chambre
      ? { mode: "chambre", reference: chambre }
      : recherche.get("mode") === "TAKEAWAY"
        ? { mode: "emporter", reference: "" }
        : null;
  if (!valeur) return;
  try {
    window.localStorage.setItem(CLE_QR, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible */
  }
}

export function lireEmplacementQr(): EmplacementQr | null {
  try {
    const brut = window.localStorage.getItem(CLE_QR);
    return brut ? (JSON.parse(brut) as EmplacementQr) : null;
  } catch {
    return null;
  }
}
