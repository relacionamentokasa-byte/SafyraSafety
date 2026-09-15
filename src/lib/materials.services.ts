import { supabase } from "@/integrations/supabase/client";
import { CommercialMaterial, MaterialHistory } from "@/types/database.types";

export async function getMaterials() {
  const { data, error } = await supabase
    .from('commercial_materials')
    .select('*, product:products(*), product_category:product_categories(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CommercialMaterial[];
}

export async function getMaterialsByProduct(productId: string) {
  const { data, error } = await supabase
    .from('commercial_materials')
    .select('*')
    .eq('product_id', productId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as CommercialMaterial[];
}

export async function getRecentMaterials(limit = 5) {
  const { data, error } = await supabase
    .from('commercial_materials')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as CommercialMaterial[];
}

export async function createMaterial(material: Partial<CommercialMaterial>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const materialToInsert = { ...material };
  delete (materialToInsert as any).product;
  delete (materialToInsert as any).product_category;

  const { data, error } = await supabase
    .from('commercial_materials')
    .insert([{ ...materialToInsert, created_by: user.id, updated_by: user.id } as any])
    .select()
    .single();

  if (error) throw error;
  return data as CommercialMaterial;
}

export async function updateMaterial(id: string, updates: Partial<CommercialMaterial>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const updatesToApply = { ...updates };
  delete (updatesToApply as any).product;
  delete (updatesToApply as any).product_category;

  const { data, error } = await supabase
    .from('commercial_materials')
    .update({ ...updatesToApply, updated_by: user.id } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CommercialMaterial;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase
    .from('commercial_materials')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function incrementUsage(id: string) {
  // We use a simple update here, in a real scenario we might use a dedicated RPC for atomic increment
  const { data: current } = await supabase
    .from('commercial_materials')
    .select('usage_count')
    .eq('id', id)
    .single();
  
  const count = (current?.usage_count || 0) + 1;
  
  await supabase
    .from('commercial_materials')
    .update({ usage_count: count })
    .eq('id', id);
}

export async function incrementShare(id: string) {
  const { data: current } = await supabase
    .from('commercial_materials')
    .select('share_count')
    .eq('id', id)
    .single();
  
  const count = (current?.share_count || 0) + 1;
  
  await supabase
    .from('commercial_materials')
    .update({ share_count: count })
    .eq('id', id);
}

export async function uploadMaterialFile(file: File, path: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('commercial_materials')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('commercial_materials')
    .getPublicUrl(filePath);

  return {
    url: publicUrl,
    size: file.size,
    type: file.type
  };
}
