import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ProductForm } from '@/components/produtos/ProductForm';
import { toast } from 'sonner';

export const Route = createFileRoute('/comercial/produtos/novo')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Novo Produto" },
      { name: "description", content: "Cadastro de novos produtos no catálogo Safyra." },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();

  const handleSubmit = async (data: any) => {
    console.log('Novo produto:', data);
    toast.success('Produto cadastrado com sucesso!');
    navigate({ to: '/comercial/produtos' });
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link to="/comercial/produtos">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Novo Produto</h1>
              <p className="text-muted-foreground">Cadastre um novo item no catálogo comercial.</p>
            </div>
          </div>

          <ProductForm 
            onSubmit={handleSubmit} 
            onCancel={() => navigate({ to: '/comercial/produtos' })} 
          />
        </div>
      </div>
    </AppLayout>
  );
}
