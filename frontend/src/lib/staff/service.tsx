"use client";

/**
 * État du service en cours, partagé par les écrans du personnel (salle, cuisine).
 * Source : API `orders` du backend, actualisée toutes les 5 s. En cuisine, le
 * WebSocket `ws/kitchen/` déclenche en plus une actualisation immédiate.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  changerEmplacementCommande,
  changerStatutCommande,
  commandeDepuisApi,
  creerCommande,
  enregistrerPaiement,
  trouverEmplacement,
  type CommandeApi,
} from "../api/commandes";
import { api, API_URL, messageErreur } from "../api/client";
import { listerEmplacements, type EmplacementApi } from "../api/emplacements";
import { changerDisponibilite, chargerCartePersonnel } from "../api/menu";
import { ACTUALISATION_MS } from "../statuts";
import type { Commande, Disponibilite, ModePaiement, ModeService, Plat, StatutCommande } from "../types";
import { useSession } from "./session";

export const MOTIFS_ANNULATION = ["Demande du client", "Plat indisponible", "Erreur de saisie", "Autre"] as const;

/** Statuts encore « vivants » pendant le service. */
const ACTIFS: StatutCommande[] = ["recue", "confirmee", "preparation", "prete", "livraison", "servie"];

interface ServiceContexte {
  commandes: Commande[];
  chargement: boolean;
  /** Dernière actualisation réussie (ms), 0 si jamais. */
  actualiseLe: number;
  erreurReseau: string | null;
  selection: string | null;
  selectionner: (numero: string | null) => void;
  changerStatut: (numero: string, statut: StatutCommande, note?: string) => Promise<boolean>;
  marquerPayee: (numero: string, mode: ModePaiement) => Promise<boolean>;
  annuler: (numero: string, motif: string, commentaire: string) => Promise<boolean>;
  /** Corrige la table ou la chambre (avant le début de la préparation). */
  changerEmplacement: (numero: string, saisie: string) => Promise<boolean>;
  creer: (c: {
    mode: ModeService;
    emplacement: string;
    paiement: ModePaiement;
    lignes: { platId: string; quantite: number }[];
    note?: string;
  }) => Promise<Commande | null>;
  carte: { categories: string[]; plats: Plat[] };
  emplacements: EmplacementApi[];
  signalerIndisponibilite: (platId: string, d: Disponibilite) => Promise<boolean>;
  actualiser: () => Promise<void>;
}

const Ctx = createContext<ServiceContexte | null>(null);

function estDuJour(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function ServiceProvider({ children }: { children: ReactNode }) {
  const { utilisateur } = useSession();
  const role = utilisateur.role;
  const [brutes, setBrutes] = useState<CommandeApi[]>([]);
  const [emplacements, setEmplacements] = useState<EmplacementApi[]>([]);
  const [carte, setCarte] = useState<{ categories: string[]; plats: Plat[] }>({ categories: [], plats: [] });
  const [selection, setSelection] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [actualiseLe, setActualiseLe] = useState(0);
  const [erreurReseau, setErreurReseau] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const enCours = useRef(false);

  const actualiser = useCallback(async () => {
    if (enCours.current) return;
    enCours.current = true;
    try {
      // Fenêtre glissante de 36 h : couvre un service qui passe minuit sans recharger tout l'historique.
      const depuis = new Date(new Date().getTime() - 36 * 3_600_000).toISOString();
      const liste = await api<CommandeApi[]>(`/orders/?created_after=${encodeURIComponent(depuis)}`);
      setBrutes(liste);
      setActualiseLe(Date.now());
      setErreurReseau(null);
    } catch (e) {
      setErreurReseau(messageErreur(e));
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, []);

  const chargerReferentiels = useCallback(async () => {
    const [locs, menu] = await Promise.allSettled([listerEmplacements(), chargerCartePersonnel()]);
    if (locs.status === "fulfilled") setEmplacements(locs.value);
    if (menu.status === "fulfilled") setCarte(menu.value);
  }, []);

  // Actualisation périodique.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial depuis l API
    void actualiser();
    void chargerReferentiels();
    const iv = setInterval(() => void actualiser(), ACTUALISATION_MS);
    const ivRef = setInterval(() => void chargerReferentiels(), 60_000);
    return () => {
      clearInterval(iv);
      clearInterval(ivRef);
    };
  }, [actualiser, chargerReferentiels]);

  // Cuisine : WebSocket temps réel (ticket à usage unique, 30 s).
  useEffect(() => {
    if (role !== "KITCHEN") return;
    let ws: WebSocket | null = null;
    let relance: ReturnType<typeof setTimeout> | undefined;
    let ferme = false;
    const ouvrir = async () => {
      try {
        const { ticket } = await api<{ ticket: string }>("/kitchen/tickets/", { method: "POST" });
        if (ferme) return;
        const base = new URL(API_URL);
        const proto = base.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(`${proto}//${base.host}/ws/kitchen/?ticket=${encodeURIComponent(ticket)}`);
        ws.onmessage = () => void actualiser();
        ws.onclose = () => {
          if (!ferme) relance = setTimeout(ouvrir, 10_000);
        };
      } catch {
        if (!ferme) relance = setTimeout(ouvrir, 30_000);
      }
    };
    void ouvrir();
    return () => {
      ferme = true;
      clearTimeout(relance);
      ws?.close();
    };
  }, [role, actualiser]);

  const commandes = useMemo(
    () =>
      brutes
        .map((c) => commandeDepuisApi(c, { emplacements }))
        .filter((c) => ACTIFS.includes(c.statut) || (c.creeeLe && estDuJour(c.creeeLe)))
        .sort((a, b) => (b.creeeLe ?? "").localeCompare(a.creeeLe ?? "")),
    [brutes, emplacements],
  );

  const parNumero = useCallback((numero: string) => commandes.find((c) => c.numero === numero), [commandes]);

  const executer = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      setErreurAction(null);
      try {
        const r = await action();
        void actualiser();
        return r;
      } catch (e) {
        setErreurAction(messageErreur(e));
        return null;
      }
    },
    [actualiser],
  );

  const changerStatut = useCallback<ServiceContexte["changerStatut"]>(
    async (numero, statut, note = "") => {
      const c = parNumero(numero);
      if (!c?.id) return false;
      const id = c.id;
      return (await executer(() => changerStatutCommande(id, statut, note))) !== null;
    },
    [parNumero, executer],
  );

  const marquerPayee = useCallback<ServiceContexte["marquerPayee"]>(
    async (numero, mode) => {
      const c = parNumero(numero);
      if (!c?.id || c.total === undefined) return false;
      const id = c.id;
      const total = c.total;
      return (await executer(() => enregistrerPaiement(id, total, mode))) !== null;
    },
    [parNumero, executer],
  );

  const annuler = useCallback<ServiceContexte["annuler"]>(
    async (numero, motif, commentaire) => changerStatut(numero, "annulee", [motif, commentaire].filter(Boolean).join(" · ")),
    [changerStatut],
  );

  const changerEmplacement = useCallback<ServiceContexte["changerEmplacement"]>(
    async (numero, saisie) => {
      const c = parNumero(numero);
      if (!c?.id) return false;
      const loc = trouverEmplacement(c.mode, saisie, emplacements);
      if (!loc) {
        setErreurAction(`${c.mode === "table" ? "Table" : "Chambre"} « ${saisie} » inconnue ou inactive.`);
        return false;
      }
      const id = c.id;
      return (await executer(() => changerEmplacementCommande(id, loc.id))) !== null;
    },
    [parNumero, emplacements, executer],
  );

  const creer = useCallback<ServiceContexte["creer"]>(
    async ({ mode, emplacement, paiement, lignes, note }) => {
      const loc = trouverEmplacement(mode, emplacement, emplacements);
      if (mode !== "emporter" && !loc) {
        setErreurAction(`${mode === "table" ? "Table" : "Chambre"} « ${emplacement} » inconnue ou inactive.`);
        return null;
      }
      const cree = await executer(() => creerCommande({ mode, location: loc?.id ?? null, paiement, notes: note, lignes }));
      if (!cree) return null;
      setBrutes((prev) => [cree, ...prev.filter((c) => c.id !== cree.id)]);
      const commande = commandeDepuisApi(cree, { emplacements });
      setSelection(commande.numero);
      return commande;
    },
    [emplacements, executer],
  );

  const signalerIndisponibilite = useCallback<ServiceContexte["signalerIndisponibilite"]>(
    async (platId, d) => {
      const ok = (await executer(() => changerDisponibilite(platId, d))) !== null;
      if (ok) {
        setCarte((prev) => ({
          ...prev,
          plats: prev.plats.map((p) => (p.id === platId ? { ...p, disponibilite: d } : p)),
        }));
      }
      return ok;
    },
    [executer],
  );

  const valeur = useMemo<ServiceContexte>(
    () => ({
      commandes,
      chargement,
      actualiseLe,
      erreurReseau,
      selection,
      selectionner: setSelection,
      changerStatut,
      marquerPayee,
      annuler,
      changerEmplacement,
      creer,
      carte,
      emplacements,
      signalerIndisponibilite,
      actualiser,
    }),
    [commandes, chargement, actualiseLe, erreurReseau, selection, changerStatut, marquerPayee, annuler, changerEmplacement, creer, carte, emplacements, signalerIndisponibilite, actualiser],
  );

  return (
    <Ctx.Provider value={valeur}>
      {children}
      {erreurAction ? (
        <div role="alert" className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div className="flex max-w-xl items-center gap-3 rounded-2xl bg-danger px-5 py-3.5 text-[15px] font-bold text-creme shadow-[0_16px_32px_-16px_rgba(0,0,0,.6)]">
            <span>{erreurAction}</span>
            <button type="button" onClick={() => setErreurAction(null)} className="ml-2 cursor-pointer rounded-lg px-2 py-1 underline">
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useService(): ServiceContexte {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useService doit être utilisé dans <ServiceProvider>.");
  return ctx;
}
