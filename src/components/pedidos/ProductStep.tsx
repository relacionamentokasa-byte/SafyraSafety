import { useFormContext, useFieldArray } from "react-hook-form";
import type { OrderFormValues } from "@/lib/orders.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Search, Package, Tag, Info, Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLibusManufacturer, loadPublishedPaymentCatalog } from "@/lib/payment-plans";
import { ManufacturerLogo } from "@/components/manufacturers/ManufacturerLogo";
import { formatDisplayName } from "@/lib/format";
import { groupProductsIntoVariants, ProductGroup, ProductVariantItem } from "@/lib/product-variants";
import { ProductColorSelector } from "@/components/produtos/ProductColorSelector";

interface ProductPreview {
  id: string;
  name: string;
  code: string | null;
  sku: string | null;
  unit: string | null;
  brand: string | null;
  price: number;
  min_price: number | null;
  category_id?: string | null;
  manufacturer_id: string | null;
  main_image_url?: string | null;
  manufacturer: {
    id: string;
    name: string;
    trade_name: string | null;
    logo_path: string | null;
  } | null;
}

interface PriceOption {
  id: string;
  price_table_id: string;
  product_id: string;
  unit_price: number;
  min_price: number | null;
  max_discount_percent: number | null;
  price_table: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    valid_from: string | null;
    valid_until: string | null;
  } | null;
}

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

function isCurrentPriceTable(option: PriceOption): boolean {
  const now = Date.now();
  const validFrom = option.price_table?.valid_from
    ? Date.parse(option.price_table.valid_from)
    : Number.NEGATIVE_INFINITY;
  const validUntil = option.price_table?.valid_until
    ? Date.parse(option.price_table.valid_until)
    : Number.POSITIVE_INFINITY;
  return option.price_table?.status === "active" && validFrom <= now && validUntil >= now;
}

export function ProductStep() {
  const { control, register, watch, setValue } = useFormContext<OrderFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVariantsMap, setSelectedVariantsMap] = useState<Record<string, string>>({});
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Carregar lista de categorias e fabricantes para os filtros do modal
  const { data: categories } = useQuery({
    queryKey: ["product-categories-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: manufacturers } = useQuery({
    queryKey: ["manufacturers-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manufacturers")
        .select("id, name, logo_path")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const items = watch("items") || [];
  const productIds = items.map((item) => item.product_id).filter(Boolean);
  const paymentMethodId = watch("payment_method_id");
  const paymentPlanId = watch("payment_plan_id");

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", search, manufacturerFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, code, sku, unit, brand, price, min_price, category_id, manufacturer_id, main_image_url, manufacturer:manufacturers(id, name, trade_name, logo_path)")
        .eq("status", "active")
        .order("name");

      if (manufacturerFilter !== "all") {
        query = query.eq("manufacturer_id", manufacturerFilter);
      }

      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      if (search.trim()) {
        const term = search.trim();
        query = query.or(
          `name.ilike.%${term}%,code.ilike.%${term}%,sku.ilike.%${term}%,trade_name.ilike.%${term}%,brand.ilike.%${term}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductPreview[];
    },
  });

  const productGroups = useMemo(() => {
    return groupProductsIntoVariants(products || []);
  }, [products]);

  const { data: paymentCatalog } = useQuery({
    queryKey: ["payment-catalog"],
    queryFn: loadPublishedPaymentCatalog,
  });

  const { data: priceOptions = [], isLoading: isLoadingPriceOptions } = useQuery({
    queryKey: ["order-price-options", [...new Set(productIds)].sort()],
    queryFn: async () => {
      if (productIds.length === 0) return [] as PriceOption[];
      const { data, error } = await supabase
        .from("price_table_items")
        .select(
          "id, price_table_id, product_id, unit_price, min_price, max_discount_percent, price_table:price_tables(id, name, code, status, valid_from, valid_until)",
        )
        .in("product_id", [...new Set(productIds)]);
      if (error) throw error;
      return ((data || []) as unknown as PriceOption[]).filter(
        (option) => isCurrentPriceTable(option) && Number(option.unit_price) > 0,
      );
    },
    enabled: productIds.length > 0,
  });

  const { data: selectedProducts } = useQuery({
    queryKey: ["selected-order-products", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];

      const { data, error } = await supabase
        .from("products")
        .select("id, name, code, sku, unit, brand, price, min_price, manufacturer_id, manufacturer:manufacturers(id, name, trade_name, logo_path)")
        .in("id", productIds);

      if (error) throw error;
      return (data || []) as ProductPreview[];
    },
    enabled: productIds.length > 0,
  });

  const productMap = new Map<string, ProductPreview>();
  [...(products || []), ...(selectedProducts || [])].forEach((product) => {
    productMap.set(product.id, product);
  });

  const hasLibusProduct = [...productMap.values()].some(
    (product) =>
      productIds.includes(product.id) &&
      (isLibusManufacturer(product.manufacturer?.name) ||
        isLibusManufacturer(product.manufacturer?.trade_name) ||
        isLibusManufacturer(product.brand)),
  );
  const suggestedPlan = paymentCatalog?.plans.find((plan) => plan.code === "30/45/60");

  useEffect(() => {
    if (hasLibusProduct && !paymentMethodId && !paymentPlanId && suggestedPlan) {
      setValue("payment_plan_id", suggestedPlan.id, { shouldDirty: true });
      if (suggestedPlan.payment_method_id) {
        setValue("payment_method_id", suggestedPlan.payment_method_id, { shouldDirty: true });
      }
    }
  }, [hasLibusProduct, paymentMethodId, paymentPlanId, setValue, suggestedPlan]);

  const getPriceOption = (priceTableItemId: string | null | undefined) =>
    priceOptions.find((option) => option.id === priceTableItemId);

  const previewSubtotal = items.reduce((total, item) => {
    const option = getPriceOption(item.price_table_item_id);
    return total + Number(item.quantity || 0) * Number(option?.unit_price || 0);
  }, 0);
  const previewDiscount = items.reduce((total, item) => {
    const option = getPriceOption(item.price_table_item_id);
    return (
      total +
      Number(item.quantity || 0) *
        Number(option?.unit_price || 0) *
        (Number(item.requested_discount_percent || 0) / 100)
    );
  }, 0);
  const previewTotal = Math.max(previewSubtotal - previewDiscount, 0);

  const handleAddProduct = (product: ProductPreview) => {
    append({
      product_id: product.id,
      manufacturer_id: product.manufacturer_id,
      price_table_item_id: null,
      quantity: 1,
      requested_discount_percent: 0,
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium">Produtos do Pedido</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Tag className="h-3.5 w-3.5 text-primary" />
            Escolha explicitamente uma tabela de preço para cada produto.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" type="button" data-order-add-product>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Buscar Produtos no Catálogo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 flex-1 flex flex-col overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, código ou SKU..."
                    className="pl-9 text-xs h-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
                    <SelectTrigger className="w-full sm:w-[170px] text-xs h-9">
                      <SelectValue placeholder="Fabricante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Fabricantes</SelectItem>
                      {manufacturers?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-1.5 truncate">
                            <ManufacturerLogo name={m.name} logoPath={m.logo_path} size="sm" />
                            {m.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] text-xs h-9">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Categorias</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(manufacturerFilter !== "all" || categoryFilter !== "all" || search.trim() !== "") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Limpar filtros"
                      onClick={() => {
                        setSearch("");
                        setManufacturerFilter("all");
                        setCategoryFilter("all");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-2.5 overflow-y-auto flex-1 pr-1">
                {isLoadingProducts ? (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    Carregando produtos...
                  </p>
                ) : (
                  productGroups?.map((group) => {
                    const selectedId = selectedVariantsMap[group.groupId] || group.defaultProduct.id;
                    const activeVariant = group.variants.find((v) => v.product.id === selectedId) || group.variants[0];
                    const currentProduct = activeVariant?.product || group.defaultProduct;

                    return (
                      <div
                        key={group.groupId}
                        className="flex flex-col p-3 border rounded-lg hover:border-primary/40 bg-card transition-colors space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded border bg-background shrink-0 flex items-center justify-center p-1 overflow-hidden">
                              {currentProduct.main_image_url ? (
                                <img
                                  src={currentProduct.main_image_url}
                                  alt={currentProduct.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <ManufacturerLogo
                                  name={currentProduct.manufacturer?.name}
                                  logoPath={currentProduct.manufacturer?.logo_path}
                                  size="sm"
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{formatDisplayName(group.baseName)}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>SKU: {currentProduct.sku || currentProduct.code || "N/A"}</span>
                                {currentProduct.brand && <span>• {currentProduct.brand}</span>}
                                <span className="uppercase">• {currentProduct.unit || "UN"}</span>
                                {group.hasMultipleVariants && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                    {group.variants.length} cores
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-sm text-foreground">
                              R$ {formatMoney(Number(currentProduct.price || 0))}
                            </span>
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => handleAddProduct(currentProduct)}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adicionar
                            </Button>
                          </div>
                        </div>

                        {/* Seletor de Cores / Variantes */}
                        {group.hasMultipleVariants && (
                          <div className="pt-2 border-t border-muted/60 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Cor selecionada:</span>
                            <ProductColorSelector
                              variants={group.variants}
                              selectedProductId={currentProduct.id}
                              onSelectVariant={(variant) => {
                                setSelectedVariantsMap((prev) => ({
                                  ...prev,
                                  [group.groupId]: variant.product.id,
                                }));
                              }}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {!isLoadingProducts && productGroups?.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Nenhum produto adicionado ao pedido.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Produto</th>
                  <th className="text-center p-3 font-medium w-24">Qtd</th>
                  <th className="text-left p-3 font-medium min-w-64">Tabela e preço</th>
                  <th className="text-right p-3 font-medium w-28">Desconto %</th>
                  <th className="text-right p-3 font-medium w-32">Prévia</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((field, index) => {
                  const item = items[index];
                  const product = productMap.get(item?.product_id);
                  const selectedOption = getPriceOption(item?.price_table_item_id);
                  const selectedPrice = Number(selectedOption?.unit_price || 0);
                  const minPrice = Number(selectedOption?.min_price || 0);
                  const requestedDiscount = Number(item?.requested_discount_percent || 0);
                  const previewUnitPrice = Math.max(
                    selectedPrice * (1 - requestedDiscount / 100),
                    0,
                  );
                  const isBelowMin = minPrice > 0 && previewUnitPrice < minPrice;
                  const priceOptionsForProduct = priceOptions.filter(
                    (option) => option.product_id === item?.product_id,
                  );

                  return (
                    <tr key={field.id} className={isBelowMin ? "bg-destructive/5" : ""}>
                      <td className="p-3">
                        <p className="font-medium">{formatDisplayName(product?.name || "Produto selecionado")}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{product?.sku || product?.code || "-"}</span>
                          {product?.brand && <span>• {product.brand}</span>}
                          <span className="uppercase">• {product?.unit || "UN"}</span>
                        </div>
                        {isBelowMin && (
                          <span className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                            <Info className="h-3 w-3" />
                            A prévia está abaixo do mínimo cadastrado; o banco poderá rejeitar o desconto.
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0.0001"
                          step="any"
                          className="h-8 text-center"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </td>
                      <td className="p-3">
                        <Select
                          value={item?.price_table_item_id || undefined}
                          onValueChange={(value) =>
                            setValue(`items.${index}.price_table_item_id`, value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          <SelectTrigger
                            className="h-9"
                            data-order-price-selection={index}
                            aria-label={`Tabela de preço para ${product?.name || "produto"}`}
                          >
                            <SelectValue placeholder="Selecione uma tabela" />
                          </SelectTrigger>
                          <SelectContent>
                            {priceOptionsForProduct.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.price_table?.name || "Tabela sem nome"} — R$ {formatMoney(Number(option.unit_price))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isLoadingPriceOptions ? (
                          <p className="text-[10px] text-muted-foreground mt-1">Carregando preços...</p>
                        ) : priceOptionsForProduct.length === 0 ? (
                          <p className="text-[10px] text-destructive mt-1">Nenhuma tabela ativa para este produto.</p>
                        ) : selectedOption ? (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Preço unitário: R$ {formatMoney(selectedPrice)}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="h-8 text-right"
                          {...register(`items.${index}.requested_discount_percent`, {
                            valueAsNumber: true,
                          })}
                        />
                      </td>
                      <td className="p-3 text-right font-medium">
                        R$ {formatMoney(previewUnitPrice * Number(item?.quantity || 0))}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove(index)}
                          aria-label={`Remover ${product?.name || "produto"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prévia sem regras comerciais</span>
            <span>R$ {formatMoney(previewSubtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Desconto solicitado (prévia)</span>
            <span>- R$ {formatMoney(previewDiscount)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold border-t pt-2">
            <span>Total estimado</span>
            <span>R$ {formatMoney(previewTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            Estes valores são apenas uma referência visual. O pedido será recalculado no banco,
            que validará a tabela escolhida e aplicará as regras por faixa e os limites de desconto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
