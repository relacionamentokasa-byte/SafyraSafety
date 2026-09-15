CREATE TYPE public.notification_type AS ENUM (
  'visita', 
  'follow_up', 
  'oportunidade', 
  'pedido', 
  'meta', 
  'comissao', 
  'cliente', 
  'sistema'
);

CREATE TYPE public.notification_priority AS ENUM (
  'informativa', 
  'atencao', 
  'importante', 
  'urgente'
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type public.notification_type NOT NULL,
  priority public.notification_priority DEFAULT 'informativa',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_record_id UUID,
  related_record_type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category public.notification_type NOT NULL,
  enabled BOOLEAN DEFAULT true,
  is_mandatory BOOLEAN DEFAULT false,
  UNIQUE(user_id, category)
);

GRANT SELECT, INSERT, UPDATE ON public.user_notification_settings TO authenticated;
GRANT ALL ON public.user_notification_settings TO service_role;

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification settings"
ON public.user_notification_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can see all activity logs"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'gestor_comercial')
);

CREATE POLICY "Users can see their own activity logs"
ON public.activity_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
