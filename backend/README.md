# Backend

API REST multi-restaurant construite avec Django 5.2, Django REST Framework,
PostgreSQL, Redis, Channels et JWT. Elle couvre les comptes et rôles, le menu,
les emplacements, les commandes publiques et du personnel, la cuisine en temps
réel, les paiements, les stocks, la production, l'audit et les prévisions.

## Prérequis

- Python 3.10 ou supérieur (la version Python 3.14 a été utilisée pour les
  validations locales).
- PostgreSQL pour le développement normal et les migrations.
- Redis pour le cache, les limites de débit et les canaux en développement et en
  production.

Les tests utilisent les réglages `test` et remplacent le cache et les canaux par
des implémentations en mémoire. Ils peuvent être lancés avec SQLite sans
installer PostgreSQL ou Redis.

## Installation locale (PowerShell)

Depuis la racine du dépôt :

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements\dev.txt
Copy-Item .env.example .env
```

Ouvre `backend\.env` et définis `DATABASE_URL` et `REDIS_URL` selon tes services
locaux. Génère trois valeurs indépendantes pour `DJANGO_SECRET_KEY`,
`JWT_SIGNING_KEY` et `TRACKING_TOKEN_KEY` :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Exécute cette commande trois fois et reporte chaque résultat dans la variable
correspondante de `.env`. Ne partage jamais ce fichier et ne le committe pas :
il est exclu par `.gitignore`. `.env.example` est le modèle sans secret à garder
à jour pour l'équipe. Configure également `TIME_ZONE` avec le fuseau horaire du
restaurant (par exemple `Europe/Paris`).

### PostgreSQL partagé avec Supabase

Pour éviter d'installer PostgreSQL sur chaque poste, crée un projet ou une
branche Supabase dédiée au développement de l'équipe. Ne branche pas les
ordinateurs des développeurs sur la branche marquée `PRODUCTION`. Dans Supabase,
ouvre `Connect`, copie l'URI PostgreSQL (pas la clé publishable), puis remplace
`DATABASE_URL` dans chaque fichier local `backend\.env`. Remplace le marqueur du
mot de passe par le mot de passe de la base; n'ajoute jamais cette valeur à Git.

Le mode `config.settings.development` utilise un cache et un channel layer en
mémoire : Redis n'a donc pas besoin d'être installé pour le développement local
avec un seul serveur Django. Les événements WebSocket ne sont alors ni partagés
entre plusieurs processus ni persistants. La configuration de production
continue d'utiliser Redis; un Redis hébergé sera nécessaire lors du déploiement.

Django reste propriétaire du schéma : applique ses migrations uniquement sur
la base Supabase de développement, après avoir vérifié l'URL configurée :

```powershell
python manage.py check
python manage.py migrate
```

Ne lance pas `migrate` contre une branche ou un projet Supabase de production
pour les besoins de développement. Les commandes `supabase init` et
`supabase link` ne sont pas nécessaires pour connecter Django à PostgreSQL.

### Images des plats avec Supabase Storage

Dans le projet Supabase de développement, crée un bucket `dish-images` et
active sa lecture publique pour que le menu puisse afficher les images sans
connexion. Les écritures restent faites par Django côté serveur. Dans Storage,
ouvre les réglages S3 et récupère l'endpoint, la région et les deux clés S3.
Ces clés donnent un accès serveur complet à Storage : garde-les uniquement dans
`backend\.env`, jamais dans le frontend, Git ou un message.

Renseigne les six paramètres `SUPABASE_STORAGE_*` et `SUPABASE_S3_*` de
`backend\.env.example`. L'endpoint S3 a la forme
`https://<project-ref>.storage.supabase.co/storage/v1/s3`; l'URL publique de base
a la forme `https://<project-ref>.supabase.co/storage/v1/object/public/dish-images`.
Remplace `<project-ref>` par celui du projet de développement et utilise la
région exacte indiquée par Supabase. Si tous les paramètres Storage restent
vides, Django continue d'enregistrer localement dans `media/`. S'ils sont
partiellement renseignés, Django refuse de démarrer pour éviter une configuration
incomplète.

Aucune migration de base n'est requise pour changer le stockage des fichiers.
Les images déjà présentes dans `media/` doivent cependant être téléversées
séparément dans le bucket.

## Initialisation et lancement

Une fois PostgreSQL et Redis configurés et démarrés :

```powershell
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

L'interface d'administration est disponible à
<http://127.0.0.1:8000/admin/>. Le serveur local utilise
`config.settings.development`. Pour sélectionner un autre environnement,
fournis le module explicitement, par exemple :

```powershell
python manage.py check --settings=config.settings.production
```

Le réglage production impose HTTPS et des origines CORS/CSRF explicites. Ne
l'utilise pas pour le serveur local HTTP.

## Tests et qualité

Depuis `backend\` :

```powershell
python -m pytest -q
ruff check . --ignore RUF012,BLE001
python manage.py check
python manage.py makemigrations --check --dry-run
```

Pour exécuter les tests avec SQLite en mémoire sous PowerShell, sans serveur
PostgreSQL :

```powershell
$env:DATABASE_URL = "sqlite:///:memory:"
python -m pytest -q
Remove-Item Env:DATABASE_URL
```

`requirements\base.txt` contient les dépendances d'exécution,
`requirements\dev.txt` ajoute les outils de développement et `requirements\lock.txt`
capture les versions résolues dans l'environnement de développement. Après une
modification des dépendances, réinstalle-les puis régénère le lock :

```powershell
python -m pip install -r requirements\dev.txt
python -c "import subprocess, sys; result = subprocess.run([sys.executable, '-m', 'pip', 'freeze'], check=True, capture_output=True, text=True); open('requirements/lock.txt', 'w', encoding='utf-8', newline='').write(result.stdout)"
```

## Structure

- `apps\accounts\` : utilisateur personnalisé à connexion par email, endpoints
  JWT, réinitialisation de mot de passe, invitation et gestion du personnel.
- `apps\core\` : réglages singleton du restaurant.
- `apps\audit\` : journal append-only, filtrage des clés sensibles et lecture
  réservée aux administrateurs.
- `apps\menu\` et `apps\locations\` : catalogue privé, menu public, images et
  emplacements.
- `apps\orders\` et `apps\kitchen\` : commandes, transitions, idempotence,
  file REST et notifications WebSocket avec ticket à usage unique.
- `apps\payments\`, `apps\inventory\`, `apps\production\` et
  `apps\analytics\` : encaissements/remboursements, stock/recettes, pertes,
  indicateurs et prévisions.
- `apps\notifications\` : configuration des notifications et événements de
  cuisine publiés après validation des transactions.
- `common\` : rôles et statuts partagés, modèle de base UUID, gestion uniforme
  des erreurs, pagination et permissions par rôle.
- `config\settings\base.py` : configuration commune ; `development.py`,
  `test.py` et `production.py` spécialisent chaque environnement.
- `tests\` : tests et fixtures partagés du projet.

## API disponible

Toutes les routes sont préfixées par `/api/v1/` :

| Méthode | Route | Accès | Fonction |
| --- | --- | --- | --- |
| `POST` | `/auth/login/` | Public, limité en débit | Obtenir les jetons d'accès et de rafraîchissement |
| `POST` | `/auth/refresh/` | Public, limité en débit | Rafraîchir un jeton |
| `POST` | `/auth/logout/` | Authentifié | Révoquer un jeton de rafraîchissement |
| `GET` | `/auth/me/` | Authentifié | Lire le profil courant |
| `POST` | `/auth/password-reset/` | Public, limité en débit | Demander un lien de réinitialisation ; réponse identique si le compte n'existe pas |
| `POST` | `/auth/password-reset/confirm/` | Public, limité en débit | Définir un nouveau mot de passe avec `uid` et `token` |
| `GET` | `/staff/` | Administrateur | Lister le personnel |
| `POST` | `/staff/` | Administrateur | Inviter un employé |
| `GET` / `PATCH` | `/staff/{id}/` | Administrateur | Lire ou modifier un employé |
| `POST` | `/staff/{id}/resend-invitation/` | Administrateur | Renvoyer l'invitation si le mot de passe n'est pas encore défini |
| `GET` / `PATCH` | `/settings/` | Tous / Administrateur | Lire ou modifier les réglages |
| `GET` | `/audit/` | Administrateur | Lire les événements; filtrer avec `date_from`, `date_to`, `actor`, `module`, `action` ou `result` |
| `GET` | `/public/menu/` | Public | Lire les plats publiés et leur disponibilité |
| `GET` / `POST` | `/categories/`, `/dishes/`, `/locations/` | Selon rôle | Gérer le menu et les emplacements |
| `POST` | `/public/orders/` | Public | Créer une commande au prix serveur |
| `GET` | `/public/track/{token}/` | Public avec jeton signé | Suivre une commande sans compte |
| `POST` | `/public/track/{token}/cancel/` | Public avec jeton signé | Annuler une commande encore reçue dans le délai autorisé |
| `GET` / `POST` | `/orders/` | Personnel autorisé | Filtrer, lister et créer les commandes |
| `POST` / `PATCH` | `/orders/{id}/transition/`, `/orders/{id}/location/` | Personnel autorisé | Faire évoluer une commande ou modifier son emplacement avant la préparation |
| `GET` / `POST` | `/kitchen/queue/`, `/kitchen/tickets/` | Cuisine | Lire la file et créer un ticket WebSocket |
| `GET` / `POST` | `/orders/{id}/payments/` | Salle / responsables | Consulter et enregistrer un paiement |
| `GET` | `/payments/?date=AAAA-MM-JJ` | Administrateur / gestionnaire | Lister les paiements du jour et agréger les encaissements/remboursements par moyen et devise |
| `POST` | `/payments/{id}/refunds/`, `/refunds/{id}/process/` | Responsables | Demander et traiter un remboursement |
| `GET` / `POST` | `/suppliers/`, `/ingredients/`, `/stock-lots/` | Selon rôle | Gérer fournisseurs, ingrédients et lots |
| `GET` | `/stock-movements/`, `/inventory-alerts/` | Responsables | Lire mouvements et alertes |
| `GET` / `POST` | `/production-batches/`, `/waste-declarations/` | Cuisine / responsables | Suivre la production et les pertes |
| `GET` | `/analytics/overview/`, `/analytics/forecasts/` | Selon rôle | Lire les indicateurs et prévisions |
| `GET` | `/health/` | Public | Vérifier PostgreSQL et Redis |
| `GET` | `/schema/`, `/docs/` | Administrateur | Consulter le schéma OpenAPI et Swagger |

Les accès JWT durent 10 minutes ; les jetons de rafraîchissement durent 7 jours
et sont renouvelés avec liste de révocation. Les rôles métier sont `ADMIN`,
`MANAGER`, `WAITER` et `KITCHEN`. L'API du personnel est actuellement réservée à
`ADMIN`. Le délai d'annulation client est configurable avec
`withdrawal_delay_minutes` dans les réglages (5 minutes par défaut) ; seules les
commandes publiques encore au statut `RECEIVED` peuvent être annulées ainsi.
Les nouvelles commandes et leurs paiements utilisent le XOF par défaut ; la
migration de devise conserve en EUR les commandes déjà enregistrées sans devise.
Les chiffres d'affaires de l'aperçu restent regroupés par devise.
La liste des commandes conserve son format historique par défaut ; `status`,
`date` et `created_after` filtrent les résultats, et `page` ou `page_size`
active une réponse paginée. Le menu public indique aussi `is_available` et
`preparation_time` pour les plats publiés, y compris ceux qui sont momentanément
indisponibles. Une commande peut contenir `payment_method_expected` avec un
moyen déjà reconnu par l'API; l'emplacement est modifiable uniquement avant
le début de la préparation. Les rapports de paiements séparent toujours les
devises et soustraient les remboursements traités à la date demandée.

## Points restant à faire

- Démarrer PostgreSQL et Redis, puis appliquer les migrations avec
  `python manage.py migrate` ; ne pas supposer que la base locale ou son rôle
  PostgreSQL existent.
- Lancer `python manage.py seed_demo` avec `DEMO_PASSWORD` pour préparer les
  comptes, le catalogue, les stocks et les historiques de démonstration. Hors
  `DEBUG`, la commande exige explicitement `--force-demo`.
- Générer et valider le schéma avec
  `python manage.py spectacular --file schema.yml --validate --fail-on-warn`.
- La CI GitHub exécute Ruff, les migrations, les tests, l'audit des dépendances
  et la validation OpenAPI avec PostgreSQL et Redis.
- Le script `scripts\backup.ps1` sauvegarde PostgreSQL et les médias dans
  `BACKUP_DIR`; il ne supprime pas automatiquement les anciennes sauvegardes.
- Lire [la procédure de déploiement, sauvegarde et restauration](docs/operations.md)
  avant toute mise en production.
- En environnement réel, remplacer le backend email console par un fournisseur
  configuré et surveillé.
