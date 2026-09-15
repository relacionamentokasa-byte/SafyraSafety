import React from "react";
import { ProductVariantItem } from "@/lib/product-variants";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductColorSelectorProps {
  variants: ProductVariantItem[];
  selectedProductId: string;
  onSelectVariant: (variant: ProductVariantItem) => void;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export const ProductColorSelector: React.FC<ProductColorSelectorProps> = ({
  variants,
  selectedProductId,
  onSelectVariant,
  size = "sm",
}) => {
  if (!variants || variants.length <= 1) return null;

  const currentVariant =
    variants.find((v) => v.product.id === selectedProductId) || variants[0];

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 py-0 text-xs font-normal border-dashed rounded-full gap-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
              size === "md" && "h-7 px-2.5 text-xs"
            )}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: currentVariant.colorDef.hex,
                border: currentVariant.colorDef.borderHex
                  ? `1px solid ${currentVariant.colorDef.borderHex}`
                  : "1px solid rgba(0,0,0,0.2)",
              }}
            />
            <span className="font-medium text-foreground">{currentVariant.colorName}</span>
            <span className="text-[10px] text-muted-foreground">
              ({variants.length} cores)
            </span>
            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-56 p-1.5 shadow-lg border border-border"
        >
          <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 mb-1 border-b border-border/50">
            Selecione a cor ({variants.length} opções)
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
            {variants.map((v) => {
              const isSelected = v.product.id === selectedProductId;
              return (
                <button
                  key={v.product.id}
                  type="button"
                  onClick={() => onSelectVariant(v)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: v.colorDef.hex,
                        border: v.colorDef.borderHex
                          ? `1px solid ${v.colorDef.borderHex}`
                          : "1px solid rgba(0,0,0,0.2)",
                      }}
                    />
                    <span className="truncate">{v.colorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {v.product.code || v.product.sku}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
