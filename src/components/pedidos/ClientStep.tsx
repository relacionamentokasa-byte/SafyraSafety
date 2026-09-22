import { useFormContext } from "react-hook-form";
import type { OrderFormValues } from "@/lib/orders.schema";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, User, Building2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getClients, isUuid } from "@/lib/clients.services";
import { formatDisplayName } from "@/lib/format-name";

type ClientOption = {
  id: string;
  name: string;
  cnpj?: string | null;
  city?: string | null;
  state?: string | null;
  representative_id?: string | null;
};

export function ClientStep() {
  const { setValue, watch } = useFormContext<OrderFormValues>();
  const [search, setSearch] = useState("");
  const selectedClientId = watch("client_id");
  const selectedRepresentativeId = watch("representative_id");

  const { data: clients, isLoading } = useQuery<ClientOption[]>({
    queryKey: ["clients-search", search],
    queryFn: async () => {
      const res = await getClients({ search, pageSize: 8 });
      return res.data as ClientOption[];
    },
  });

  const handleSelectClient = (client: ClientOption) => {
    const representativeId = client.representative_id ?? "";

    setValue("client_id", client.id, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setValue("representative_id", isUuid(representativeId) ? representativeId : "", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const hasValidRepresentative = isUuid(selectedRepresentativeId || "");
  const isCanonicalClient = selectedClientId?.startsWith("cli_") ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>Buscar Cliente</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-order-client-search
            placeholder="Nome, CNPJ ou Razão Social..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <p className="text-center py-4 text-sm text-muted-foreground">Buscando clientes...</p>
        ) : clients?.map((client) => (
          <Card 
            key={client.id}
            className={cn(
              "cursor-pointer hover:border-primary transition-colors",
              selectedClientId === client.id && "border-primary bg-primary/5"
            )}
            onClick={() => handleSelectClient(client)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{formatDisplayName(client.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      [client.city, client.state].filter(Boolean).join(" - "),
                      client.cnpj
                        ? `CNPJ: ${client.cnpj.length === 14 ? client.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : client.cnpj}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Sem localização/CNPJ"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedClientId && (
        <div
          data-representative-warning
          tabIndex={hasValidRepresentative ? undefined : -1}
          className="space-y-3 rounded-lg border bg-muted/50 p-4"
        >
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4" />
            Vendedor responsável
          </h4>

          {hasValidRepresentative ? (
            <div className="space-y-1">
              <p className="text-sm">Representante vinculado à carteira.</p>
              <p className="text-xs italic text-muted-foreground">
                O vínculo será validado novamente pelo banco ao finalizar o pedido.
              </p>
              {isCanonicalClient && (
                <p className="text-xs text-muted-foreground">
                  Este cliente veio da base importada e será materializado no banco somente se a
                  operação autorizada confirmar a criação.
                </p>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Representante não identificado</AlertTitle>
              <AlertDescription>
                Este cliente não possui um representante com identificador válido na carteira.
                Vincule a carteira antes de avançar.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
