/**
 * Types du domaine partagés par tous les écrans.
 * Les noms de rôles reprennent ceux du backend Django (`common/constants.py`).
 */

export type RoleBackend = "ADMIN" | "MANAGER" | "WAITER" | "KITCHEN";

/** Cycle de vie d'une commande, identique sur tous les écrans. */
export type StatutCommande =
  | "recue" // passée, délai de désistement en cours
  | "confirmee" // fin du délai : transmise à la cuisine
  | "preparation"
  | "prete"
  | "servie" // servie en salle ou livrée en chambre
  | "annulee"
  | "refusee";

export type ModeService = "table" | "chambre" | "emporter";

export type ModePaiement = "especes" | "carte";

export type Disponibilite = "disponible" | "temporaire" | "epuise";

export type Categorie = "Entrées" | "Plats" | "Grillades" | "Accompagnements" | "Desserts" | "Boissons";

export interface Plat {
  id: string;
  slug: string;
  nom: string;
  description: string;
  descriptionLongue?: string;
  categorie: Categorie;
  prix: number; // FCFA
  preparationMin: number;
  disponibilite: Disponibilite;
  allergenes: string[];
  versionRecette?: string;
}

export interface LigneCommande {
  platId: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  note?: string;
}

export interface EvenementCommande {
  heure: string; // « 19 h 41 »
  statut: string;
  detail: string;
  couleur: string;
}

export interface Commande {
  numero: string; // « 0142 »
  statut: StatutCommande;
  mode: ModeService;
  emplacement: string; // « 204 », « 6 », ou « Au comptoir »
  passeeA: string; // « 19 h 31 »
  paiement: ModePaiement;
  payee: boolean;
  lignes: LigneCommande[];
  note?: string;
  historique: EvenementCommande[];
  /** Secondes écoulées depuis la confirmation (écran cuisine). */
  ecouleSec?: number;
  enRetard?: boolean;
  nouvelle?: boolean;
}

export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  role: "Administrateur" | "Gestionnaire" | "Serveur" | "Cuisine";
  statut: "Actif" | "Invité" | "Suspendu";
  derniereConnexion: string;
}
