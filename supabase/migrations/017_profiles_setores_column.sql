-- 017: Adiciona coluna setores em profiles
--
-- A coluna existia apenas nos tipos TypeScript mas nunca foi criada via migration.
-- Corrige a divergência entre schema real e database.types.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS setores TEXT[] NOT NULL DEFAULT '{}';
