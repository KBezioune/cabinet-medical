-- ============================================================
-- MIGRATION COMPLÈTE — Cabinet Médical Dr Bezioune
-- Exécuter intégralement dans Supabase SQL Editor
-- Toutes les instructions sont idempotentes (IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLE users — colonnes contrat manquantes
-- ────────────────────────────────────────────────────────────

-- Mettre à jour la contrainte de rôle pour accepter 'manager'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('assistant', 'manager', 'admin'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_entree      DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS taux_activite    NUMERIC(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS heures_par_jour  NUMERIC(4,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS droit_vacances   INTEGER DEFAULT 25;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vacances_par_an  INTEGER DEFAULT 25;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salaire_brut     NUMERIC(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS type_contrat     TEXT;

-- Rendre les droits complets sur users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. TABLE conges
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conges (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  type        TEXT        NOT NULL
                CHECK (type IN ('vacances','maladie','conge','formation','absence')),
  date_debut  DATE        NOT NULL,
  date_fin    DATE        NOT NULL,
  motif       TEXT,
  statut      TEXT        NOT NULL DEFAULT 'en_attente'
                CHECK (statut IN ('en_attente','approuve','refuse')),
  traite_par  TEXT,
  traite_le   TIMESTAMPTZ,
  commentaire TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE conges DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conges TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_conges_user    ON conges(user_id);
CREATE INDEX IF NOT EXISTS idx_conges_statut  ON conges(statut);
CREATE INDEX IF NOT EXISTS idx_conges_dates   ON conges(date_debut, date_fin);

-- ────────────────────────────────────────────────────────────
-- 3. TABLE access_logs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT,
  action      TEXT        NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE access_logs DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.access_logs TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_access_logs_user       ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. TABLE notifications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  type       TEXT,
  message    TEXT        NOT NULL,
  lu         BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_lu   ON notifications(user_id, lu);

-- ────────────────────────────────────────────────────────────
-- 5. TABLE expense_reports (notes de frais)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_reports (
  id               UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          TEXT           NOT NULL,
  date             DATE           NOT NULL,
  montant          NUMERIC(10,2)  NOT NULL,
  categorie        TEXT           NOT NULL
                     CHECK (categorie IN ('repas','transport','materiel','autre')),
  description      TEXT,
  justificatif_url TEXT,
  statut           TEXT           NOT NULL DEFAULT 'en_attente'
                     CHECK (statut IN ('en_attente','approuve','refuse')),
  traite_par       TEXT,
  traite_le        TIMESTAMPTZ,
  commentaire      TEXT,
  created_at       TIMESTAMPTZ    DEFAULT NOW()
);
ALTER TABLE expense_reports DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reports TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_expense_reports_user ON expense_reports(user_id);

-- ────────────────────────────────────────────────────────────
-- 6. TABLE messages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id TEXT        NOT NULL,
  to_user_id   TEXT,          -- NULL = broadcast toute l'équipe
  content      TEXT        NOT NULL,
  read         BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.messages TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_messages_from    ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to      ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 7. TABLE planning_taches
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_taches (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  date        DATE        NOT NULL,
  tache       TEXT        NOT NULL,
  heure_debut TIME,
  heure_fin   TIME,
  note        TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planning_taches DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_taches TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_planning_taches_user_date ON planning_taches(user_id, date);

-- ────────────────────────────────────────────────────────────
-- 8. TABLE planning_shifts
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_shifts (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  date        DATE        NOT NULL,
  heure_debut TIME,
  heure_fin   TIME,
  type_poste  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
  -- Pas de contrainte UNIQUE(user_id, date) : plusieurs créneaux par jour autorisés
);
ALTER TABLE planning_shifts DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_shifts TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_planning_shifts_user_date ON planning_shifts(user_id, date);

-- ────────────────────────────────────────────────────────────
-- 9. TABLE planning_tasks (tâches libres planning équipe)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planning_tasks (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  date       DATE        NOT NULL,
  texte      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE planning_tasks DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_tasks TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_planning_tasks_user_date ON planning_tasks(user_id, date);

-- ────────────────────────────────────────────────────────────
-- 10. TABLE payslips (fiches de paie — pour usage futur)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payslips (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT          NOT NULL,
  annee        INTEGER       NOT NULL,
  mois         INTEGER       NOT NULL CHECK (mois BETWEEN 1 AND 12),
  salaire_brut NUMERIC(10,2),
  salaire_net  NUMERIC(10,2),
  fichier_url  TEXT,
  statut       TEXT          NOT NULL DEFAULT 'brouillon'
                 CHECK (statut IN ('brouillon','emis','confirme')),
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (user_id, annee, mois)
);
ALTER TABLE payslips DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_payslips_user ON payslips(user_id);

-- ────────────────────────────────────────────────────────────
-- 11. Mettre à jour Dessa en admin (si pas encore fait)
-- ────────────────────────────────────────────────────────────
UPDATE users SET role = 'admin'
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Renommer Laëla en Talya (si pas encore fait)
UPDATE users SET name = 'Talya'
WHERE id = '00000000-0000-0000-0000-000000000003' AND name IN ('Laëla', 'Laela');

-- ────────────────────────────────────────────────────────────
-- FIN — Résumé des tables créées / modifiées :
--   users            → +7 colonnes contrat, contrainte rôle étendue
--   conges           → créée
--   access_logs      → créée
--   notifications    → créée
--   expense_reports  → créée
--   messages         → créée
--   planning_taches  → créée
--   planning_shifts  → créée
--   planning_tasks   → créée
--   payslips         → créée
-- ────────────────────────────────────────────────────────────
