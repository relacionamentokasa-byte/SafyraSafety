import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { getClients, ensureClientInDatabase, isUuid } from "@/lib/clients.services";
import { formatDisplayName } from "@/lib/format-name";

function parseLocalDateTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Informe uma data e hora válidas");
  }

  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute)
  ) {
    throw new Error("Informe uma data e hora válidas");
  }

  return parsed;
}

const visitSchema = z.object({
  client_id: z
    .string()
    .refine((value) => value.startsWith("cli_") || isUuid(value), "Selecione um cliente válido"),
  representative_id: z.string().refine(isUuid, "Selecione um representante válido"),
  scheduled_at: z
    .string()
    .min(1, "Selecione a data e hora")
    .refine((value) => {
      try {
        return parseLocalDateTime(value).getTime() > Date.now();
      } catch {
        return false;
      }
    }, "A data da visita deve ser futura e válida"),
  notes: z.string().optional(),
});

type VisitFormValues = z.infer<typeof visitSchema>;

export const Route = createFileRoute("/campo/visitas/novo")({
  validateSearch: (search: Record<string, unknown>): { clientId?: string } => {
    return {
      clientId: search.clientId as string | undefined,
    };
  },
  component: NewVisitPage,
});

function NewVisitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients-simple"],
    queryFn: async () => {
      const res = await getClients({ pageSize: 200 });
      return res.data;
    },
  });

  const { data: representatives } = useQuery({
    queryKey: ["representatives-simple"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      client_id: search.clientId || "",
    },
  });

  const onSubmit = async (data: VisitFormValues) => {
    setIsSubmitting(true);
    try {
      const scheduledAt = parseLocalDateTime(data.scheduled_at);
      const realClientId = await ensureClientInDatabase(data.client_id, data.representative_id);

      if (!isUuid(realClientId)) {
        throw new Error("O cliente não possui um identificador válido no banco");
      }

      const { data: savedVisit, error } = await supabase
        .from("visits")
        .insert([
          {
            client_id: realClientId,
            representative_id: data.representative_id,
            scheduled_at: scheduledAt.toISOString(),
            notes: data.notes?.trim() || null,
            status: "scheduled",
          },
        ])
        .select("id")
        .single();

      if (error) throw error;
      if (!savedVisit?.id || !isUuid(savedVisit.id)) {
        throw new Error("O banco não confirmou o agendamento");
      }

      await queryClient.invalidateQueries({
        queryKey: ["visits-list"],
        refetchType: "all",
      });
      toast.success("Visita agendada e salva com sucesso!");
      navigate({ to: "/campo/visitas" });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar o agendamento";
      toast.error("Erro ao agendar visita: " + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/campo/visitas">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Agendar Visita</h1>
        <p className="text-muted-foreground">
          Preencha os dados abaixo para marcar uma nova visita técnica ou comercial.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações da Visita</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Cliente</Label>
                <select
                  id="client_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register("client_id")}
                >
                  <option value="">Selecione um cliente</option>
                  {clients?.map((c) => {
                    const loc = [c.city, c.state].filter(Boolean).join(" - ");
                    const cnpjFormatted = c.cnpj && c.cnpj.length === 14
                      ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                      : c.cnpj;
                    const details = [loc, cnpjFormatted].filter(Boolean).join(" • ");
                    const displayName = formatDisplayName(c.name || c.legal_name || c.trade_name);
                    return (
                      <option key={c.id} value={c.id}>
                        {displayName}{details ? ` (${details})` : ""}
                      </option>
                    );
                  })}
                </select>
                {errors.client_id && (
                  <p className="text-xs text-destructive">{errors.client_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="representative_id">Representante Responsável</Label>
                <select
                  id="representative_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register("representative_id")}
                >
                  <option value="">Selecione um representante</option>
                  {representatives?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name
                        ? `${r.name}${r.code ? ` (${r.code})` : ""}`
                        : r.code || "Representante"}
                    </option>
                  ))}
                </select>
                {errors.representative_id && (
                  <p className="text-xs text-destructive">{errors.representative_id.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Data e Hora da Visita</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  className="pl-9"
                  {...register("scheduled_at")}
                />
              </div>
              {errors.scheduled_at && (
                <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações / Objetivo da Visita</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Apresentação da nova linha de EPIs, verificação de estoque..."
                className="min-h-[100px]"
                {...register("notes")}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" type="button" asChild disabled={isSubmitting}>
                <Link to="/campo/visitas">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Agendando..." : "Confirmar Agendamento"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
