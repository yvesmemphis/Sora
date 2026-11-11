"use client";

/**
 * État du service en cours, partagé par les écrans du personnel (salle, cuisine).
 * Source : API `orders` du backend, actualisée toutes les 5 s. En cuisine, le
 * WebSocket `ws/kitchen/` déclenche en plus une actualisation immédiate.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  changerStatutCommande,
  commandeDepuisApi,
  creerCommande,
  enregistrerPaiement,
  listerCommandes,
  listerPaiements,
  trouverEmplacement,
  type CommandeApi,
} from "../api/commandes";
import { api, API_URL, messageErreur } from "../api/client";
import { montant } from "../api/conversions";
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

const CLE_PAIEMENTS = "sora.modes-paiement";

/** Le backend ne stocke pas le mode de paiement annoncé : on le garde sur l'appareil. */
function lireModes(): Record<string, ModePaiement> {
  try {
    return JSON.parse(window.localStorage.getItem(CLE_PAIEMENTS) ?? "{}") as Record<string, ModePaiement>;
  } catch {
    return {};
  }
}

function ecrireMode(id: number, mode: ModePaiement) {
  try {
    const modes = lireModes();
    modes[id] = mode;
    window.localStorage.setItem(CLE_PAIEMENTS, JSON.stringify(modes));
  } catch {
    /* stockage indisponible */
  }
}

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
  const [payees, setPayees] = useState<Record<number, boolean>>({});
  const [modes, setModes] = useState<Record<string, ModePaiement>>({});
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
      const liste = await listerCommandes();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage du navigateur
    setModes(lireModes());
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
        .map((c) => commandeDepuisApi(c, { emplacements, payee: payees[c.id], paiement: modes[c.id] }))
        .filter((c) => ACTIFS.includes(c.statut) || (c.creeeLe && estDuJour(c.creeeLe)))
        .sort((a, b) => (b.creeeLe ?? "").localeCompare(a.creeeLe ?? "")),
    [brutes, emplacements, payees, modes],
  );

  const parNumero = useCallback((numero: string) => commandes.find((c) => c.numero === numero), [commandes]);

  // Paiements de la commande sélectionnée (salle et gestion uniquement).
  const selId = selection ? parNumero(selection)?.id : undefined;
  useEffect(() => {
    if (!selId || role === "KITCHEN") return;
    const total = montant(brutes.find((c) => c.id === selId)?.total);
    listerPaiements(selId)
      .then((ps) => {
        const confirmes = ps.filter((p) => p.status === "CONFIRMED" || p.status === "REFUNDED");
        // Le serveur ne voit pas les montants : un paiement confirmé vaut paiement en totalité.
        const paye = confirmes.some((p) => p.amount === undefined) || confirmes.reduce((s, p) => s + montant(p.amount), 0) >= total;
        setPayees((prev) => ({ ...prev, [selId]: paye }));
      })
      .catch(() => undefined);
  }, [selId, role, brutes]);

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
      const ok = (await executer(() => enregistrerPaiement(id, total, mode))) !== null;
      if (ok) {
        setPayees((prev) => ({ ...prev, [id]: true }));
        ecrireMode(id, mode);
        setModes((prev) => ({ ...prev, [id]: mode }));
      }
      return ok;
    },
    [parNumero, executer],
  );

  const annuler = useCallback<ServiceContexte["annuler"]>(
    async (numero, motif, commentaire) => changerStatut(numero, "annulee", [motif, commentaire].filter(Boolean).join(" · ")),
    [changerStatut],
  );

  const creer = useCallback<ServiceContexte["creer"]>(
    async ({ mode, emplacement, paiement, lignes, note }) => {
      const loc = trouverEmplacement(mode, emplacement, emplacements);
      if (mode !== "emporter" && !loc) {
        setErreurAction(`${mode === "table" ? "Table" : "Chambre"} « ${emplacement} » inconnue ou inactive.`);
        return null;
      }
      const cree = await executer(() => creerCommande({ mode, location: loc?.id ?? null, notes: note, lignes }));
      if (!cree) return null;
      ecrireMode(cree.id, paiement);
      setModes((prev) => ({ ...prev, [cree.id]: paiement }));
      setBrutes((prev) => [cree, ...prev.filter((c) => c.id !== cree.id)]);
      const commande = commandeDepuisApi(cree, { emplacements, paiement });
      setSelection(commande.numero);
      return commande;
    },
    [emplacements, executer],
  );

  const signalerIndisponibilite = useCallback<ServiceContexte["signalerIndisponibilite"]>(
    async (platId, d) => {
      const ok = (await executer(() => changerDisponibilite(platId, d === "disponible"))) !== null;
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
      creer,
      carte,
      emplacements,
      signalerIndisponibilite,
      actualiser,
    }),
    [commandes, chargement, actualiseLe, erreurReseau, selection, changerStatut, marquerPayee, annuler, creer, carte, emplacements, signalerIndisponibilite, actualiser],
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
