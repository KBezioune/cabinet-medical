-- Migration : table planning_tasks (tâches libres pour le planning équipe)
-- Exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS planning_tasks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT        NOT NULL,
  date       DATE        NOT NULL,
  texte      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE planning_tasks DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_tasks TO anon, authenticated;

-- Index pour les requêtes par user/date
CREATE INDEX IF NOT EXISTS idx_planning_tasks_user_date ON planning_tasks(user_id, date);
