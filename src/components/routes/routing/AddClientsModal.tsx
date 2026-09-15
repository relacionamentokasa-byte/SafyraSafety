import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserCheck, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMapClients } from "@/lib/clients.services";
import { Client } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ResponsiveModal } from "@/components/common/ResponsiveModal";

interface AddClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (clients: Client[]) => void;
  selectedIds: string[];
}

export function AddClientsModal({ open, onOpenChange, onAdd, selectedIds }: AddClientsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelected, setLocalSelected] = useState<string[]>([]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-for-routing'],
    queryFn: async () => {
      return getMapClients();
    },
    enabled: open
  });

  const filteredClients = useMemo(() => {
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const toggleClient = (id: string) => {
    setLocalSelected(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAdd = () => {
    const clientsToAdd = clients.filter(c => localSelected.includes(c.id));
    onAdd(clientsToAdd);
    setLocalSelected([]);
    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      maxContentClass="max-w-xl"
      title="Adicionar Clientes à Rota"
      description="Selecione os clientes da sua carteira para incluir no planejamento."
    >
      <div className="flex flex-col h-[65vh] sm:h-[500px]">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade ou segmento..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-hidden py-2">
          <ScrollArea className="h-full pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-slate-500">Carregando clientes...</div>
            ) : filteredClients.length > 0 ? (
              <div className="grid gap-2">
                {filteredClients.map((client) => {
                  const isSelected = localSelected.includes(client.id) || selectedIds.includes(client.id);
                  const isAlreadyAdded = selectedIds.includes(client.id);

                  return (
                    <div
                      key={client.id}
                      onClick={() => !isAlreadyAdded && toggleClient(client.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                        isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50 border-slate-200/80",
                        isAlreadyAdded && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-slate-900">{client.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MapPin size={11} /> {client.city}</span>
                          {client.segment && <span>• {client.segment}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">{client.status}</Badge>
                        {isSelected ? (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <UserCheck size={12} className="text-primary-foreground" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-muted-foreground/30" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum cliente encontrado com localização definida.
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="pt-4 border-t flex items-center justify-end gap-2 mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={localSelected.length === 0}>
            Adicionar {localSelected.length} {localSelected.length === 1 ? 'Cliente' : 'Clientes'}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
