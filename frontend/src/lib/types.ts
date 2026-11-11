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
  | "livraison" // en cours de livraison (chambre)
  | "servie" // servie en salle ou livrée en chambre
  | "cloturee" // soldée et clôturée
  | "annulee"
  | "refusee";

export type ModeService = "table" | "chambre" | "emporter";

export type ModePaiement = "especes" | "carte";

export type Disponibilite = "disponible" | "temporaire" | "epuise";

/** Nom de catégorie, défini côté backend (`/categories/`). */
export type Categorie = string;

export interface Plat {
  /** UUID du plat côté backend (`Dish.id`). */
  id: string;
  /** Identifiant d'URL : identique à `id` depuis le branchement de l'API. */
  slug: string;
  nom: string;
  description: string;
  descriptionLongue?: string;
  categorie: Categorie;
  prix: number; // FCFA
  /** Temps de préparation, inconnu pour le menu public. */
  preparationMin: number | null;
  disponibilite: Disponibilite;
  allergenes: string[];
  versionRecette?: string;
  /** URL absolue de la photo, si le plat en a une. */
  image?: string | null;
  categorieId?: string;
  publie?: boolean;
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
  /** Identifiant numérique côté backend (`Order.id`). */
  id?: number;
  numero: string; // « 251111-0042 »
  statut: StatutCommande;
  mode: ModeService;
  emplacement: string; // « 204 », « 6 », ou « Au comptoir »
  passeeA: string; // « 19 h 31 »
  /** Mode de paiement annoncé ; non stocké par le backend pour l'instant. */
  paiement: ModePaiement;
  payee: boolean;
  /** Total calculé par le serveur, en FCFA. */
  total?: number;
  /** Horodatage ISO de création. */
  creeeLe?: string;
  /** Horodatage ISO du dernier changement (début du statut courant). */
  majLe?: string;
  source?: "PUBLIC" | "STAFF";
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
