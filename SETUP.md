# Cabinet Médical — Pointage · Guide de démarrage

## 1. Configurer Supabase

1. Aller sur https://supabase.com → créer un projet
2. Dans **SQL Editor**, coller et exécuter tout le contenu de `supabase/schema.sql`
3. Dans **Settings > API**, copier :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## 3. Lancer en local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173

## 4. Déployer sur Vercel

```bash
npm install -g vercel
vercel
```

Dans Vercel → Settings → Environment Variables, ajouter :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Codes PIN

| Utilisateur | PIN  | Rôle      |
|-------------|------|-----------|
| Sophie      | 2001 | Assistante|
| Camille     | 2002 | Assistante|
| Léa         | 2003 | Assistante|
| Dr. Admin   | 1234 | Admin     |

## Fonctionnalités

### Assistantes
- Pointer arrivée/départ avec horloge en temps réel
- Voir son planning de la semaine
- Consulter son historique mensuel

### Admin (Dr.)
- Voir tous les pointages en temps réel (websocket Supabase)
- Modifier / supprimer n'importe quel pointage
- Gérer le planning hebdomadaire par assistante (clic sur cellule)
- Export CSV mensuel par assistante avec totaux d'heures
