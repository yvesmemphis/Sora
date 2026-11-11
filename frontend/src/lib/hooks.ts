"use client";

import { useEffect, useState } from "react";
import { formatHeure } from "./format";

/**
 * Compteur de secondes depuis le montage du composant.
 * Démarre après l'hydratation pour éviter tout écart entre serveur et navigateur.
 */
export function useTic(intervalleMs = 1000): number {
  const [tic, setTic] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTic((t) => t + 1), intervalleMs);
    return () => clearInterval(iv);
  }, [intervalleMs]);
  return tic;
}

/** Heure courante « 19 h 42 », ou chaîne vide avant l'hydratation. */
export function useHorloge(): string {
  const [heure, setHeure] = useState("");
  useEffect(() => {
    const maj = () => setHeure(formatHeure(new Date()));
    maj();
    const iv = setInterval(maj, 15_000);
    return () => clearInterval(iv);
  }, []);
  return heure;
}

/** État de la connexion réseau du navigateur. */
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(true);
  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);
  return enLigne;
}

/** Horodatage courant (ms), rafraîchi chaque seconde ; 0 avant l'hydratation. */
export function useMaintenant(intervalleMs = 1000): number {
  const [maintenant, setMaintenant] = useState(0);
  useEffect(() => {
    const maj = () => setMaintenant(Date.now());
    maj();
    const iv = setInterval(maj, intervalleMs);
    return () => clearInterval(iv);
  }, [intervalleMs]);
  return maintenant;
}
