import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProductForm } from './ProductForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
  onSuccess?: () => void;
}

export function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setIsLoading(true);

      const payload = {
        name: values.name,
        code: values.code,
        sku: values.code || values.sku,
        trade_name: values.trade_name || null,
        category_id: values.category_id,
        manufacturer_id: values.manufacturer_id || null,
        subcategory: values.subcategory || null,
        brand: values.brand || null,
        unit: values.unit || 'Un',
        status: values.status,
        price: parseFloat(values.price.toString().replace(',', '.')) || 0,
        min_price: values.min_price ? parseFloat(values.min_price.toString().replace(',', '.')) : null,
        commission_rate: values.commission_rate ? parseFloat(values.commission_rate.toString().replace(',', '.')) : null,
        commercial_notes: values.commercial_notes || null,
        description: values.description || null,
        specifications: values.specifications || null,
        applications: values.applications || null,
        main_image_url: values.main_image_url || null,
        updated_at: new Date().toISOString(),
      };

      if (product?.id) {
        // Atualização
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id);

        if (error) throw error;
        toast.success('Produto atualizado com sucesso!');
      } else {
        // Criação
        const { error } = await supabase
          .from('products')
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
        toast.success('Produto cadastrado com sucesso!');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ProductFormModal] Erro ao salvar produto:', err);
      toast.error('Erro ao salvar produto: ' + (err.message || 'Falha na gravação'));
    } finally {
      setIsLoading(false);
    }
  };

  const initialData = product ? {
    name: product.name || '',
    code: product.code || product.sku || '',
    sku: product.sku || product.code || '',
    trade_name: product.trade_name || '',
    category_id: product.category_id || (product.categories as any)?.id || '',
    manufacturer_id: product.manufacturer_id || (product.manufacturers as any)?.id || '',
    subcategory: product.subcategory || '',
    brand: product.brand || '',
    unit: product.unit || 'Un',
    status: product.status || 'active',
    price: product.price?.toString() || '0',
    min_price: product.min_price?.toString() || '',
    commission_rate: product.commission_rate?.toString() || '',
    commercial_notes: product.commercial_notes || '',
    description: product.description || '',
    specifications: product.specifications || '',
    applications: product.applications || '',
    main_image_url: product.main_image_url || product.photo_url || null,
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold">
            {product?.id ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {product?.id
              ? 'Atualize as informações comerciais, fiscais e técnicas do produto.'
              : 'Preencha os campos para cadastrar um novo item no catálogo comercial.'}
          </DialogDescription>
        </DialogHeader>

        <ProductForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
