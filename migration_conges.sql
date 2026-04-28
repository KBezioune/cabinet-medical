-- ============================================================
-- MIGRATION — Système de congés + rôle manager
-- Coller et exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Ajouter le rôle 'manager' à la contrainte existante
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('assistant', 'manager', 'admin'));

-- 2. Passer Imene et Dessa en manager
UPDATE public.users SET role = 'manager'
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',  -- Imene
  '00000000-0000-0000-0000-000000000002'   -- Dessa
);

-- 3. Créer la table des demandes de congés
CREATE TABLE IF NOT EXISTS public.conges (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('vacances','maladie','conge','formation','absence')),
  date_debut    DATE NOT NULL,
  date_fin      DATE NOT NULL,
  nb_jours      INTEGER GENERATED ALWAYS AS (date_fin - date_debut + 1) STORED,
  motif         TEXT,
  statut        TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','approuve','refuse','modifie')),
  traite_par    UUID REFERENCES public.users(id),
  traite_le     TIMESTAMPTZ,
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_conges_user    ON public.conges(user_id);
CREATE INDEX IF NOT EXISTS idx_conges_statut  ON public.conges(statut);
CREATE INDEX IF NOT EXISTS idx_conges_dates   ON public.conges(date_debut, date_fin);

-- 5. Droits
ALTER TABLE public.conges DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conges TO anon, authenticated;

-- Vérification
SELECT id, name, role FROM public.users ORDER BY name;
