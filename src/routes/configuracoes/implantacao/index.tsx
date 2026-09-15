import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { clearSystemData } from "@/lib/setup.functions";
import { importAllSpreadsheetsDirectly } from "@/lib/import-all.functions";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UploadCloud,
  History,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Database,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configuracoes/implantacao/")({
  head: () => ({
    meta: [
      { title: "Safyra Safety | Implantação de Dados" },
      { name: "description", content: "Importe e gerencie cargas de dados via planilha." },
    ],
  }),
  component: DataImportIndex,
});

function DataImportIndex() {
  const [clearing, setClearing] = useState(false);
  const [importingAll, setImportingAll] = useState(false);
  const clearData = useServerFn(clearSystemData);
  const importAll = useServerFn(importAllSpreadsheetsDirectly);
  const { queryClient } = Route.useRouteContext();

  const handleImportAllSpreadsheets = async () => {
    try {
      setImportingAll(true);
      const result = await importAll();
      if (result.success) {
        toast.success(result.message);
        if (queryClient) {
          queryClient.invalidateQueries();
        } else {
          window.location.reload();
        }
      } else {
        toast.error(result.message || "Erro na importação em massa");
      }
    } catch (error: any) {
      toast.error("Erro na execução: " + error.message);
    } finally {
      setImportingAll(false);
    }
  };

  const handleClearSystem = async () => {
    const confirmation = window.prompt(
      'AVISO CRÍTICO: esta ação apagará TODOS os dados operacionais. Digite "LIMPAR SISTEMA" para confirmar.',
    );

    if (confirmation !== "LIMPAR SISTEMA") {
      toast.error("A limpeza foi cancelada: a confirmação não confere.");
      return;
    }

    try {
      setClearing(true);
      const result = await clearData({ data: { confirmation } });
      if (result.success) {
        toast.success(result.message);
        // Invalida todas as queries para atualizar o front-end
        if (queryClient) {
          queryClient.invalidateQueries();
        } else {
          window.location.reload();
        }
      } else {
        toast.error(result.message || "Erro ao limpar sistema");
      }
    } catch (error: any) {
      toast.error("Erro na operação: " + error.message);
    } finally {
      setClearing(false);
    }
  };

  const { data: history, isLoading } = useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_imports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((item) => item.user_id).filter(Boolean))];
      const { data: profilesData, error: profilesError } = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profileMap = new Map((profilesData || []).map((profile) => [profile.id, profile]));

      return data.map((item) => ({
        ...item,
        profiles: profileMap.get(item.user_id) || null,
      }));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Concluída
          </Badge>
        );
      case "completed_with_errors":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" /> Com Erros
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Clock className="h-3 w-3 mr-1" /> Processando
          </Badge>
        );
      case "pending":
        return <Badge variant="outline">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Implantação de Dados</h1>
            <p className="text-muted-foreground">
              Importe suas planilhas existentes para o Safyra Safety. Revise, valide e confirme os
              dados antes da implantação.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/configuracoes/implantacao/nova">
              <Plus className="mr-2 h-5 w-5" /> Nova Importação
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Modelos de Planilha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Utilize nossos modelos oficiais para garantir a compatibilidade dos dados.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <a
                    href="/modelo_representantes.xlsx"
                    download="modelo_representantes.xlsx"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" /> Representantes
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <a
                    href="/modelo_clientes.xlsx"
                    download="modelo_clientes.xlsx"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" /> Clientes
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="justify-start" asChild>
                  <a
                    href="/modelo_produtos.xlsx"
                    download="modelo_produtos.xlsx"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" /> Produtos
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-indigo-50/50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Database className="h-5 w-5" />
                Dicas de Implantação
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>Limpe dados duplicados na planilha original.</li>
                <li>Verifique se CNPJs e CPFs estão corretos.</li>
                <li>Mapeie campos obrigatórios como Nome e Documento.</li>
                <li>
                  <span className="font-semibold text-foreground">Produtos e Fabricantes:</span>{" "}
                  Todo produto deve possuir um fabricante vinculado para garantir o cálculo correto
                  de comissões.
                </li>
                <li>Salve o mapeamento como modelo para futuras cargas.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-sm text-muted-foreground">Total de Importações</span>
                <span className="font-bold">{history?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-sm text-muted-foreground">Último Sucesso</span>
                <span className="text-xs font-medium">10/08/2026</span>
              </div>
              <Button variant="ghost" className="w-full text-xs" asChild>
                <Link to="/configuracoes/auditoria">
                  Ver logs detalhados <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Carga Rápida dos Fabricantes Nutriex & Libus */}
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/40">
          <CardHeader>
            <CardTitle className="text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Carga Completa de Fabricantes Oficiais (Nutriex & Libus)
            </CardTitle>
            <CardDescription>
              Executa a importação direta das planilhas de catálogo e tabelas de preço
              multidimensionais (Varejo, Revenda, Distribuidores) com a precificação de Goiás /
              Centro-Oeste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-emerald-800/90 dark:text-emerald-400">
                <strong>Arquivos Mapeados:</strong> 6 planilhas (Nutriex Profissional + 5 Tabelas
                Libus Brasil V13) totalizando mais de 310 produtos e 1.300+ precificações por
                público.
              </div>
              <Button
                variant="default"
                onClick={handleImportAllSpreadsheets}
                disabled={importingAll}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {importingAll ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando Carga...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    EXECUTAR IMPORTAÇÃO NUTRIEX & LIBUS
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Limpeza de Dados
            </CardTitle>
            <CardDescription>
              Utilize esta opção para remover todos os dados de teste e preparar o sistema para
              entrada de dados reais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-red-700/80">
                <strong>Atenção:</strong> Esta ação é irreversível e apagará pedidos, clientes,
                regiões e histórico.
              </div>
              <Button
                variant="destructive"
                onClick={handleClearSystem}
                disabled={clearing}
                className="w-full md:w-auto"
              >
                {clearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    LIMPAR SISTEMA (DADOS REAIS)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Importações</CardTitle>
            <CardDescription>
              Acompanhe o status e os resultados das implantações anteriores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                Carregando histórico...
              </div>
            ) : history && history.length > 0 ? (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.file_name}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {item.data_type.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.profiles?.full_name || "Desconhecido"}
                        </TableCell>
                        <TableCell className="text-xs">{item.summary?.total || 0}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to="/configuracoes/implantacao/$id" params={{ id: item.id }}>
                              Detalhes <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 space-y-4 border-2 border-dashed rounded-lg">
                <UploadCloud className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                <div className="space-y-1">
                  <p className="font-medium text-muted-foreground">Nenhuma importação realizada</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Inicie uma nova importação para carregar dados de representantes, clientes ou
                    produtos.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/configuracoes/implantacao/nova">Começar agora</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
