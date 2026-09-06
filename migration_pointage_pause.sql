-- Pointage multiple : arrivée / début pause / fin pause / départ
-- Ajoute le suivi de la pause déjeuner sur la ligne de pointage du jour,
-- et recalcule la durée travaillée nette (dépôt du break).

ALTER TABLE pointages ADD COLUMN IF NOT EXISTS heure_pause_debut TIMESTAMPTZ;
ALTER TABLE pointages ADD COLUMN IF NOT EXISTS heure_pause_fin   TIMESTAMPTZ;

ALTER TABLE pointages DROP COLUMN IF EXISTS duree_minutes;
ALTER TABLE pointages ADD COLUMN duree_minutes INTEGER GENERATED ALWAYS AS (
  CASE
    WHEN heure_arrivee IS NOT NULL AND heure_depart IS NOT NULL THEN
      EXTRACT(EPOCH FROM (heure_depart - heure_arrivee))::INTEGER / 60
      - CASE
          WHEN heure_pause_debut IS NOT NULL AND heure_pause_fin IS NOT NULL
          THEN EXTRACT(EPOCH FROM (heure_pause_fin - heure_pause_debut))::INTEGER / 60
          ELSE 0
        END
    ELSE NULL
  END
) STORED;
