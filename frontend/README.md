# Frontend Maison Sora

Interface web de la plateforme de gestion du restaurant (MVP v1.2), construite avec
**Next.js 16 (App Router)**, **React 19**, **TypeScript** et **Tailwind CSS 4**.
Elle reprend fidèlement les maquettes « Écrans app Maison Sora » pour les cinq intervenants.

## Démarrer

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local   # URL de l'API Django
npm run dev
```

Ouvrir <http://localhost:3000>. La page d'accueil donne accès aux cinq espaces.

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (vérifie aussi les types) |
| `npm run lint` | ESLint |

## Espaces et écrans

| Espace | Route | Écrans (maquettes) | Appareil |
| --- | --- | --- | --- |
| Client | `/menu`, `/menu/[slug]`, `/panier`, `/suivi/[numero]` | C1 carte, C2 fiche plat, C3 panier, C4 désistement 5 min, C5 suivi | Smartphone, sans compte |
| Salle | `/salle`, `/salle/nouvelle` | S1 commandes du service, S2 saisie, S3 annulation | Tablette |
| Cuisine | `/cuisine` | K1 tableau 3 colonnes, K2 hors ligne + indisponibilité, K3 ticket 80 mm | Écran fixe, fond sombre |
| Gestion | `/gestion/…` | G1 tableau de bord, G2 menu et recettes, G3 stocks, G4 production, G5 prévisions IA, G6 clôture de caisse | Ordinateur ou tablette |
| Administration | `/admin/…` | A1 utilisateurs et permissions, A2 QR, emplacements et paramètres, A3 journal | Ordinateur |
| Personnel | `/connexion` | Connexion JWT et mot de passe oublié | Tous |

## Organisation du code

```
src/
├── app/                 Routes (un dossier par espace) et layouts
├── components/
│   ├── ui/              Socle commun : icônes, boutons, badges de statut, modale…
│   ├── espace/          Barre latérale et tableaux des espaces bureau
│   ├── client/ salle/ cuisine/ gestion/ admin/ auth/
└── lib/
    ├── api/             Client HTTP de l'API Django (JWT, erreurs normalisées)
    ├── demo/            Données de démonstration issues des maquettes
    ├── client/          Panier du client (stockage navigateur)
    ├── staff/           État du service partagé salle / cuisine
    ├── statuts.ts       Libellés, icônes et couleurs des statuts
    ├── format.ts        « 6 500 FCFA », « 19 h 30 »
    └── types.ts         Types du domaine
```

### Charte

Les couleurs, polices et statuts sont définis une seule fois :

- **Jetons de couleur** dans `src/app/globals.css` (`bg-vert`, `text-terracotta`, `bg-creme`,
  `text-or`, `bg-nuit`…). Ne pas écrire de couleur en dur dans les composants.
- **Polices** : Fraunces (titres, chiffres clés) et DM Sans (interface), chargées par `next/font`.
- **Statuts** : `lib/statuts.ts`. Règle de la charte : un état n'est jamais indiqué par la couleur
  seule, toujours une icône et un libellé (composant `Badge`).

## Branchement au backend Django

Le client `lib/api/client.ts` cible `NEXT_PUBLIC_API_URL` (par défaut
`http://127.0.0.1:8000/api/v1`). Le backend autorise déjà `http://localhost:3000` en CORS.

Déjà branché sur l'API existante :

- `POST /auth/login/`, `/auth/refresh/`, `/auth/logout/`, `GET /auth/me/`,
  `/auth/password-reset/` → `lib/api/auth.ts` et la page `/connexion`.
  Après connexion, chaque rôle est redirigé vers son espace
  (`ADMIN` → `/admin`, `MANAGER` → `/gestion`, `WAITER` → `/salle`, `KITCHEN` → `/cuisine`).
- `/staff/` → `lib/api/personnel.ts` (prêt, l'écran A1 utilise encore les données de démo).

En attente des API métier du backend (`menu`, `orders`, `inventory`, `production`,
`analytics`, `payments`) : les écrans fonctionnent avec `lib/demo/*`. Pour brancher un domaine,
remplacer l'import des données de démo par un appel dans `lib/api/` sans toucher aux composants.

À prévoir :

- Protection des routes du personnel selon le rôle (middleware / proxy Next.js).
- Jetons stockés dans un cookie httpOnly plutôt que `localStorage` avant la production.
- Temps réel cuisine / salle : actualisation 5 s, puis WebSockets (Django Channels).
