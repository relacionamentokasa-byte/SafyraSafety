import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, Layers, Edit, Trash2, Power, PowerOff, MoreVertical } from 'lucide-react';
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
import { Card, CardContent } from "@/components/ui/card";
import { useState } from 'react';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/comercial/produtos/categorias')({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Categorias de Produtos" },
      { name: "description", content: "Gestão das categorias e subcategorias do catálogo." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: '1', name: 'EPIs', description: 'Equipamentos de Proteção Individual', status: 'active', products_count: 85 },
    { id: '2', name: 'Ferramentas', description: 'Ferramentas manuais e elétricas', status: 'active', products_count: 24 },
    { id: '3', name: 'Uniforme', description: 'Vestuário profissional e uniformes', status: 'inactive', products_count: 12 },
    { id: '4', name: 'Sinalização', description: 'Cones, fitas e placas', status: 'active', products_count: 31 },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-muted/10">
        <div className="p-4 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Categorias</h1>
              <p className="text-muted-foreground">Organize seus produtos em categorias e subcategorias.</p>
            </div>
            <Button className="w-full md:w-auto gap-2">
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar categorias..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead className="text-center">Produtos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{cat.description}</TableCell>
                      <TableCell className="text-center text-sm font-semibold">{cat.products_count}</TableCell>
                      <TableCell>
                        <Badge variant={cat.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {cat.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="flex items-center gap-2">
                              <Edit className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className={cn(
                              "flex items-center gap-2",
                              cat.status === 'active' ? "text-destructive" : "text-green-500"
                            )}>
                              {cat.status === 'active' ? (
                                <><PowerOff className="h-4 w-4" /> Desativar</>
                              ) : (
                                <><Power className="h-4 w-4" /> Ativar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex items-center gap-2 text-destructive">
                              <Trash2 className="h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
