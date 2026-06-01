-- Migration : Dossiers RH — table documents + bucket storage
-- Exécuter dans Supabase SQL Editor

-- ── 1. Table documents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  dossier      TEXT        NOT NULL,   -- ex: '10', '20', '30'…
  nom_fichier  TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  storage_path TEXT,                   -- chemin dans le bucket
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_documents_user    ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_dossier ON documents(user_id, dossier);

-- ── 2. Bucket Supabase Storage ────────────────────────────────
-- À créer MANUELLEMENT dans Dashboard → Storage :
--   Nom    : dossiers-rh
--   Public : oui (pour URLs de téléchargement directes)
--
-- Ou via SQL (nécessite l'extension storage) :
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossiers-rh', 'dossiers-rh', true)
ON CONFLICT (id) DO NOTHING;

-- Policy : accès complet pour anon/authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'dossiers-rh-allow-all'
  ) THEN
    CREATE POLICY "dossiers-rh-allow-all" ON storage.objects
    FOR ALL USING (bucket_id = 'dossiers-rh');
  END IF;
END $$;
