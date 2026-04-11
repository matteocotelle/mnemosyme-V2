-- =============================================
-- Mnemosyme V2 — Supabase Database Setup
-- Exécuter dans : Dashboard → SQL Editor → New query
-- =============================================

-- 1. Table questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  genre TEXT NOT NULL DEFAULT 'Général',
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'opinion')),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index sur genre pour les requêtes par catégorie (rapide)
CREATE INDEX IF NOT EXISTS idx_questions_genre ON questions(genre);

-- 3. Activer Row Level Security (bonne pratique Supabase)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 4. Policy : lecture publique (le backend utilise service_role, mais au cas où)
CREATE POLICY "Questions are publicly readable"
  ON questions FOR SELECT
  USING (true);

-- 5. Policy : écriture uniquement via service_role (backend)
CREATE POLICY "Only service role can insert/update/delete"
  ON questions FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Fonction pour récupérer les genres distincts
CREATE OR REPLACE FUNCTION get_distinct_genres()
RETURNS TABLE(genre TEXT) AS $$
  SELECT DISTINCT q.genre FROM questions q ORDER BY q.genre;
$$ LANGUAGE SQL STABLE;

-- 7. Fonction pour récupérer des questions aléatoires avec filtres
CREATE OR REPLACE FUNCTION get_random_questions(
  p_count INTEGER DEFAULT 10,
  p_genres TEXT[] DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT NULL
)
RETURNS SETOF questions AS $$
  SELECT *
  FROM questions
  WHERE
    (p_genres IS NULL OR genre = ANY(p_genres))
    AND (p_exclude_ids IS NULL OR id != ALL(p_exclude_ids))
  ORDER BY random()
  LIMIT p_count;
$$ LANGUAGE SQL STABLE;
