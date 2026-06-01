-- Migration : Dessa co-admin + contrainte rôle étendue
-- Exécuter dans Supabase SQL Editor

-- 1. Dessa devient co-admin
UPDATE users SET role = 'admin' WHERE id = '00000000-0000-0000-0000-000000000002';

-- 2. Étendre la contrainte pour accepter le rôle 'manager'
--    (nécessaire pour l'ajout de nouvelles employées via l'Annuaire)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('assistant', 'manager', 'admin'));

-- 3. Autoriser les opérations INSERT/DELETE sur la table users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
