import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Coins, SlidersHorizontal } from 'lucide-react';
import { OfferCalculator } from '@/components/product/OfferCalculator';
import { ProductPricingEditor } from '@/components/product/ProductPricingEditor';
import type { VolumeDiscount } from '@/lib/quoteCalculator';

interface Props {
  productId: string;
  ticketType: 'fixo' | 'variavel';
  isOwner: boolean;
  vatRate: string;
  initial: {
    base_price?: number | null;
    price_min?: number | null;
    price_max?: number | null;
    volume_discounts?: VolumeDiscount[] | null;
  };
}

type SheetKey = 'oferta' | 'variaveis';

const SHEETS: Array<{ key: SheetKey; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = [
  { key: 'oferta', label: 'Custos & Margens', icon: Coins, hint: 'Calculadora de Oferta — custos internos e mín/sugerido/máx' },
  { key: 'variaveis', label: 'Variáveis do orçamento', icon: SlidersHorizontal, hint: 'Drivers, perguntas e descontos usados na Calculadora de Orçamento' },
];

export function PricingWorkspace({ productId, ticketType, isOwner, vatRate, initial }: Props) {
  const [active, setActive] = useState<SheetKey>('oferta');

  return (
    <Card className="overflow-hidden">
      {/* Sheet content */}
      <div className="p-4 bg-background min-h-[400px]">
        {active === 'oferta' && (
          <OfferCalculator productId={productId} vatRate={vatRate} isOwner={isOwner} />
        )}
        {active === 'variaveis' && (
          <ProductPricingEditor
            productId={productId}
            ticketType={ticketType}
            isOwner={isOwner}
            initial={initial}
          />
        )}
      </div>

      {/* Excel-style sheet tabs at bottom */}
      <div className="flex items-stretch border-t bg-muted/40 px-2 pt-1.5 gap-0.5 overflow-x-auto">
        {SHEETS.map(s => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              title={s.hint}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-t border-l border-r rounded-t-md whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-background text-foreground border-border -mb-px'
                  : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}