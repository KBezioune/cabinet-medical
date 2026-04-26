-- CORRECTIF RAPIDE — coller et exécuter dans Supabase SQL Editor
-- Règle le problème "PIN incorrect" causé par des droits manquants

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning DISABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pointages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning TO anon, authenticated;
