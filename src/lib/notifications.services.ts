import { supabase } from "@/integrations/supabase/client";
import { 
  Notification, 
  NotificationType, 
  NotificationPriority,
  ActivityLog,
  UserNotificationSetting
} from "@/types/database.types";

// PGRST205 = tabela não existe no schema cache (ainda não migrada)
function isTableMissingError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'PGRST205'
  );
}

export async function getNotifications(limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isTableMissingError(error)) return [] as Notification[];
    throw error;
  }
  return data as Notification[];
}

export async function getUnreadNotificationsCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) {
    if (isTableMissingError(error)) return 0;
    throw error;
  }
  return count || 0;
}

export async function markAsRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ 
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', id);
    
  if (error) throw error;
}

export async function markAllAsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ 
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .eq('is_read', false);
    
  if (error) throw error;
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'is_read' | 'read_at'>) {
  // Check user settings first
  const { data: settings } = await supabase
    .from('user_notification_settings')
    .select('enabled')
    .eq('user_id', notification.user_id)
    .eq('category', notification.type)
    .single();

  if (settings && !settings.enabled) return;

  const { error } = await supabase
    .from('notifications')
    .insert(notification);
    
  if (error) throw error;
}

export async function getActivityLogs(limit = 10) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return data as any[];
}

export async function createActivityLog(log: Omit<ActivityLog, 'id' | 'created_at' | 'profiles'>) {
  const { error } = await supabase
    .from('activity_log')
    .insert(log as any);
    
  if (error) throw error;
}

export async function getUserNotificationSettings() {
  const { data, error } = await supabase
    .from('user_notification_settings')
    .select('*');
    
  if (error) throw error;
  return data as UserNotificationSetting[];
}

export async function updateNotificationSetting(category: NotificationType, enabled: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_notification_settings')
    .upsert({ 
      user_id: user.id,
      category,
      enabled
    });
    
  if (error) throw error;
}
