// Supabase Edge Function: send-push
// Disparada automaticamente por Database Webhook quando uma nova notificação é criada em public.notifications

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Chaves VAPID oficiais do Safyra Safety
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BFQqzC6WYGIGmoGhZoqEkid5Q9gCq0MVEL_DXJ1IUYZ9GxiwSDEe0QRWkD11KHwI_OIaqbC8XfRES2x4fPpEObw";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "mvPK8wqXOdUCIJXKUhX5rCC4kcEwLm_PwHyhP-M4f0E";
const VAPID_SUBJECT = "mailto:suporte@safyrasafety.com.br";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Suporta chamada direta ou via Database Webhook do Supabase (record)
    const notification = payload.record || payload;

    if (!notification || !notification.user_id) {
      return new Response(
        JSON.stringify({ error: "user_id e dados da notificação são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca todos os aparelhos registrados para este usuário
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", notification.user_id);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum aparelho registrado para push para este usuário.", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Monta o pacote de notificação para o celular
    const pushPayload = JSON.stringify({
      title: notification.title || "Safyra Safety",
      body: notification.message || "Você tem uma nova notificação.",
      url: notification.url || "/notificacoes",
      icon: "/pwa-192x192.png",
      badge: "/favicon.png",
      priority: notification.priority || "informativa",
      type: notification.type || "sistema",
    });

    // 3. Dispara em paralelo para todos os celulares/dispositivos do usuário
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          return await webpush.sendNotification(pushSubscription, pushPayload);
        } catch (err: any) {
          // Se o endpoint expirou ou usuário removeu permissão (410 / 404), remove do banco
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        }
      })
    );

    const sentCount = results.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no envio do push:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
