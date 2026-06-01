-- Migration : Laëla renommée en Talya
-- Exécuter dans Supabase SQL Editor

UPDATE users
SET name = 'Talya'
WHERE id = '00000000-0000-0000-0000-000000000003';
