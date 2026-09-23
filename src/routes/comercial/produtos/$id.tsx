import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Package,
  FileText,
  History,
  CircleDollarSign,
  Share2,
  Download,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Loader2,
  Tag,
  Camera,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import { ProductImageModal } from '@/components/produtos/ProductImageModal';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_PRICE_TABLES } from '@/lib/pricing.services';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';
import { formatDisplayName } from '@/lib/format';

export const Route = createFileRoute('/comercial/produtos/$id')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Detalhes do Produto" },
      { name: "description", content: "Informações técnicas e comerciais detalhadas do produto." },
    ],
  }),
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Buscar produto real no banco de dados
  const { data: dbProduct, isLoading } = useQuery({
    queryKey: ['product-details', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(name),
          manufacturer:manufacturers(name, logo_path)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const technicalSpecs = (dbProduct as any)?.technical_specifications || {};
  const pricesGrid = technicalSpecs?.prices || {};

  const product = {
    id: dbProduct?.id || id,
    code: dbProduct?.code || dbProduct?.sku || 'PRD',
    name: formatDisplayName(dbProduct?.name || 'Produto'),
    trade_name: formatDisplayName(dbProduct?.trade_name || dbProduct?.name || ''),
    category: (dbProduct as any)?.category?.name || 'Geral',
    brand: (dbProduct as any)?.brand || (dbProduct as any)?.manufacturer?.name || 'Safyra',
    unit: dbProduct?.unit || 'UN',
    price: Number(dbProduct?.price || 0),
    min_price: Number(dbProduct?.min_price || Number(dbProduct?.price || 0) * 0.9),
    commission_rate: dbProduct?.commission_rate || 5.0,
    status: dbProduct?.status || 'active',
    description: dbProduct?.description || dbProduct?.name || 'Sem descrição cadastrada.',
    specifications: [
      { label: 'C.A. (Certificado de Aprovação)', value: technicalSpecs?.ca || 'Não aplicável' },
      { label: 'NCM', value: technicalSpecs?.ncm || 'Não informado' },
      { label: 'Código do Fabricante', value: dbProduct?.code || '-' },
      { label: 'Unidade de Medida', value: dbProduct?.unit || 'UN' },
    ],
    applications: dbProduct?.applications || 'Adequado para uso profissional e industrial de acordo com as normas vigentes.',
    main_image_url: dbProduct?.main_image_url || (dbProduct as any)?.photo_url || null,
    history: [
      { id: 'h1', action: 'Produto importado/atualizado', user: 'Sistema', date: new Date(dbProduct?.updated_at || Date.now()).toLocaleDateString('pt-BR'), notes: 'Carga automática de planilhas' }
    ]
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 space-y-6">
          {/* Breadcrumb / Back */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link to="/comercial/produtos">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Image */}
            <div className="w-full md:w-1/3 aspect-square rounded-xl bg-background border flex flex-col items-center justify-center overflow-hidden relative group">
              {product.main_image_url ? (
                <img
                  src={product.main_image_url}
                  alt={product.name}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/60 p-6 text-center">
                  <ImageIcon className="h-16 w-16 stroke-[1.5]" />
                  <span className="text-xs">Nenhuma foto cadastrada</span>
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsImageModalOpen(true)}
                className="absolute bottom-3 right-3 gap-1.5 text-xs shadow-md opacity-90 hover:opacity-100 backdrop-blur-xs bg-background/80 hover:bg-background"
              >
                <Camera className="h-3.5 w-3.5 text-primary" />
                {product.main_image_url ? 'Alterar Foto' : 'Adicionar Foto'}
              </Button>
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{product.code}</Badge>
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {product.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{product.name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground"><ManufacturerLogo name={(dbProduct as any)?.manufacturer?.name} logoPath={(dbProduct as any)?.manufacturer?.logo_path} size="sm" /><span>{product.category} • {product.brand}</span></div>
                </div>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Share2 className="h-4 w-4" />
                </Button>
                <div className="hidden md:flex gap-2">
                  <Button variant="outline" className="gap-2">
                    <Share2 className="h-4 w-4" /> Compartilhar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                <div className="space-y-1 border-l-2 border-primary pl-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Preço Base (Varejo)</span>
                  <p className="text-xl font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                  </p>
                </div>
                <div className="space-y-1 border-l-2 border-muted pl-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Preço Mínimo (Balcão)</span>
                  <p className="text-lg font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.min_price)}
                  </p>
                </div>
                <div className="space-y-1 border-l-2 border-muted pl-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Unidade</span>
                  <p className="text-lg font-medium">{product.unit}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Descrição</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Content */}
          <Tabs defaultValue="comercial" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
              <TabsTrigger value="comercial" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2">
                Tabelas de Preço & Comercial
              </TabsTrigger>
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2">
                Informações Técnicas
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-2">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comercial" className="py-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CircleDollarSign className="h-5 w-5 text-primary" /> Grade de Preços Multidimensional
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabela de Preço</TableHead>
                        <TableHead>Público / Nível</TableHead>
                        <TableHead>Preço de Venda</TableHead>
                        <TableHead>Preço Mínimo</TableHead>
                        <TableHead>Desconto Máximo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(pricesGrid).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            Nenhuma regra específica de tabela cadastrada. Preço base aplicado: R$ {product.price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.entries(pricesGrid).map(([code, pData]: [string, any]) => {
                          const canonical = CANONICAL_PRICE_TABLES.find(c => c.code === code || c.id === code);
                          return (
                            <TableRow key={code}>
                              <TableCell className="font-medium text-sm">
                                {canonical?.name || code}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize text-xs">
                                  {canonical?.target_audience?.replace('_', ' ') || 'Geral'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-sm text-green-600">
                                R$ {Number(pData.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                R$ {Number(pData.min_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {pData.max_discount_percent || 10}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="info" className="py-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" /> Especificações Técnicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {product.specifications.map((spec, index) => (
                      <div key={index} className="flex justify-between items-center text-sm border-b border-muted pb-2 last:border-0 last:pb-0">
                        <span className="text-muted-foreground">{spec.label}</span>
                        <span className="font-medium">{spec.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> Aplicações & Recomendações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {product.applications}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="py-6">
              <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                {product.history.map((item) => (
                  <div key={item.id} className="relative pl-12">
                    <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center z-10">
                      <History className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                      <div>
                        <p className="text-sm font-medium">{item.action}</p>
                        <p className="text-xs text-muted-foreground">Por {item.user} em {item.date}</p>
                      </div>
                      {item.notes && (
                        <Badge variant="outline" className="text-[10px] w-fit">{item.notes}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal para Alterar/Adicionar Foto do Produto */}
      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        product={{
          id: product.id,
          name: product.name,
          code: product.code,
          main_image_url: product.main_image_url,
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['product-details', id] });
        }}
      />
    </AppLayout>
  );
}
