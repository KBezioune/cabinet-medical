-- ============================================================
-- MIGRATION — Rôles corrects (Imene/Dessa/Talya) + logs d'accès enrichis
-- Exécuter dans Supabase SQL Editor. Idempotent (peut être rejouée sans risque).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RÔLES — Imene, Dessa et Talya sont toutes au niveau "assistant"
--    (mêmes droits : pointage, planning, congés, profil — aucun accès admin).
--    Leur intitulé de poste (Apprentie / Assistante médicale) est géré
--    côté application dans src/lib/localData.js (champ "poste"), qui n'est
--    pas répliqué dans cette table.
-- ────────────────────────────────────────────────────────────
UPDATE users SET role = 'assistant' WHERE id = '00000000-0000-0000-0000-000000000001'; -- Imene
UPDATE users SET role = 'assistant' WHERE id = '00000000-0000-0000-0000-000000000002'; -- Dessa
UPDATE users SET role = 'assistant' WHERE id = '00000000-0000-0000-0000-000000000003'; -- Talya

-- ────────────────────────────────────────────────────────────
-- 2. TABLE access_logs — ajout du type d'événement détaillé
-- ────────────────────────────────────────────────────────────
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS type_evenement TEXT;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS detail TEXT;

-- Rétro-remplissage des anciens logs (connexions uniquement, avant cette migration)
UPDATE access_logs SET type_evenement = 'connexion_reussie' WHERE type_evenement IS NULL AND action = 'login_success';
UPDATE access_logs SET type_evenement = 'connexion_echec'   WHERE type_evenement IS NULL AND action = 'login_failure';

CREATE INDEX IF NOT EXISTS idx_access_logs_type ON access_logs(type_evenement);

-- Types d'événements utilisés par l'application (référence) :
--   connexion_reussie · connexion_echec · pointage_arrivee · pointage_depart · conge_soumis
