# Plan de test — Maison Sora

Série de tests pour vérifier que l'application fonctionne de bout en bout, sur une
**base vide** (aucune donnée fictive). Chaque test indique l'action, puis le résultat
attendu. Cocher la case quand le test passe ; noter l'écart sinon.

- **Espaces** : Client (QR, sans compte) · Salle · Cuisine · Gestion · Admin.
- **Rôles** : `ADMIN`, `MANAGER`, `WAITER`, `KITCHEN`.
- **Ordre** : les sections dépendent les unes des autres (on crée d'abord le référentiel,
  puis le menu, puis on commande). Les suivre dans l'ordre.

---

## 0. Préparation

### 0.1 Tests automatiques

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check . --ignore RUF012,BLE001
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py spectacular --file schema.yml --validate --fail-on-warn
```

```powershell
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **T0.1** — Backend : `142 passed, 1 skipped` au minimum, aucun échec.
- [ ] **T0.2** — Ruff : `All checks passed!` ; migrations : `No changes detected` ; schéma valide.
- [ ] **T0.3** — Front : `tsc`, `lint` et `build` sans erreur.

### 0.2 Base vide

```powershell
cd backend
Remove-Item db.sqlite3 -ErrorAction SilentlyContinue   # chemin de DATABASE_URL dans backend/.env
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser    # e-mail + mot de passe de l'administrateur
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

```powershell
cd frontend
Copy-Item .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev                         # http://localhost:3000
```

Sur une base existante qui contient le jeu de démo : `python manage.py purge_demo --confirm`
(supprime uniquement les objets marqués par `seed_demo`). Ne jamais lancer `seed_demo` sur la
base partagée.

Dans le navigateur de test, vider le `localStorage` du site (`sora.acces`, `sora.panier`,
`sora.commandes`, `sora.emplacement`) et ses cookies.

- [ ] **T0.4** — `http://localhost:8000/api/v1/public/menu/` répond `200` avec `"dishes": []`.
- [ ] **T0.5** — `http://localhost:3000/menu` affiche une carte vide, sans erreur.

> **Important** : ouvrir le front sur `http://localhost:3000` (pas `127.0.0.1`), sinon le
> cookie `csrftoken` de l'API n'est pas lisible et la session ne se renouvelle pas.

---

## 1. Authentification et rôles

- [ ] **T1.1 Connexion admin** — `/connexion`, identifiants du superutilisateur.
  → Redirection vers `/admin`. Le cookie `sora_refresh` (HttpOnly) et `csrftoken` existent ;
  `localStorage` contient `sora.acces`, **pas** de jeton de rafraîchissement.
- [ ] **T1.2 Mauvais mot de passe** → message d'erreur, pas de redirection.
- [ ] **T1.3 Limite de tentatives** — 6 échecs de suite → la 6ᵉ est refusée (429).
- [ ] **T1.4 Renouvellement silencieux** — dans la console : `localStorage.setItem("sora.acces","x")`,
  puis recharger `/admin`. → La page s'affiche ; `sora.acces` contient un nouveau jeton.
- [ ] **T1.5 Déconnexion** — bouton « Se déconnecter ». → Retour à `/connexion`, `sora.acces`
  supprimé ; un `POST /auth/refresh/` répond `401`.
- [ ] **T1.6 Garde des espaces** — déconnecté, ouvrir `/gestion`. → Redirection vers
  `/connexion?suite=/gestion`, puis retour sur `/gestion` après connexion.
- [ ] **T1.7 Mot de passe oublié** — « Mot de passe oublié » avec un e-mail inconnu, puis connu.
  → Même message dans les deux cas. En dev, le lien apparaît dans la console du backend ;
  `/reset-password?uid=…&token=…` permet de définir un nouveau mot de passe.

## 2. Administration (ADMIN)

### 2.1 Utilisateurs (`/admin`)

- [ ] **T2.1 Inviter** un serveur, un cuisinier et un gestionnaire (e-mails de test).
  → Statut « Invité » ; e-mail d'invitation visible dans la console du backend.
- [ ] **T2.2 Activer le compte** — suivre le lien d'invitation, définir le mot de passe.
  → Connexion possible ; redirection selon le rôle (`/salle`, `/cuisine`, `/gestion`).
- [ ] **T2.3 Renvoyer l'invitation** d'un compte non activé → nouvel e-mail.
- [ ] **T2.4 Suspendre** un compte → connexion refusée pour ce compte.
- [ ] **T2.5 Droits** — connecté en serveur, ouvrir `/gestion` et `/admin`. → Accès refusé.
  En cuisine, `/salle` est refusé. En gestionnaire, `/admin` est refusé.

### 2.2 Rôles (`/admin/roles`)

- [ ] **T2.6** — La matrice est en lecture seule et correspond aux droits réels (testés en T2.5).
  Le nombre de comptes actifs par rôle est juste.

### 2.3 Paramètres (`/admin/parametres`)

- [ ] **T2.7** — Modifier le nom du restaurant, le délai de désistement (ex. 3 min), un jour fermé
  (dimanche), des horaires (lundi 11:00–23:00), décocher « Virement ». Enregistrer.
  → « Paramètres enregistrés » ; après rechargement, les valeurs sont conservées.
- [ ] **T2.8** — Décocher tous les modes de paiement puis enregistrer. → Erreur « Au moins un
  mode de paiement doit être accepté ».
- [ ] **T2.9** — Devise invalide (`12`) → erreur de validation.
- [ ] **T2.10** — Désactiver « Commandes depuis le menu QR » → sur `/menu`, le bouton du panier
  affiche « Commandes fermées ». Réactiver ensuite.

### 2.4 QR et emplacements (`/admin/qr`)

- [ ] **T2.11** — Ajouter la table `6` et la chambre `204`. → Elles apparaissent ; la table est
  enregistrée en `T6`.
- [ ] **T2.12** — Le QR « Menu · à emporter » s'affiche (image PNG générée par l'API).
- [ ] **T2.13** — Choisir « Table 6 » : le QR affiché cible
  `http://localhost:3000/menu?table=T6&mode=DINE_IN…`. Télécharger et imprimer fonctionnent.
- [ ] **T2.14** — Désactiver la table 6 (clic sur la pastille) → barrée ; une commande QR sur
  cette table est refusée. La réactiver.

## 3. Référentiel et menu (MANAGER)

### 3.1 Référentiel (`/gestion/referentiel`)

- [ ] **T3.1** — Créer les catégories « Entrées », « Plats », « Desserts ». Monter « Plats » en
  premier. → L'ordre est conservé après rechargement.
- [ ] **T3.2** — Créer un fournisseur (nom, contact, téléphone).
- [ ] **T3.3** — Créer l'ingrédient « Poulet » (kg, seuil 2, max 20, fournisseur) et « Riz » (kg).
- [ ] **T3.4** — Nom d'ingrédient en double → erreur affichée.
- [ ] **T3.5 Réception** — Poulet : 10 kg, 3 000 FCFA/kg, péremption dans 7 jours.
  → « Lot de Poulet réceptionné ». Sur `/gestion/stocks` : 10 kg, mouvement « Entrée ».
- [ ] **T3.6** — Péremption antérieure à la réception → erreur.
- [ ] **T3.7 Inventaire** — Lot de Poulet, « Quantité comptée » 9,8, motif « Inventaire ».
  → Mouvement « Ajustement » ; stock 9,8 kg.
- [ ] **T3.8 Perte** — 0,3 kg, motif « Casse ». → Mouvement « Perte » ; stock 9,5 kg.

### 3.2 Menu et recettes (`/gestion/menu`)

- [ ] **T3.9** — « Nouveau plat » : « Poulet yassa », catégorie Plats, 6 500 FCFA, 15 min.
  Enregistrer. → Le plat apparaît dans la liste.
- [ ] **T3.10 Photo** — cliquer sur la vignette, choisir un JPEG/PNG/WebP. → La photo s'affiche
  dans le panneau, la liste et la carte client. Un fichier non image est refusé.
- [ ] **T3.11 Recette** — « Saisir la recette » : Poulet 0,25 kg. « Publier la version ».
  → « Recette · version 1 », coût matière 750 FCFA (12 % du prix).
- [ ] **T3.12 Nouvelle version** — ajouter Riz 0,15 kg et publier. → Version 2 ; les commandes
  déjà préparées gardent la version 1 (voir T7.3).
- [ ] **T3.13 Disponibilité** — passer le plat en « Épuisé », enregistrer. → Sur `/menu`, le plat
  est marqué « Épuisé pour ce service » et ne peut pas être ajouté. Remettre « Disponible ».
- [ ] **T3.14** — Créer au moins un plat par catégorie pour la suite.

## 4. Parcours client (sans compte, téléphone)

Ouvrir `http://localhost:3000/menu?table=T6` (scan du QR de la table 6), idéalement en
navigation privée ou avec la taille « mobile ».

- [ ] **T4.1 Carte** — Les catégories, plats, prix et photos s'affichent. Le bandeau indique les
  horaires du jour (ou « Fermé aujourd'hui ») et les modes de paiement acceptés.
- [ ] **T4.2 Recherche** — taper « yassa » → seul le plat correspondant reste.
- [ ] **T4.3 Fiche plat** — ouvrir un plat : description, allergènes, temps de préparation.
- [ ] **T4.4 Panier** — ajouter 2 × Poulet yassa, modifier les quantités. → Total juste.
  Mode « Sur place », table **6** pré-remplie par le QR.
- [ ] **T4.5 Paiement** — seuls les modes acceptés (T2.7) sont proposés.
- [ ] **T4.6 Commander** → page de suivi « Commande reçue », numéro `AAMMJJ-0001`, compte à
  rebours égal au délai de désistement réglé.
- [ ] **T4.7 Idempotence** — double-clic rapide sur « Commander » → une seule commande créée.
- [ ] **T4.8 Table inconnue** — saisir la table `99` → « Table inconnue. Vérifiez le numéro. »
- [ ] **T4.9 Limite** — 4ᵉ commande en attente sur la même table → refusée (3 maximum).
- [ ] **T4.10 Désistement** — sur une nouvelle commande, « Annuler ma commande » avant la fin du
  délai. → « Commande annulée ».
- [ ] **T4.11 Délai dépassé** — attendre la fin du compte à rebours : le bouton disparaît ;
  un appel direct à `POST /public/track/{jeton}/cancel/` répond `409`.
- [ ] **T4.12 Chambre** — `/menu?chambre=204`, commander en mode « En chambre ».
- [ ] **T4.13 À emporter** — QR comptoir (`/menu?mode=TAKEAWAY`), commander « À emporter ».
- [ ] **T4.14 Suivi** — garder la page `/suivi/…` ouverte pendant les étapes 5 et 6 : elle passe
  seule à « Confirmée », « Préparation », « Prête », puis « Servie ».

## 5. Salle (WAITER)

Se connecter avec le compte serveur sur `/salle` (tablette).

- [ ] **T5.1** — La commande QR de la table 6 apparaît en moins de 5 s, statut « Reçue ».
- [ ] **T5.2 Confirmer** — « Confirmer et transmettre en cuisine ». → « Confirmée ».
- [ ] **T5.3 Emplacement** — sur une commande reçue/confirmée, « Modifier l'emplacement » vers
  la table 6 ou une table inexistante. → Changement accepté / erreur « inconnue ou inactive ».
- [ ] **T5.4 Nouvelle commande** — `/salle/nouvelle` : table 6, 1 plat + note, espèces.
  → Créée en « Confirmée » ou « Reçue » selon « Confirmation automatique ».
- [ ] **T5.5 Annulation** — annuler une commande reçue avec un motif. → « Annulée », motif visible
  dans l'historique et le journal.
- [ ] **T5.6** — Après la cuisine (section 6) : « Marquer comme servie » puis « Marquer comme
  payé » (espèces). → Statut « Clôturée », « Payée ».
- [ ] **T5.7 Paiement avant service** — payer une commande prête, puis la servir. → Passe
  aussi en « Clôturée ».
- [ ] **T5.8 Chambre** — commande en chambre : « En livraison » puis « Servie / livrée ».

## 6. Cuisine (KITCHEN)

Se connecter avec le compte cuisine sur `/cuisine`.

- [ ] **T6.1** — Seules les commandes confirmées / en préparation / prêtes apparaissent ; une
  commande « Reçue » n'est pas visible.
- [ ] **T6.2 Temps réel** — confirmer une commande en salle → elle apparaît en cuisine sans
  recharger (WebSocket, sinon interrogation 5 s), avec le halo « Nouvelle ».
- [ ] **T6.3** — « Commencer la préparation » → « Au feu », chrono en cours.
- [ ] **T6.4 Stock** — après T6.3, `/gestion/stocks` montre un mouvement « Consommation recette
  Poulet yassa v… » et le stock diminué (2 × 0,25 kg).
- [ ] **T6.5** — « Marquer la commande prête » → « Au passe » ; la salle la voit « Prête ».
- [ ] **T6.6 Indisponibilité** — « Plat indisponible » → « Épuisé ». → Le plat est épuisé sur la
  carte client et dans `/gestion/menu`.
- [ ] **T6.7 Ticket** — « Imprimer le ticket » ouvre l'aperçu d'impression.
- [ ] **T6.8 Rupture** — préparer une commande dont le stock est insuffisant → la préparation
  n'est pas bloquée, une alerte « Stock bas » est créée (tableau de bord, journal).

## 7. Gestion (MANAGER)

- [ ] **T7.1 Tableau de bord** (`/gestion`) — CA net, nombre de commandes, panier moyen, plus
  vendus, heure de pointe et marge brute estimée cohérents avec les commandes passées
  (ex. 2 × 6 500 = 13 000 FCFA, coût 1 500 FCFA → marge 88,5 %). Basculer Jour/Semaine/Mois.
- [ ] **T7.2 Commandes du jour** (`/gestion/commandes`) — toutes les commandes, filtres par statut.
- [ ] **T7.3 Historique des recettes** — une commande préparée avant T3.12 a consommé la
  version 1, une commande préparée après, la version 2 (`/recipe-consumptions/`).
- [ ] **T7.4 Stocks** — filtres « Stock bas » et « Péremption proche » ; valeur du stock juste.
- [ ] **T7.5 Production** (`/gestion/production`) — « Nouveau lot de production » : Poulet
  yassa, 20 portions, 900 FCFA. Déclarer en fin de service : restant 4 = réutilisable 1 +
  jeté 3, motif. → Déclaration enregistrée ; taux d'invendus 20 %. Un restant ≠ réutilisable +
  jeté est refusé.
- [ ] **T7.6 Prévisions** (`/gestion/previsions`) — `python manage.py generate_forecasts` puis
  valider / rejeter une prévision. → Statut mis à jour, visible sur le tableau de bord.
- [ ] **T7.7 Clôture de caisse** (`/gestion/caisse`) — totaux espèces / carte égaux aux
  paiements du jour ; saisir le compté, « Clôturer la journée ». → « Journée clôturée »,
  « Clôture enregistrée par … ». Recharger : toujours clôturée. Une 2ᵉ clôture du même
  responsable le même jour est refusée (409).
- [ ] **T7.8** — Une commande servie non payée apparaît dans « commandes servies non marquées
  payées » ; « Marquer payée (espèces) » la solde.

## 8. Journal (`/admin/journal`, ADMIN)

- [ ] **T8.1** — Chaque action des sections 2 à 7 apparaît avec son acteur et son heure
  (connexion exceptée) : commande, statut, paiement, prix, recette, stock, production,
  clôture, paramètres, invitation.
- [ ] **T8.2** — Filtres Commandes / Paiements / Stocks / Menu / Comptes, recherche et période.
- [ ] **T8.3 Export** — « Exporter CSV » → fichier `journal-AAAA-MM-JJ.csv` complet pour la
  période (et le module Commandes, Paiements ou Menu s'il est filtré).

## 9. Robustesse

- [ ] **T9.1 Backend arrêté** — couper le serveur API : la salle affiche « Serveur injoignable »,
  sans planter ; relancer → reprise automatique.
- [ ] **T9.2 Session expirée** — attendre plus de 10 min sur un écran du personnel puis agir.
  → L'action passe (renouvellement par cookie), sans retour à la connexion.
- [ ] **T9.3 Mobile** — carte, panier et suivi utilisables à 375 px de large, sans défilement
  horizontal.
- [ ] **T9.4 Expiration automatique** — avec « Confirmation automatique » activée,
  `python manage.py process_public_order_timeouts` confirme les commandes QR dont le délai est
  écoulé.
- [ ] **T9.5 Nettoyage** — après la campagne, revenir à une base vide (0.2) avant la mise en
  service.

---

## Limites connues (non bloquantes)

- « Signaler un retard » en cuisine reste local à l'écran (aucune API).
- La salle est rafraîchie toutes les 5 s (pas de canal WebSocket dédié).
- Production non liée aux plats : pas de colonnes « Prévu » / « Vendu » en production.
- Les e-mails (invitations, notifications de commande) sortent dans la console en
  développement ; configurer `EMAIL_*` en production.
