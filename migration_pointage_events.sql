-- Refonte du pointage : journal d'événements, pauses illimitées par jour.
-- Remplace le modèle "une ligne = un jour" (table pointages) par un événement
-- indépendant par ligne : arrivee / pause_debut / pause_fin / depart.
-- L'ancienne table `pointages` est conservée telle quelle (non utilisée par
-- l'application) pour ne rien supprimer ; son historique est repris ci-dessous.

CREATE TABLE IF NOT EXISTS pointage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('arrivee', 'pause_debut', 'pause_fin', 'depart')),
  heure TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pointage_events_user_date ON pointage_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_pointage_events_date ON pointage_events(date);

ALTER TABLE pointage_events DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON pointage_events TO anon, authenticated;

-- Reprise de l'historique existant depuis l'ancienne table `pointages`
-- (ne s'exécute qu'une fois : ignoré si pointage_events contient déjà des données).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pointage_events) THEN

    INSERT INTO pointage_events (user_id, date, type, heure)
    SELECT user_id, date, 'arrivee', heure_arrivee
    FROM pointages WHERE heure_arrivee IS NOT NULL;

    INSERT INTO pointage_events (user_id, date, type, heure)
    SELECT user_id, date, 'depart', heure_depart
    FROM pointages WHERE heure_depart IS NOT NULL;

    -- Colonnes de pause : présentes uniquement si migration_pointage_pause.sql
    -- a déjà été exécutée. Reprise conditionnelle, sans erreur sinon.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'pointages' AND column_name = 'heure_pause_debut'
    ) THEN
      INSERT INTO pointage_events (user_id, date, type, heure)
      SELECT user_id, date, 'pause_debut', heure_pause_debut
      FROM pointages WHERE heure_pause_debut IS NOT NULL;

      INSERT INTO pointage_events (user_id, date, type, heure)
      SELECT user_id, date, 'pause_fin', heure_pause_fin
      FROM pointages WHERE heure_pause_fin IS NOT NULL;
    END IF;

  END IF;
END $$;
