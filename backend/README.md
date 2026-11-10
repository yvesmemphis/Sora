# Backend

Socle API REST multi-restaurant construit avec Django 5.2, Django REST
Framework, PostgreSQL, Redis, Channels et JWT. Le dépôt fournit la structure,
les réglages par environnement, l'authentification initiale et le cadre partagé.
Les applications métier autres que les comptes et l'audit sont encore des
squelettes : leurs modèles, règles métier et API restent à implémenter.

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
ruff check .
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
- `apps\audit\` : modèle d'événement d'audit append-only et service d'écriture.
- `apps\analytics\`, `core\`, `inventory\`, `kitchen\`, `locations\`, `menu\`,
  `notifications\`, `orders\`, `payments\` et `production\` : squelettes
  d'applications, à compléter.
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
| `GET` | `/staff/{uuid}/` | Administrateur | Lire un employé |
| `PATCH` | `/staff/{uuid}/` | Administrateur | Modifier son rôle ou son activation |

Les accès JWT durent 10 minutes ; les jetons de rafraîchissement durent 7 jours
et sont renouvelés avec liste de révocation. Les rôles métier sont `ADMIN`,
`MANAGER`, `WAITER` et `KITCHEN`. L'API du personnel est actuellement réservée à
`ADMIN`.

## Points restant à faire

- Démarrer PostgreSQL et Redis et appliquer les migrations sur une base
  configurée ; ne pas supposer que la base locale ou son rôle PostgreSQL existent.
- Construire le modèle et les migrations de chaque application métier.
- Ajouter les permissions, services, endpoints et tests des domaines métier.
- Définir et documenter les routes globales, le déploiement, la supervision et la
  gestion des secrets de production.
- En environnement réel, remplacer le backend email console par un fournisseur
  configuré et surveillé.
