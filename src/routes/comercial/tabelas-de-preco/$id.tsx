import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPriceTableItems } from '@/lib/pricing.services';
import { parseProductsSpreadsheet, importProductsToDatabase } from '@/lib/import-products';
import { SpreadsheetProductRow } from '@/types/pricing.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  Upload,
  FileSpreadsheet,
  Building2,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';

export const Route = createFileRoute('/comercial/tabelas-de-preco/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Detalhes da Tabela de Preço" },
      { name: "description", content: "Itens, produtos e importador de planilhas para tabela de preços." },
    ],
  }),
  component: PriceTableDetailsPage,
});

function PriceTableDetailsPage() {
  const { id } = useParams({ from: '/comercial/tabelas-de-preco/$id' as any });
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<SpreadsheetProductRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Buscar Tabela de Preço
  const { data: table, isLoading: isTableLoading } = useQuery({
    queryKey: ['price-table', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('price_tables' as any)
          .select(`
            *,
            manufacturer:manufacturers(id, name, logo_path),
            region:regions(id, name)
          `)
          .eq('id', id)
          .maybeSingle();

        if (data) return data;
      } catch (e) {
        console.warn('Fallback para getPriceTables() por id:', e);
      }

      // Se não encontrou no banco relacional, busca nas tabelas canônicas sintetizadas
      const allTables = await (await import('@/lib/pricing.services')).getPriceTables();
      const found = allTables.find(t => t.id === id || t.code === id);
      if (found) return found;

      throw new Error('Tabela de preços não encontrada');
    },
  });

  // Buscar Itens da Tabela
  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['price-table-items', id],
    queryFn: () => getPriceTableItems(id),
  });

  // Manipular upload de arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      const rows = await parseProductsSpreadsheet(file);
      if (rows.length === 0) {
        toast.error('Nenhum dado encontrado na planilha enviada.');
        return;
      }
      setParsedRows(rows);
      setIsImportModalOpen(true);
      toast.success(`${rows.length} produtos lidos da planilha!`);
    } catch (err: any) {
      toast.error('Erro ao ler planilha: ' + (err.message || 'Formato inválido'));
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirmar Importação
  const handleConfirmImport = async () => {
    try {
      setIsImporting(true);
      const res = await importProductsToDatabase({
        rows: parsedRows,
        manufacturerId: table?.manufacturer_id,
        priceTableId: id,
        createMissingProducts: true,
      });

      toast.success(
        `Importação concluída! ${res.productsCreated} novos produtos, ${res.productsUpdated} atualizados e ${res.priceTableItemsLinked} preços vinculados.`
      );
      queryClient.invalidateQueries({ queryKey: ['price-table-items', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsImportModalOpen(false);
      setParsedRows([]);
    } catch (err: any) {
      toast.error('Erro durante a importação: ' + (err.message || 'Falha no banco'));
    } finally {
      setIsImporting(false);
    }
  };

  if (isTableLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!table) {
    return (
      <AppLayout>
        <div className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Tabela de Preços não encontrada</p>
          <Button variant="outline" asChild>
            <Link to="/comercial/tabelas-de-preco">Voltar para Tabelas</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const filteredItems = items.filter((item) => {
    const pName = item.product?.name || '';
    const pCode = item.product?.code || '';
    const pBrand = item.product?.brand || '';
    const term = searchTerm.toLowerCase();

    return (
      pName.toLowerCase().includes(term) ||
      pCode.toLowerCase().includes(term) ||
      pBrand.toLowerCase().includes(term)
    );
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link to="/comercial/tabelas-de-preco">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{table.name}</h1>
              {table.is_default && (
                <Badge variant="outline" className="text-purple-600 border-purple-300">
                  Padrão
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {table.code && <span>Código: <strong>{table.code}</strong></span>}
              <span>Público: <strong className="capitalize">{table.target_audience.replace('_', ' ')}</strong></span>
              <span className="inline-flex items-center gap-2">Fabricante: {table.manufacturer ? <><ManufacturerLogo name={table.manufacturer.name} logoPath={table.manufacturer.logo_path} size="sm" /><strong>{table.manufacturer.name}</strong></> : <strong>Multimarca</strong>}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="w-full sm:w-auto"
            >
              {isParsing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar Planilha (XLSX/CSV)
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Itens nesta Tabela</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{items.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Preço Médio Praticado</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-green-600">
                {items.length > 0
                  ? `R$ ${(items.reduce((acc, it) => acc + Number(it.unit_price || 0), 0) / items.length).toFixed(2)}`
                  : 'R$ 0,00'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Desconto Máximo Médio</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {items.length > 0
                  ? `${(items.reduce((acc, it) => acc + Number(it.max_discount_percent || 0), 0) / items.length).toFixed(1)}%`
                  : '0%'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Busca de Itens */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar item por nome ou código..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço de Tabela</TableHead>
                <TableHead>Preço Mínimo</TableHead>
                <TableHead>Desc. Máx.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isItemsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhum produto cadastrado nesta tabela de preços. Clique em "Importar Planilha" para carregar seus produtos.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.product?.code || item.product?.sku || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{item.product?.name}</div>
                      {item.product?.brand && (
                        <div className="text-xs text-muted-foreground">{item.product.brand}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs uppercase">
                      {item.product?.unit || 'UN'}
                    </TableCell>
                    <TableCell className="font-bold text-sm text-foreground">
                      R$ {Number(item.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.min_price
                        ? `R$ ${Number(item.min_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.max_discount_percent || 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modal de Pré-visualização da Importação */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Pré-visualização da Importação
              </DialogTitle>
              <DialogDescription>
                Revise os produtos identificados na sua planilha antes de gravar no catálogo e na tabela de preços.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto border rounded-lg p-2 my-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Preço Tabela</TableHead>
                    <TableHead>Preço Mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{row.code || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{row.name}</TableCell>
                      <TableCell className="text-xs uppercase">{row.unit}</TableCell>
                      <TableCell className="text-xs font-bold">
                        R$ {row.tablePrice?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        R$ {row.minPrice?.toFixed(2) || '0.00'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 50 && (
                <p className="text-xs text-center text-muted-foreground py-2 border-t">
                  + {parsedRows.length - 50} outros produtos na lista...
                </p>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total a importar: <strong>{parsedRows.length} itens</strong>
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmImport} disabled={isImporting}>
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar e Salvar no Catálogo
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
