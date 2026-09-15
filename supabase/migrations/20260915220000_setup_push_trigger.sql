-- Script SQL para automação de disparo Push via pg_net
-- Arquivo: supabase/migrations/20260915220000_setup_push_trigger.sql

-- 1. Habilita a extensão pg_net para chamadas HTTP assíncronas do PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Função disparada a cada inserção na tabela notifications
CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- URL da Edge Function do projeto Supabase
  v_url := 'https://hxogosqpcewvtwdyerru.supabase.co/functions/v1/send-push';
  v_anon_key := 'sb_publishable_rYjSijG2jpE9_ys5EZIUJA_36mbvyi5';

  -- Envio assíncrono para a Edge Function sem bloquear o INSERT
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Garante que falhas de rede no push não impeçam a gravação da notificação no banco
  RAISE WARNING 'Falha ao disparar push webhook: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Vincula o Trigger à tabela notifications
DROP TRIGGER IF EXISTS on_notification_created_send_push ON public.notifications;
CREATE TRIGGER on_notification_created_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_push_notification();
