-- Adiciona coluna avatar_path para armazenar somente o caminho estável no bucket.
-- A coluna avatar_url existente permanece para compatibilidade com dados legados,
-- mas novos uploads devem gravar apenas em avatar_path.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

COMMENT ON COLUMN public.profiles.avatar_path IS
  'Caminho estável do arquivo no bucket de avatares (ex: "abc123.webp"). URLs assinadas são geradas sob demanda no frontend.';
