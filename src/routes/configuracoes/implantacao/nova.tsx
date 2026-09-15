import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UploadCloud,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Database,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importService, ImportDataType, ColumnMapping } from "@/lib/import.services";
import {
  importClientsToDatabase,
  parseClientsSpreadsheet,
  ClientImportResult,
} from "@/lib/import-clients";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/configuracoes/implantacao/nova")({
  component: NewImportPage,
});

type Step = "type" | "upload" | "mapping" | "preview" | "processing" | "result";

function NewImportPage() {
  const [step, setStep] = useState<Step>("type");
  const [dataType, setDataType] = useState<ImportDataType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: any[] } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ClientImportResult | null>(null);
  const queryClient = useQueryClient();

  const handleTypeSelect = (type: ImportDataType) => {
    setDataType(type);
    setStep("upload");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setIsLoading(true);
    try {
      const { headers, rows } = await importService.parseFile(uploadedFile);
      setFile(uploadedFile);
      setParsedData({ headers, rows });
      const suggestions = importService.suggestMapping(headers, dataType as ImportDataType);
      setMapping(suggestions);
      setStep("mapping");
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (sheetColumn: string, systemField: string) => {
    setMapping((prev) => {
      const existing = prev.find((m) => m.sheetColumn === sheetColumn);
      if (existing) {
        if (systemField === "ignore") {
          return prev.filter((m) => m.sheetColumn !== sheetColumn);
        }
        return prev.map((m) => (m.sheetColumn === sheetColumn ? { ...m, systemField } : m));
      }
      if (systemField !== "ignore") {
        return [...prev, { sheetColumn, systemField }];
      }
      return prev;
    });
  };

  const startImport = async () => {
    if (!file || !dataType) {
      toast.error("Selecione um arquivo e o tipo de dado antes de continuar.");
      return;
    }

    setStep("processing");
    setProgress(10);
    setImportResult(null);

    try {
      if (dataType === "clientes") {
        const rows = await parseClientsSpreadsheet(file);
        setProgress(35);
        const result = await importClientsToDatabase(rows);
        setProgress(80);

        await importService.createImportRecord({
          fileName: file.name,
          fileSize: file.size,
          dataType,
          mapping,
          status: result.errors > 0 ? "completed_with_errors" : "completed",
          summary: { ...result },
          errorsLog: result.failedRows,
        });

        setImportResult(result);
        setProgress(100);
        queryClient.invalidateQueries({ queryKey: ["clients-list"] });
        queryClient.invalidateQueries({ queryKey: ["clients-stats"] });
        queryClient.invalidateQueries({ queryKey: ["clients-all-simple"] });
        queryClient.invalidateQueries({ queryKey: ["clients-map-all"] });

        if (result.errors > 0) {
          setStep("result");
          toast.error(`Importação concluída com ${result.errors} erro(s).`);
        } else {
          setStep("result");
          toast.success(
            `Importação confirmada: ${result.created} novos e ${result.updated} atualizados.`,
          );
        }
        return;
      }

      await importService.createImportRecord({
        fileName: file.name,
        fileSize: file.size,
        dataType,
        mapping,
      });
      setProgress(100);
      setStep("result");
      toast.success("Implantação salva com sucesso!");
    } catch (err: any) {
      setStep("preview");
      toast.error("Erro ao importar: " + (err?.message || "Erro desconhecido"));
    }
  };

  const renderStep = () => {
    switch (step) {
      case "type":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">O que você deseja importar?</h2>
              <p className="text-muted-foreground">
                Selecione o tipo de dado para iniciar o mapeamento.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: "representantes", label: "Representantes", icon: Users },
                { id: "clientes", label: "Clientes", icon: Database },
                { id: "produtos", label: "Produtos", icon: FileSpreadsheet },
                { id: "pedidos", label: "Pedidos", icon: FileText },
                { id: "metas", label: "Metas", icon: CheckCircle2 },
                { id: "regioes", label: "Regiões", icon: AlertCircle },
              ].map((item) => (
                <Card
                  key={item.id}
                  className="hover:border-primary cursor-pointer transition-all hover:shadow-md group"
                  onClick={() => handleTypeSelect(item.id as ImportDataType)}
                >
                  <CardHeader className="text-center p-6">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{item.label}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        );

      case "upload":
        return (
          <Card className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Envio da Planilha</CardTitle>
              <CardDescription>Formatos aceitos: .xlsx, .xls, .csv</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed rounded-lg p-10 text-center space-y-4 hover:bg-muted/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Clique para selecionar ou arraste o arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Máximo 10MB</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between border-t pt-6">
              <Button variant="ghost" onClick={() => setStep("type")}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            </CardFooter>
          </Card>
        );

      case "mapping":
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Mapeamento de Colunas</h2>
                <p className="text-muted-foreground">
                  Relacione as colunas da sua planilha com os campos do sistema.
                </p>
              </div>
              <Badge variant="outline" className="px-3 py-1">
                {file?.name} ({parsedData?.rows.length} linhas)
              </Badge>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna da Planilha</TableHead>
                    <TableHead>Campo no Safyra Safety</TableHead>
                    <TableHead>Prévia (Linha 1)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData?.headers.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={
                            mapping.find((m) => m.sheetColumn === header)?.systemField || "ignore"
                          }
                          onValueChange={(val) => handleMappingChange(header, val)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">Ignorar Coluna</SelectItem>
                            <SelectItem value="name">Nome / Razão Social</SelectItem>
                            <SelectItem value="cnpj">CNPJ / CPF</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="city">Cidade</SelectItem>
                            <SelectItem value="state">Estado (UF)</SelectItem>
                            <SelectItem value="code">Código / SKU</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {String(parsedData.rows[0]?.[header] || "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CardFooter className="justify-between border-t p-6">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button onClick={() => setStep("preview")}>
                  Continuar para Prévia <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pré-visualização</h2>
                <p className="text-muted-foreground">
                  Confira como os dados serão importados antes de confirmar.
                </p>
              </div>
            </div>

            <Card>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mapping.map((m) => (
                        <TableHead key={m.sheetColumn} className="whitespace-nowrap">
                          {m.systemField.toUpperCase()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData?.rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {mapping.map((m) => (
                          <TableCell key={m.sheetColumn} className="text-sm">
                            {String(row[m.sheetColumn] || "-")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-muted/50 border-t text-xs text-center text-muted-foreground">
                Exibindo as primeiras 10 de {parsedData?.rows.length} linhas.
              </div>
              <CardFooter className="justify-between border-t p-6">
                <Button variant="ghost" onClick={() => setStep("mapping")}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={startImport}>
                  Confirmar Implantação <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        );

      case "processing":
        return (
          <Card className="max-w-xl mx-auto py-10 text-center space-y-6 animate-in fade-in duration-500">
            <CardHeader>
              <CardTitle>Processando Implantação</CardTitle>
              <CardDescription>
                Estamos validando e salvando os dados. Não feche esta janela.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-10 space-y-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Importando {dataType}...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validando duplicidades e normalizando campos...
              </div>
            </CardContent>
          </Card>
        );

      case "result": {
        const hasImportErrors = Boolean(importResult?.errors);
        const result = importResult || {
          total: parsedData?.rows.length || 0,
          created: 0,
          updated: 0,
          errors: 0,
          failedRows: [],
        };

        return (
          <Card className="max-w-xl mx-auto py-10 text-center space-y-6 animate-in zoom-in duration-500">
            <CardHeader>
              <div
                className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${hasImportErrors ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
              >
                {hasImportErrors ? (
                  <AlertCircle className="h-10 w-10 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                )}
              </div>
              <CardTitle className="text-3xl">
                {hasImportErrors ? "Importação concluída com erros" : "Implantação confirmada"}
              </CardTitle>
              <CardDescription>
                {hasImportErrors
                  ? "Algumas linhas não foram persistidas. Consulte os detalhes abaixo."
                  : "As gravações foram confirmadas pelo banco de dados."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-left border rounded-lg p-6 bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase">
                    Total Processado
                  </p>
                  <p className="text-2xl font-bold">{result.total}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase text-green-600">
                    Novos Registros
                  </p>
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase text-blue-600">
                    Atualizados
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase text-red-600">
                    Com Erro
                  </p>
                  <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                </div>
              </div>
              {hasImportErrors && (
                <div className="text-left border border-red-200 rounded-lg p-4 bg-red-50/50 text-sm space-y-2">
                  {result.failedRows.map((failure) => (
                    <p key={`${failure.row}-${failure.legalName}`}>
                      Linha {failure.row} — {failure.legalName}: {failure.message}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-3 pt-6 px-10">
              <Button className="w-full" asChild>
                <Link to="/configuracoes/implantacao">Ir para Histórico</Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep("type")}>
                Nova Importação
              </Button>
            </CardFooter>
          </Card>
        );
      }
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto py-6">{renderStep()}</div>
    </AppLayout>
  );
}
