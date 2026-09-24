-- ============================================================
-- MIGRATION : statut actif des collaborateurs + poste de Bledi
-- Exécuter dans Supabase SQL Editor
-- ============================================================
-- Ne touche ni à pointage_events ni à access_logs : les comptes
-- inactifs sont seulement masqués de l'affichage (planning équipe,
-- annuaire), leur historique reste intact.
-- ============================================================

-- 1. Colonne "actif" (tous les comptes existants restent actifs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Talya désactivée (uniquement son compte)
UPDATE users SET actif = FALSE WHERE id = '00000000-0000-0000-0000-000000000003';

-- 3. Poste affiché pour les collaborateurs ajoutés directement dans Supabase
ALTER TABLE users ADD COLUMN IF NOT EXISTS poste TEXT;
UPDATE users SET poste = 'Assistant médical' WHERE name = 'Bledi';
