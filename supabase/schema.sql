-- Schema pour Cabinet Médical - Pointage
-- Exécuter dans Supabase SQL Editor

-- Table des utilisateurs (assistantes + admin)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('assistant', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des pointages
CREATE TABLE IF NOT EXISTS pointages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  heure_arrivee TIMESTAMPTZ,
  heure_depart TIMESTAMPTZ,
  duree_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN heure_arrivee IS NOT NULL AND heure_depart IS NOT NULL
      THEN EXTRACT(EPOCH FROM (heure_depart - heure_arrivee))::INTEGER / 60
      ELSE NULL
    END
  ) STORED,
  note TEXT,
  modifie_par UUID REFERENCES users(id),
  modifie_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table du planning hebdomadaire
CREATE TABLE IF NOT EXISTS planning (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jour_semaine INTEGER NOT NULL CHECK (jour_semaine BETWEEN 1 AND 7), -- 1=Lundi, 7=Dimanche
  heure_debut TIME,
  heure_fin TIME,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, jour_semaine)
);

-- Table des événements de planning (calendrier visuel date-specific)
CREATE TABLE IF NOT EXISTS planning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('travail', 'conge', 'maladie', 'absent', 'ferie')),
  heure_debut TIME,
  heure_fin TIME,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_pointages_user_date ON pointages(user_id, date);
CREATE INDEX IF NOT EXISTS idx_pointages_date ON pointages(date);
CREATE INDEX IF NOT EXISTS idx_planning_user ON planning(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_events_user_date ON planning_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_planning_events_date ON planning_events(date);

-- Désactiver RLS pour usage simple (PIN-based auth sans Supabase Auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE pointages DISABLE ROW LEVEL SECURITY;
ALTER TABLE planning DISABLE ROW LEVEL SECURITY;
ALTER TABLE planning_events DISABLE ROW LEVEL SECURITY;

-- Accorder les droits à la clé anon (obligatoire pour CREATE TABLE via SQL brut)
GRANT SELECT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pointages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_events TO anon, authenticated;

-- Insertion des utilisateurs avec les mêmes IDs que dans AuthContext.jsx
-- Si des lignes existent déjà (sans ces IDs), les supprimer d'abord :
-- DELETE FROM planning; DELETE FROM pointages; DELETE FROM users;
INSERT INTO users (id, name, pin, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Imene',        '0503', 'assistant'),
  ('00000000-0000-0000-0000-000000000002', 'Dessa',        '2002', 'assistant'),
  ('00000000-0000-0000-0000-000000000003', 'Laëla',        '2003', 'assistant'),
  ('00000000-0000-0000-0000-000000000004', 'Dr. Bezioune', '1234', 'admin')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, pin = EXCLUDED.pin, role = EXCLUDED.role;

-- Planning type par défaut (Lundi-Vendredi 8h-17h)
INSERT INTO planning (user_id, jour_semaine, heure_debut, heure_fin)
SELECT u.id, j.jour, '08:00'::TIME, '17:00'::TIME
FROM users u
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS j(jour)
WHERE u.role = 'assistant'
ON CONFLICT (user_id, jour_semaine) DO NOTHING;
