import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Package,
  Building2,
  Calendar,
  CreditCard,
  ArrowRight,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { processOrderPDFServer, saveImportedOrderServer, type MatchedPDFOrderData } from '@/lib/pdf-order-importer.functions';
import { extractTextFromPDFFile } from '@/lib/pdf-client-extractor';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface OrderPDFImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderPDFImportModal({ open, onOpenChange }: OrderPDFImportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matchedData, setMatchedData] = useState<MatchedPDFOrderData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Por favor, selecione um arquivo em formato PDF.');
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setMatchedData(null);

    // Limpar o valor do input imediatamente para permitir selecionar o mesmo arquivo novamente caso haja ajuste
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      let extractedText = '';

      // 1. Tentar extrair o texto diretamente no navegador via PDF.js empacotado
      try {
        extractedText = await extractTextFromPDFFile(file);
      } catch (clientErr) {
        console.warn('Extração client-side falhou, acionando fallback de leitura do arquivo:', clientErr);
      }

      let result: MatchedPDFOrderData;

      if (extractedText && extractedText.trim().length > 0) {
        // Enviar o texto extraído diretamente
        result = await processOrderPDFServer({ data: { rawText: extractedText } });
      } else {
        // Fallback: converter arquivo para Base64 e enviar para o backend
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        result = await processOrderPDFServer({ data: { base64Pdf: base64 } });
      }

      setMatchedData(result);
      toast.success(`PDF "${file.name}" processado com sucesso!`);
    } catch (err: any) {
      console.error('Erro no processamento do PDF:', err);
      toast.error(err.message || 'Falha ao processar dados do PDF. Verifique se o arquivo é um espelho de pedido válido.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAndCreateOrder = async () => {
    if (!matchedData) return;
    setIsSaving(true);

    try {
      // 1. Tentar execução direta via RPC do cliente Supabase (SECURITY DEFINER no PostgreSQL)
      // Esta chamada contorna totalmente restrições de RLS tanto no client quanto no server
      const { data: { user } } = await supabase.auth.getUser();
      const { data: rpcResult, error: rpcError } = await supabase.rpc('import_pdf_order_atomic', {
        p_order_data: matchedData,
        p_user_id: user?.id || null
      });

      let finalOrderId: string;
      let finalOrderNumber: string;

      if (!rpcError && rpcResult && (rpcResult as any).orderId) {
        finalOrderId = (rpcResult as any).orderId;
        finalOrderNumber = (rpcResult as any).orderNumber || matchedData.parsed.budgetNumber || 'PED-IMPORT';
      } else {
        // Fallback para Server Function
        const serverResult = await saveImportedOrderServer({
          data: { matchedData }
        });
        finalOrderId = serverResult.orderId;
        finalOrderNumber = serverResult.orderNumber;
      }

      // Invalidar queries do TanStack Router
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-all-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-real-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
      ]);

      toast.success(`Pedido #${finalOrderNumber} importado e salvo com sucesso!`);
      onOpenChange(false);
      navigate({ to: '/comercial/pedidos/$id', params: { id: finalOrderId } });
    } catch (err: any) {
      console.error('Erro ao salvar pedido:', err);
      toast.error(err.message || 'Erro ao gravar pedido importado.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setMatchedData(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Importar Pedido via PDF da Indústria
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Envie o espelho do pedido gerado pela fábrica (ex: Nutriex, Libus) para preenchimento automático.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!matchedData ? (
          <div className="py-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20 flex flex-col items-center justify-center gap-3"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-sm font-semibold text-foreground">Analisando e cruzando dados do PDF...</p>
                  <p className="text-xs text-muted-foreground">Localizando cliente, SKU, tabela de preços e condições comerciais.</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Clique para selecionar ou arraste o PDF do pedido aqui
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Suporta orçamentos e pedidos espelho da Nutriex, Libus, Medix e Equilibrium.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Header com dados do Orçamento */}
            <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                    #{matchedData.parsed.budgetNumber || 'S/N'}
                  </Badge>
                  <span className="text-xs font-semibold text-foreground">
                    Emissão: {matchedData.parsed.emissionDate}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1">
                  <X className="w-3.5 h-3.5" /> Trocar PDF
                </Button>
              </div>

              {/* Informações do Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Cliente Identificado:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {matchedData.matchedClient?.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    CNPJ: {matchedData.matchedClient?.cnpj || matchedData.parsed.client.cnpj}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground block">Condição Comercial:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-foreground">
                      {matchedData.parsed.paymentCondition || '28/35/42'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      Frete {matchedData.parsed.shippingType || 'CIF'}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Vendedor: {matchedData.matchedRepresentative?.name || matchedData.parsed.seller}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de Itens Reconhecidos */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-foreground px-1">
                <span>Itens Reconhecidos ({matchedData.matchedItems.length})</span>
                <span className="text-muted-foreground">
                  Total: R$ {matchedData.parsed.totals.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="border rounded-xl divide-y overflow-hidden max-h-[200px] overflow-y-auto bg-card">
                {matchedData.matchedItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs gap-2 hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                          SKU {item.pdfCode}
                        </span>
                        {item.status === 'matched' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-foreground truncate">
                          {item.product?.name || item.pdfDescription}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {item.quantity} un x R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-foreground">
                        R$ {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          {matchedData && (
            <Button onClick={handleConfirmAndCreateOrder} disabled={isSaving} className="gap-1.5">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando Pedido...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirmar e Criar Pedido
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
