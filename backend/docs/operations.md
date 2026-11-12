# Exploitation et déploiement

## Variables et secrets

Utiliser `config.settings.production` et fournir les paramètres depuis
l'environnement du service, jamais depuis un fichier commité. Les valeurs
`DJANGO_SECRET_KEY`, `JWT_SIGNING_KEY` et `TRACKING_TOKEN_KEY` doivent être
indépendantes et générées pour chaque environnement. Définir aussi
`DATABASE_URL`, `REDIS_URL`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` et `TIME_ZONE`.
Le renouvellement et la déconnexion par cookie exigent aussi l'en-tête
`X-CSRFToken`; le client doit lire le cookie `csrftoken` émis à la connexion.
Si le frontend et l'API sont sur des sites différents, configurer le cookie avec
`SameSite=None` et `Secure`.

PostgreSQL et Redis ne doivent pas être exposés à Internet. Le compte applicatif
doit avoir uniquement les droits nécessaires sur sa base.

## Déploiement

1. Installer les dépendances verrouillées et fournir les variables de production.
2. Vérifier la configuration avec `python manage.py check --deploy`.
3. Appliquer les migrations avec `python manage.py migrate`.
4. Collecter les fichiers statiques avec `python manage.py collectstatic --noinput`.
5. Démarrer l'application ASGI, par exemple avec
   `daphne -b 127.0.0.1 -p 8000 config.asgi:application`.
6. Exposer le service uniquement derrière un proxy HTTPS configuré pour
   transmettre `X-Forwarded-Proto` et les WebSockets.
7. Vérifier `/health/`, `/api/v1/schema/` et les journaux sans y enregistrer de
   secrets ni le contenu des requêtes de paiement.

L'API WebSocket cuisine est `ws://<hôte>/ws/kitchen/` derrière le proxy; en
production, le client doit utiliser `wss://`.

## Sauvegarde

Le script `scripts/backup.ps1` utilise `DATABASE_URL`, `BACKUP_DIR` et
optionnellement `PG_DUMP_PATH`. Il produit une archive PostgreSQL au format
custom et, si `media/` existe, une archive séparée des images. Il ne supprime
pas les sauvegardes anciennes.

Exemple de planification quotidienne dans PowerShell, exécuté avec le compte de
service prévu pour les sauvegardes :

```powershell
$action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument `
  "-NoProfile -File C:\Sora\backend\scripts\backup.ps1" -WorkingDirectory `
  "C:\Sora\backend"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00am
Register-ScheduledTask -TaskName "sora-backend-backup" -Action $action -Trigger $trigger
```

Protéger les archives par chiffrement et les copier hors du serveur applicatif.
Définir une politique de rétention séparément, après validation des exigences
de conservation.

## Tâches planifiées et emails

Planifier `python manage.py process_public_order_timeouts` au moins une fois par
minute pour confirmer les commandes après leur délai de désistement. Planifier
`python manage.py generate_forecasts` une fois par jour après la clôture du
service pour produire la prévision du lendemain. Les scripts
`scripts\register_order_timeout_task.ps1` et
`scripts\register_forecast_task.ps1` configurent ces tâches sous Windows; sous
Linux, utiliser cron ou le planificateur du service avec le même interpréteur et
le même répertoire de travail.

Les emails de commande sont envoyés individuellement aux membres actifs de
l'équipe concernés. Configurer `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
`EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` et `DEFAULT_FROM_EMAIL` dans
l'environnement du service avant d'activer les commandes publiques.

## Restauration

Restaurer d'abord vers une base vide de test, jamais directement vers la base de
production. Exemple avec PostgreSQL installé :

```powershell
$env:PGPASSWORD = Read-Host "Mot de passe PostgreSQL de test"
pg_restore --exit-on-error --no-owner `
   --host=localhost --username=restaurant --dbname=restaurant_restore_test `
  "D:\backups\restaurant_YYYYMMDD_HHMMSS.dump"
Remove-Item Env:PGPASSWORD
```

Vérifier ensuite les tables, les comptes, les commandes et les médias restaurés,
puis lancer `python manage.py check` et les tests applicatifs avec la base de
restauration. Ne promouvoir une procédure de restauration qu'après un exercice
complet documenté.

## Données de démonstration

En développement, `python manage.py seed_demo` crée les rôles, réglages,
emplacements, plats, stock, recettes, production et historique analytique. La
variable d'environnement `DEMO_PASSWORD` est obligatoire. Hors `DEBUG`, la
commande exige `--force-demo`; ne jamais utiliser de mot de passe de démonstration
en production.

Pour supprimer les données de démonstration, lancer
`python manage.py purge_demo --confirm`. Seuls les objets explicitement marqués
par `seed_demo` sont supprimés; les objets référencés hors démo sont conservés,
et les événements d'audit append-only restent dans le journal.