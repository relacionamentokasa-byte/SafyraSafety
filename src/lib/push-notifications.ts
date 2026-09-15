import { supabase } from "@/integrations/supabase/client";

// Chave pública VAPID gerada para o Safyra Safety
export const VAPID_PUBLIC_KEY = "BFQqzC6WYGIGmoGhZoqEkid5Q9gCq0MVEL_DXJ1IUYZ9GxiwSDEe0QRWkD11KHwI_OIaqbC8XfRES2x4fPpEObw";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Solicita permissão e registra o dispositivo para Web Push
 */
export async function subscribeUserToPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { success: false, error: "Notificações push não suportadas neste dispositivo/navegador." };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Usuário precisa estar autenticado." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Permissão de notificação não concedida." };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    const subJson = subscription.toJSON();

    // Salvar inscrição no Supabase
    const { error: dbError } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });

    if (dbError) {
      console.error("Erro ao salvar inscrição push no banco:", dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Erro ao assinar push notifications:", err);
    return { success: false, error: err.message || "Erro desconhecido ao ativar notificações." };
  }
}

/**
 * Verifica se o usuário atual já está inscrito em push
 */
export async function checkPushSubscriptionStatus(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    if (Notification.permission !== "granted") return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
