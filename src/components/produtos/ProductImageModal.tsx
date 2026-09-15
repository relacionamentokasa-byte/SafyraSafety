import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";

interface ProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    code?: string | null;
    sku?: string | null;
    main_image_url?: string | null;
    photo_url?: string | null;
  } | null;
  onSuccess?: (newImageUrl: string | null) => void;
}

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const currentImage = product?.main_image_url || product?.photo_url || null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resetar estado quando o modal abre/muda de produto
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewUrl(currentImage);
      setCustomUrl(currentImage?.startsWith("http") ? currentImage : "");
    }
  }, [isOpen, currentImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    // Limite de 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);

    try {
      let finalImageUrl: string | null = null;

      if (activeTab === "upload") {
        if (selectedFile) {
          // Upload para o bucket 'products'
          const result = await uploadFile("products", selectedFile, {
            folder: "catalog",
          });
          finalImageUrl = result.publicUrl;
        } else {
          finalImageUrl = previewUrl;
        }
      } else {
        finalImageUrl = customUrl.trim() || null;
      }

      // Atualizar no banco de dados Supabase
      const { error } = await supabase
        .from("products")
        .update({
          main_image_url: finalImageUrl,
        } as any)
        .eq("id", product.id);

      if (error) throw error;

      toast.success(
        finalImageUrl
          ? "Foto do produto atualizada com sucesso!"
          : "Foto removida com sucesso!"
      );

      onSuccess?.(finalImageUrl);
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar foto:", err);
      toast.error("Erro ao atualizar foto: " + (err.message || "Tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          main_image_url: null,
        } as any)
        .eq("id", product.id);

      if (error) throw error;

      setPreviewUrl(null);
      setSelectedFile(null);
      setCustomUrl("");
      toast.success("Foto do produto removida!");
      onSuccess?.(null);
      onClose();
    } catch (err: any) {
      console.error("Erro ao remover foto:", err);
      toast.error("Erro ao remover foto: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Alterar Foto do Produto
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-semibold text-foreground">{product.name}</span>
            {(product.code || product.sku) && (
              <span className="font-mono ml-1.5 text-muted-foreground">
                ({product.code || product.sku})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preview da Imagem */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed bg-muted/20">
            <div className="relative w-40 h-40 rounded-lg bg-background border flex items-center justify-center overflow-hidden shadow-xs">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground/60">
                  <ImageIcon className="h-10 w-10 stroke-[1.5]" />
                  <span className="text-[11px]">Sem foto cadastrada</span>
                </div>
              )}
            </div>

            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 gap-1"
                onClick={() => {
                  setPreviewUrl(null);
                  setSelectedFile(null);
                  setCustomUrl("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isSaving}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar seleção
              </Button>
            )}
          </div>

          {/* Opções de Upload ou URL */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "upload" | "url")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Fazer Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Inserir URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed h-20 flex flex-col gap-1.5 text-xs hover:border-primary hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  {selectedFile ? selectedFile.name : "Clique para escolher uma imagem"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Formatos aceitos: JPG, PNG, WEBP (máx. 5MB)
                </span>
              </Button>
            </TabsContent>

            <TabsContent value="url" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="image-url" className="text-xs">
                  Link direto da imagem
                </Label>
                <Input
                  id="image-url"
                  placeholder="https://exemplo.com/foto-produto.jpg"
                  value={customUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setCustomUrl(url);
                    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
                      setPreviewUrl(url);
                    }
                  }}
                  className="text-xs h-9"
                  disabled={isSaving}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between border-t pt-3">
          {currentImage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveImage}
              disabled={isSaving}
              className="text-destructive hover:bg-destructive/10 text-xs w-full sm:w-auto"
            >
              Excluir Foto Atual
            </Button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs flex-1 sm:flex-initial gap-1.5"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar Foto
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
