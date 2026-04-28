-- Migration : table planning_taches
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS planning_taches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  tache       TEXT NOT NULL CHECK (tache IN ('consultation','sterilisation','accueil','administratif','autre')),
  heure_debut TIME NOT NULL,
  heure_fin   TIME NOT NULL,
  note        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_taches_user_date ON planning_taches(user_id, date);
CREATE INDEX IF NOT EXISTS idx_planning_taches_date      ON planning_taches(date);

ALTER TABLE planning_taches DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_taches TO anon, authenticated;
