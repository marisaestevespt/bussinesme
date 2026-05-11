import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Coins, SlidersHorizontal } from 'lucide-react';
import { OfferCalculator } from '@/components/product/OfferCalculator';
import { ProductPricingEditor } from '@/components/product/ProductPricingEditor';
import { VariablesWizard } from '@/components/product/VariablesWizard';
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
  { key: 'variaveis', label: 'Variáveis do orçamento', icon: SlidersHorizontal, hint: 'Drivers, perguntas e descontos usados na Calculadora de Orçamento' },
  { key: 'oferta', label: 'Custos & Margens', icon: Coins, hint: 'Calculadora de Oferta — custos internos e mín/sugerido/máx' },
];

export function PricingWorkspace({ productId, ticketType, isOwner, vatRate, initial }: Props) {
  const [active, setActive] = useState<SheetKey>('variaveis');

  return (
    <Card className="overflow-hidden">
      {/* Tabs at top — large, primary-styled for visibility */}
      <div className="flex items-stretch border-b bg-muted/30 px-2 pt-2 gap-1 overflow-x-auto">
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
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md whitespace-nowrap transition-colors border-b-2',
                isActive
                  ? 'bg-background text-foreground border-primary -mb-px'
                  : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sheet content — sunken neutral surface so both editors share the same canvas */}
      <div className="p-4 bg-muted/20 min-h-[400px]">
        {active === 'oferta' && (
          <OfferCalculator productId={productId} vatRate={vatRate} isOwner={isOwner} />
        )}
        {active === 'variaveis' && (
          ticketType === 'variavel' ? (
            <VariablesWizard productId={productId} isOwner={isOwner} initial={initial} />
          ) : (
            <ProductPricingEditor
              productId={productId}
              ticketType={ticketType}
              isOwner={isOwner}
              initial={initial}
            />
          )
        )}
      </div>
    </Card>
  );
}