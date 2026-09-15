import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadFile } from '@/lib/storage';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Package, CircleDollarSign, Info, FileText, ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { ManufacturerLogo } from '@/components/manufacturers/ManufacturerLogo';

const productSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  trade_name: z.string().optional(),
  category_id: z.string().min(1, 'Categoria é obrigatória'),
  manufacturer_id: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  status: z.enum(['active', 'inactive']),
  price: z.string().min(1, 'Preço é obrigatório'),
  min_price: z.string().optional(),
  commission_rate: z.string().optional(),
  commercial_notes: z.string().optional(),
  description: z.string().optional(),
  specifications: z.string().optional(),
  applications: z.string().optional(),
  main_image_url: z.string().optional().nullable(),
});

interface ProductFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.main_image_url || initialData?.photo_url || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      status: 'active',
      unit: 'Un',
      main_image_url: null,
    },
  });

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    try {
      setIsUploadingImage(true);
      const res = await uploadFile('products', file, { folder: 'catalog' });
      setImagePreview(res.publicUrl);
      form.setValue('main_image_url', res.publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (err: any) {
      console.error('Erro no upload da foto:', err);
      toast.error('Erro no upload: ' + (err.message || 'Falha ao enviar'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    form.setValue('main_image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manufacturers').select('id, name, logo_path').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="main" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="main" className="gap-2">
              <Package className="h-4 w-4" /> <span className="hidden md:inline">Principais</span>
            </TabsTrigger>
            <TabsTrigger value="commercial" className="gap-2">
              <CircleDollarSign className="h-4 w-4" /> <span className="hidden md:inline">Comercial</span>
            </TabsTrigger>
            <TabsTrigger value="technical" className="gap-2">
              <Info className="h-4 w-4" /> <span className="hidden md:inline">Técnico</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <ImageIcon className="h-4 w-4" /> <span className="hidden md:inline">Arquivos</span>
            </TabsTrigger>
          </TabsList>

          <Card className="mt-4">
            <CardContent className="pt-6">
              {/* Informações Principais */}
              <TabsContent value="main" className="m-0 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código do Produto</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: PRD-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="inactive">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo do produto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trade_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Comercial</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome utilizado na abordagem de vendas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manufacturer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fabricante</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {manufacturers?.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="flex items-center gap-2"><ManufacturerLogo name={m.name} logoPath={m.logo_path} size="sm" />{m.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subcategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategoria</FormLabel>
                        <FormControl>
                          <Input placeholder="Opcional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca/Linha</FormLabel>
                        <FormControl>
                          <Input placeholder="Opcional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Informações Comerciais */}
              <TabsContent value="commercial" className="m-0 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Venda (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="min_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Mínimo (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade de Venda</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Un">Unidade (Un)</SelectItem>
                            <SelectItem value="Par">Par</SelectItem>
                            <SelectItem value="Cx">Caixa (Cx)</SelectItem>
                            <SelectItem value="Kg">Quilo (Kg)</SelectItem>
                            <SelectItem value="M">Metro (M)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="commission_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comissão Padrão (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormDescription>Percentual de comissão padrão para este produto.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="commercial_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Comerciais</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Argumentos de venda, promoções ou restrições..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Informações Técnicas */}
              <TabsContent value="technical" className="m-0 space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição Completa</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especificações Técnicas</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Material, dimensões, certificações (C.A.), etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="applications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aplicações Recomendadas</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Onde e como utilizar o produto..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Imagens e Arquivos */}
              <TabsContent value="files" className="m-0 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormLabel>Imagem Principal</FormLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleImageFileSelect}
                    />

                    <div className="relative aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-muted/30 overflow-hidden group">
                      {imagePreview ? (
                        <>
                          <img
                            src={imagePreview}
                            alt="Preview do produto"
                            className="w-full h-full object-contain p-4"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingImage}
                              className="text-xs gap-1"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Trocar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={handleRemoveImage}
                              disabled={isUploadingImage}
                              className="text-xs gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors p-4"
                        >
                          {isUploadingImage ? (
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          )}
                          <p className="text-xs font-medium text-foreground">
                            {isUploadingImage ? 'Enviando imagem...' : 'Clique para fazer upload da foto'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            JPG, PNG ou WEBP até 5MB
                          </p>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Cadastrar Produto'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
