import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitário centralizado para upload de arquivos no Supabase Storage.
 * Resolve problemas comuns de permissão e estrutura de pastas.
 */
export async function uploadFile(
  bucket: string,
  file: File,
  options: {
    folder?: string;
    onProgress?: (percent: number) => void;
  } = {},
) {
  if (!file) throw new Error("Arquivo não fornecido.");

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!fileExt || !/^[a-z0-9]+$/.test(fileExt)) {
    throw new Error("Extensão de arquivo inválida.");
  }

  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const folder = options.folder?.replace(/^\/|\/$/g, "");
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  options.onProgress?.(0);

  const { error: uploadError, data } = await supabase.storage.from(bucket).upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) throw uploadError;
  options.onProgress?.(100);

  let url: string;
  if (bucket === "avatars-new-private") {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60);

    if (signedError) {
      await supabase.storage.from(bucket).remove([filePath]);
      throw signedError;
    }
    url = signedData.signedUrl;
  } else {
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);
    url = publicUrl;
  }

  return {
    publicUrl: url,
    filePath,
    data,
  };
}
