# Super Divers Watch

Veille et gestion de collection Dragon Ball Super Divers (version japonaise).
Next.js 16, TypeScript, Tailwind CSS 4, Supabase.

## État actuel

Fonctionnel : connexion, navigation (bureau et iPhone), thème sombre/clair, tableau de bord branché sur la base,
récupération quotidienne du taux BCE EUR/JPY, instantané quotidien de la valeur de la collection.
Les autres rubriques affichent clairement l’étape à laquelle elles seront développées.

## Base de données

Dans Supabase > SQL Editor, exécuter dans l’ordre :
1. `database/migrations/20261101000000_schema_initial.sql`
2. `database/seed.sql`
3. `database/migrations/20261101000100_droits_taches_planifiees.sql`

## Variables d’environnement

Voir `.env.example`. Dans Vercel : Project > Settings > Environment Variables.

## Développement local (optionnel)

    npm install
    cp .env.example .env.local
    npm run dev

Les scripts SQL sont rangés dans `database/` (et non `supabase/`) pour que l’intégration GitHub de Supabase
ne tente pas de les rejouer automatiquement : ils ont déjà été appliqués à la main.
