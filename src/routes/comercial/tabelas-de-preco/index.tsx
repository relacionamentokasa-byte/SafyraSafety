import { createFileRoute, Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPriceTables } from '@/lib/pricing.services';
import { PriceTable, TargetAudience } from '@/types/pricing.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponsiveModal } from '@/components/common/ResponsiveModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Search,
  FileSpreadsheet,
  Building2,
  Users,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';

export const Route = createFileRoute('/comercial/tabelas-de-preco/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Tabelas de Preço" },
      { name: "description", content: "Gerencie tabelas de preços por fabricante, público e segmento comercial." },
    ],
  }),
  component: PriceTablesPage,
});

function PriceTablesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAudience, setSelectedAudience] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form State para nova tabela
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    manufacturer_id: string;
    target_audience: TargetAudience;
    is_default: boolean;
    status: 'active' | 'inactive';
  }>({
    name: '',
    code: '',
    description: '',
    manufacturer_id: '',
    target_audience: 'geral',
    is_default: false,
    status: 'active',
  });

  // Buscar Tabelas de Preço
  const { data: priceTables = [], isLoading } = useQuery({
    queryKey: ['price-tables'],
    queryFn: () => getPriceTables(),
  });

  // Buscar Fabricantes para o filtro e modal
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('manufacturers')
        .select('id, name, logo_path')
        .order('name');
      return data || [];
    },
  });

  // Mutation para criar tabela
  const createTableMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: formData.name,
        code: formData.code || `TAB-${Date.now().toString().slice(-4)}`,
        description: formData.description || null,
        manufacturer_id: formData.manufacturer_id === 'none' || !formData.manufacturer_id ? null : formData.manufacturer_id,
        target_audience: formData.target_audience,
        is_default: formData.is_default,
        status: formData.status,
      };

      const { data, error } = await supabase
        .from('price_tables' as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Tabela de preços criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['price-tables'] });
      setIsCreateOpen(false);
      setFormData({
        name: '',
        code: '',
        description: '',
        manufacturer_id: '',
        target_audience: 'geral',
        is_default: false,
        status: 'active',
      });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar tabela de preços: ' + (err.message || 'Verifique os dados'));
    },
  });

  const audienceLabels: Record<TargetAudience, string> = {
    geral: 'Geral (Todos)',
    consumidor_final: 'Consumidor Final',
    revenda: 'Revenda / Lojista',
    industria: 'Indústria / Órgão Público',
    distribuidor: 'Distribuidor',
  };

  const filteredTables = priceTables.filter((table) => {
    const matchesSearch =
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (table.code && table.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAudience =
      selectedAudience === 'all' || table.target_audience === selectedAudience;

    const matchesManufacturer =
      selectedManufacturer === 'all' || table.manufacturer_id === selectedManufacturer;

    return matchesSearch && matchesAudience && matchesManufacturer;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Tabelas de Preço</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie precificações por fabricante, público-alvo e condições comerciais homologadas.
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold shadow-xs">
            <Plus className="h-4 w-4 mr-2" />
            Nova Tabela de Preço
          </Button>
        </div>

        {/* Painel Integrado: Indicadores de Tabelas de Preço */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Matrizes de Precificação Comercial
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-400">
              {priceTables.length} políticas cadastradas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {/* Total de Tabelas */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total de Tabelas
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {priceTables.length}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Matrizes homologadas</span>
                </div>
              </div>
            </div>

            {/* Ativas */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tabelas Ativas
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {priceTables.filter((t) => t.status === 'active').length}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Prontas para emissão de pedidos</span>
                </div>
              </div>
            </div>

            {/* Por Fabricante */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Por Fabricante
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {priceTables.filter((t) => !!t.manufacturer_id).length}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Exclusivas por fabricante</span>
                </div>
              </div>
            </div>

            {/* Tabela Padrão */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
              <div className="mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Tabela Padrão
                </span>
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                  {priceTables.filter((t) => t.is_default).length}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <span>Matriz base do sistema</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Select value={selectedAudience} onValueChange={setSelectedAudience}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Público-alvo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Públicos</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                <SelectItem value="revenda">Revenda</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
                <SelectItem value="distribuidor">Distribuidor</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Fabricante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Fabricantes</SelectItem>
                {manufacturers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2"><ManufacturerLogo name={m.name} logoPath={m.logo_path} size="sm" />{m.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Price Table Cards (Otimizado para Celular) */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="p-10 text-center bg-card rounded-xl border border-slate-200/80">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
              <span className="text-xs text-muted-foreground">Carregando tabelas de preço...</span>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="p-10 text-center bg-card rounded-xl border border-slate-200/80 text-muted-foreground text-sm">
              Nenhuma tabela de preços encontrada.
            </div>
          ) : (
            filteredTables.map((table) => (
              <div
                key={table.id}
                className="p-4 bg-card rounded-xl border border-slate-200/80 shadow-xs space-y-3"
              >
                {/* Cabeçalho do Card: Nome, Badge Padrão e Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {table.code && (
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {table.code}
                        </span>
                      )}
                      {table.is_default && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          Padrão
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {table.name}
                    </h3>
                  </div>

                  <div>
                    {table.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Inativa
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadados: Fabricante e Segmento */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {table.manufacturer ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <ManufacturerLogo name={table.manufacturer.name} logoPath={table.manufacturer.logo_path} size="sm" />
                        {table.manufacturer.name}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Multimarca</span>
                    )}
                  </div>

                  <Badge variant="outline" className="capitalize text-[11px] font-normal text-slate-600">
                    {audienceLabels[table.target_audience] || table.target_audience}
                  </Badge>
                </div>

                {/* Ação */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <Button size="sm" variant="outline" className="w-full font-semibold text-xs h-9" asChild>
                    <Link to="/comercial/tabelas-de-preco/$id" params={{ id: table.id }}>
                      <Eye className="h-4 w-4 mr-1.5 text-primary" />
                      Ver e Importar Itens
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tabela de Listagem (Desktop) */}
        <div className="hidden md:block rounded-xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tabela & Código</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fabricante</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Público / Segmento</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredTables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhuma tabela de preços encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTables.map((table) => (
                  <TableRow key={table.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          {table.name}
                          {table.is_default && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Padrão
                            </span>
                          )}
                        </div>
                        {table.code && (
                          <span className="font-mono text-xs text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted">
                            {table.code}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {table.manufacturer ? (
                          <ManufacturerLogo name={table.manufacturer.name} logoPath={table.manufacturer.logo_path} size="sm" />
                        ) : null}
                        {table.manufacturer?.name || (
                          <span className="text-xs text-muted-foreground italic">Multimarca</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs font-normal">
                        {audienceLabels[table.target_audience] || table.target_audience}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {table.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Inativa
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="font-semibold text-xs h-8" asChild>
                        <Link to="/comercial/tabelas-de-preco/$id" params={{ id: table.id }}>
                          <Eye className="h-4 w-4 mr-1.5 text-primary" />
                          Ver e Importar Itens
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modal de Criação de Tabela (ResponsiveModal - Bottom Sheet no Mobile) */}
        <ResponsiveModal
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          maxContentClass="max-w-md"
          title="Criar Nova Tabela de Preço"
          description="Defina as regras e público da tabela para vincular produtos e importar planilhas."
        >
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da Tabela *</Label>
              <Input
                id="name"
                placeholder="Ex: Tabela Revenda - Fabricante X"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code">Código Identificador</Label>
                <Input
                  id="code"
                  placeholder="Ex: TAB-REV-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Público-Alvo</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(val: any) => setFormData({ ...formData, target_audience: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral (Todos)</SelectItem>
                    <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                    <SelectItem value="revenda">Revenda</SelectItem>
                    <SelectItem value="industria">Indústria</SelectItem>
                    <SelectItem value="distribuidor">Distribuidor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Fabricante Específico (Opcional)</Label>
              <Select
                value={formData.manufacturer_id}
                onValueChange={(val) => setFormData({ ...formData, manufacturer_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fabricante..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Tabela Multimarca)</SelectItem>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Observações / Regras</Label>
              <Input
                id="description"
                placeholder="Ex: Válida para pedidos com pagamento em até 30 dias"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between border p-3 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Tabela Padrão</Label>
                <p className="text-xs text-muted-foreground">Usar como padrão para o público selecionado</p>
              </div>
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>

            <div className="pt-4 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!formData.name || createTableMutation.isPending}
                onClick={() => createTableMutation.mutate()}
              >
                {createTableMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Tabela
              </Button>
            </div>
          </div>
        </ResponsiveModal>
      </div>
    </AppLayout>
  );
}
