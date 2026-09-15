import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivityLogs } from '@/lib/notifications.services';
import { ActivityLog } from '@/types/database.types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { User } from 'lucide-react';

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getActivityLogs(8);
        setActivities(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card className="col-span-full lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-lg">Atividades Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
             {[1,2,3,4].map(i => (
               <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />
             ))}
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-6">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-4">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={activity.profiles?.avatar_url} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.profiles?.full_name || 'Sistema'}</span>
                    {' '}{activity.action}
                  </p>
                  {activity.details?.name && (
                    <p className="text-xs text-muted-foreground italic font-medium">
                      "{activity.details.name}"
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                    {format(new Date(activity.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm italic">
            Nenhuma atividade registrada ainda.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
