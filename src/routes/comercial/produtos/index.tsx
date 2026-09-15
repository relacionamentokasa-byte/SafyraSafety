import { createFileRoute, Link } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  TrendingUp,
  MoreVertical,
  Eye,
  Edit,
  Copy,
  Power,
  PowerOff,
  Image as ImageIcon
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import { formatDisplayName } from '@/lib/format';
import { groupProductsIntoVariants, ProductGroup } from '@/lib/product-variants';
import { ProductColorSelector } from '@/components/produtos/ProductColorSelector';
import { ProductImageModal } from '@/components/produtos/ProductImageModal';
import { useQueryClient } from '@tanstack/react-query';

export const Route = createFileRoute('/comercial/produtos/')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Produtos" },
      { name: "description", content: "Gestão do catálogo de produtos, categorias e materiais comerciais." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVariantsMap, setSelectedVariantsMap] = useState<Record<string, string>>({});
  const [selectedProductForImage, setSelectedProductForImage] = useState<any | null>(null);

  // Estados dos filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');

  // Carregar dados para filtros
  const { data: categories } = useQuery({
    queryKey: ['product-categories-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers-list-simple'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manufacturers').select('id, name, logo_path').order('name');
      if (error) throw error;
      return data;
    }
  });


  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:product_categories(name),
          manufacturers(name, logo_path)
        `)
        .order('name');
      
      if (error) {
        toast.error('Erro ao carregar produtos: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const { data: categoriesCount } = useQuery({
    queryKey: ['categories-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('product_categories')
        .select('*', { count: 'exact', head: true });
      if (error) return 0;
      return count || 0;
    }
  });

  const products = productsData || [];
  const filteredProducts = products.filter(product => {
    const productIdentifier = (product.code || product.sku || '').toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      productIdentifier.includes(searchTerm.toLowerCase()) ||
      product.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
    const matchesManufacturer = manufacturerFilter === 'all' || product.manufacturer_id === manufacturerFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesManufacturer;
  });

  const groupedProducts = groupProductsIntoVariants(filteredProducts);

  const activeCount = products.filter(p => p.status === 'active').length;
  const inactiveCount = products.length - activeCount;

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Produtos</h1>
              <p className="text-sm text-muted-foreground mt-1">Gerencie o catálogo de EPIs, equipamentos e tabelas de preço ativas.</p>
            </div>
            <Button className="w-full md:w-auto gap-2 bg-primary text-primary-foreground font-semibold shadow-xs" asChild>
              <Link to="/comercial/produtos/novo">
                <Plus className="h-4 w-4" /> Novo Produto
              </Link>
            </Button>
          </div>

          {/* Indicators Integrados */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Catálogo de Produtos & Estoque Comercial
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-400">
                {products.length} SKUs homologados
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Total Cadastrado */}
              <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
                <div className="mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Cadastrado
                  </span>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                    {products.length}
                    <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">SKUs</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <span>Total de itens no sistema</span>
                  </div>
                </div>
              </div>

              {/* Ativos para Venda */}
              <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
                <div className="mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Ativos para Venda
                  </span>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                    {activeCount}
                    <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">ativos</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <span>Prontos para pedidos</span>
                  </div>
                </div>
              </div>

              {/* Inativos */}
              <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
                <div className="mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Inativos
                  </span>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                    {inactiveCount}
                    <span className="text-sm font-sans font-normal text-slate-400 ml-1.5">fora de linha</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                    <span>Fora de circulação</span>
                  </div>
                </div>
              </div>

              {/* Categorias */}
              <div className="p-5 flex flex-col justify-between hover:bg-slate-50/40 transition-colors">
                <div className="mb-2">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Categorias
                  </span>
                </div>
                <div>
                  <div className="text-2xl lg:text-3xl font-bold font-mono text-slate-900 tracking-tight">
                    {categoriesCount}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Famílias de produtos
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome, código ou marca..." 
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="md:w-auto md:px-4 md:gap-2">
                        <Filter className="h-4 w-4" />
                        <span className="hidden md:inline">Filtros</span>
                        {(statusFilter !== 'all' || categoryFilter !== 'all' || manufacturerFilter !== 'all') && (
                          <Badge variant="secondary" className="ml-2 px-1 h-4 min-w-4 rounded-full bg-primary text-primary-foreground">
                            !
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Filtros de Catálogo</h4>
                        <p className="text-sm text-muted-foreground">Refine os produtos exibidos.</p>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos os status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os status</SelectItem>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todas as categorias" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas as categorias</SelectItem>
                              {categories?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Fabricante</Label>
                          <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos os fabricantes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os fabricantes</SelectItem>
                              {manufacturers?.map((m) => (
                                <SelectItem key={m.id} value={m.id}><span className="flex items-center gap-2"><ManufacturerLogo name={m.name} logoPath={m.logo_path} size="sm" />{m.name}</span></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            setStatusFilter('all');
                            setCategoryFilter('all');
                            setManufacturerFilter('all');
                          }}
                        >
                          Limpar Filtros
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Product Cards (Otimizado para Celular) */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 bg-card rounded-xl border border-slate-200/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                <span className="text-xs text-muted-foreground">Carregando catálogo...</span>
              </div>
            ) : groupedProducts.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-xl border border-slate-200/80 text-muted-foreground text-sm">
                Nenhum produto encontrado.
              </div>
            ) : (
              groupedProducts.map((group) => {
                const selectedId = selectedVariantsMap[group.groupId] || group.defaultProduct.id;
                const activeVariant = group.variants.find((v) => v.product.id === selectedId) || group.variants[0];
                const product = activeVariant?.product || group.defaultProduct;
                const categoryName = (product.categories as any)?.name;
                const manufacturer = product.manufacturers as any;

                return (
                  <div
                    key={group.groupId}
                    className="p-3.5 bg-card rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-2.5 transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      {/* Foto / Miniatura com botão de troca rápida */}
                      <button
                        type="button"
                        onClick={() => setSelectedProductForImage(product)}
                        title="Alterar foto do produto"
                        className="group/img relative w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200/80 shrink-0 select-none"
                      >
                        {(product.main_image_url || (product as any).photo_url) ? (
                          <img
                            src={product.main_image_url || (product as any).photo_url}
                            alt={product.name}
                            className="w-full h-full object-contain p-1 group-hover/img:scale-105 transition-transform"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-slate-400" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <Edit className="h-3.5 w-3.5 text-white" />
                        </div>
                      </button>

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            to="/comercial/produtos/$id"
                            params={{ id: product.id }}
                            className="font-semibold text-sm text-slate-900 leading-snug line-clamp-2 hover:text-primary transition-colors"
                          >
                            {formatDisplayName(group.baseName)}
                          </Link>

                          {/* Menu de Ações Compacto */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1 text-slate-500">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link to="/comercial/produtos/$id" params={{ id: product.id }} className="flex items-center gap-2 cursor-pointer">
                                  <Eye className="h-4 w-4 text-primary" /> Visualizar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => setSelectedProductForImage(product)}
                              >
                                <ImageIcon className="h-4 w-4 text-primary" /> Alterar Foto
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-primary" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2">
                                <Copy className="h-4 w-4 text-primary" /> Duplicar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Fabricante e Categoria */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 flex-wrap">
                          {manufacturer?.name && (
                            <span className="font-medium text-slate-700 flex items-center gap-1">
                              <ManufacturerLogo name={manufacturer.name} logoPath={manufacturer.logo_path} size="sm" />
                              {manufacturer.name}
                            </span>
                          )}
                          {manufacturer?.name && categoryName && <span>•</span>}
                          {categoryName && (
                            <span className="text-slate-500 truncate max-w-[140px]">{categoryName}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Variações de cor/tamanho se houver */}
                    {group.hasMultipleVariants && (
                      <div className="pt-1 border-t border-slate-100">
                        <ProductColorSelector
                          variants={group.variants}
                          selectedProductId={product.id}
                          onSelectVariant={(variant) => {
                            setSelectedVariantsMap((prev) => ({
                              ...prev,
                              [group.groupId]: variant.product.id,
                            }));
                          }}
                          size="sm"
                        />
                      </div>
                    )}

                    {/* Rodapé do Card: Código SKU, Unidade e Preço */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 mt-0.5">
                      <div className="flex items-center gap-2">
                        {(product.code || product.sku) && (
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {product.code || product.sku}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {product.unit}
                        </span>
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.2 rounded",
                          product.status === 'active' ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"
                        )}>
                          {product.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-slate-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (Oculta no Mobile) */}
          <div className="hidden md:block rounded-xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[70px] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Foto</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Produto</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria</TableHead>
                    <TableHead className="hidden lg:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fabricante</TableHead>
                    <TableHead className="hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Unidade</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Preço Base</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Status</TableHead>
                    <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : groupedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum produto encontrado.
                      </TableCell>
                    </TableRow>
                  ) : groupedProducts.map((group) => {
                    const selectedId = selectedVariantsMap[group.groupId] || group.defaultProduct.id;
                    const activeVariant = group.variants.find((v) => v.product.id === selectedId) || group.variants[0];
                    const product = activeVariant?.product || group.defaultProduct;

                    return (
                      <TableRow key={group.groupId} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setSelectedProductForImage(product)}
                            title="Clique para alterar a foto do produto"
                            className="group/img relative w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border hover:border-primary transition-all cursor-pointer"
                          >
                            {(product.main_image_url || (product as any).photo_url) ? (
                              <img
                                src={product.main_image_url || (product as any).photo_url}
                                alt={product.name}
                                className="w-full h-full object-contain p-0.5 group-hover/img:scale-105 transition-transform"
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-muted-foreground group-hover/img:text-primary transition-colors" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Edit className="h-3.5 w-3.5 text-white" />
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          {(product.code || product.sku) ? (
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                              {product.code || product.sku}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {formatDisplayName(group.baseName)}
                              </span>
                            </div>
                            {group.hasMultipleVariants && (
                              <ProductColorSelector
                                variants={group.variants}
                                selectedProductId={product.id}
                                onSelectVariant={(variant) => {
                                  setSelectedVariantsMap((prev) => ({
                                    ...prev,
                                    [group.groupId]: variant.product.id,
                                  }));
                                }}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {(product.categories as any)?.name ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              {(product.categories as any).name}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {(product.manufacturers as any)?.name ? (
                            <span className="inline-flex items-center gap-2 font-medium text-foreground">
                              <ManufacturerLogo name={(product.manufacturers as any).name} logoPath={(product.manufacturers as any).logo_path} size="sm" />
                              {(product.manufacturers as any).name}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-center">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {product.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-extrabold text-right text-foreground">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-semibold text-slate-700">
                            {product.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link to="/comercial/produtos/$id" params={{ id: product.id }} className="flex items-center gap-2 cursor-pointer">
                                  <Eye className="h-4 w-4 text-primary" /> Visualizar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => setSelectedProductForImage(product)}
                              >
                                <ImageIcon className="h-4 w-4 text-primary" /> Alterar Foto
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2">
                                <Edit className="h-4 w-4 text-primary" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="flex items-center gap-2">
                                <Copy className="h-4 w-4 text-primary" /> Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            <DropdownMenuItem className={cn(
                              "flex items-center gap-2",
                              product.status === 'active' ? "text-destructive" : "text-emerald-600"
                            )}>
                              {product.status === 'active' ? (
                                <><PowerOff className="h-4 w-4" /> Desativar</>
                              ) : (
                                <><Power className="h-4 w-4" /> Ativar</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Alterar/Adicionar Foto do Produto */}
      <ProductImageModal
        isOpen={!!selectedProductForImage}
        onClose={() => setSelectedProductForImage(null)}
        product={selectedProductForImage}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }}
      />
    </AppLayout>
  );
}
