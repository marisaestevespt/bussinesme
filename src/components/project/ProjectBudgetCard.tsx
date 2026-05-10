import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, FileText, RefreshCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatEuro } from '@/lib/quoteCalculator';
import { QuoteCalculatorDialog } from '@/components/product/QuoteCalculatorDialog';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  productId?: string | null;
  clientId?: string | null;
  isOwner?: boolean;
}

export function ProjectBudgetCard({ projectId, productId, clientId, isOwner = true }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const projectQ = useQuery({
    queryKey: ['project-budget', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('budget, source_quote_id').eq('id', projectId).maybeSingle();
      if (error) throw error;
      return data as { budget: number | null; source_quote_id: string | null } | null;
    },
  });

  const quoteQ = useQuery({
    queryKey: ['project-source-quote', projectQ.data?.source_quote_id],
    enabled: !!projectQ.data?.source_quote_id,
    queryFn: async () => {
      const { data } = await supabase.from('product_quotes').select('id, total, status, pricing_mode, complexity_key, discount_pct, valid_until, created_at').eq('id', projectQ.data!.source_quote_id!).maybeSingle();
      return data;
    },
  });

  const budget = projectQ.data?.budget;
  const quote = quoteQ.data;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Valor Contratado
        </CardTitle>
        {isOwner && productId && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
            <Calculator className="h-3.5 w-3.5" />
            {quote ? 'Refazer orçamento' : 'Criar orçamento'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {budget ? (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-2xl font-semibold tabular-nums">{formatEuro(budget)}</span>
            {quote && (
              <>
                <Badge variant="outline" className="capitalize">{quote.pricing_mode}</Badge>
                {quote.complexity_key && <Badge variant="outline">Complexidade: {quote.complexity_key}</Badge>}
                {Number(quote.discount_pct) > 0 && <Badge variant="outline">−{quote.discount_pct}% desconto</Badge>}
                {quote.valid_until && <span className="text-xs text-muted-foreground">válido até {quote.valid_until}</span>}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sem orçamento associado a este projeto. {productId ? 'Clica em "Criar orçamento" para gerar um.' : 'Define o produto do projeto primeiro.'}</p>
        )}
        {!productId && budget != null && (
          <p className="text-[11px] text-muted-foreground italic mt-1">Sem produto associado: o orçamento não pode ser recalculado.</p>
        )}
      </CardContent>

      {productId && (
        <QuoteCalculatorDialog
          open={open}
          onOpenChange={setOpen}
          productId={productId}
          clientId={clientId || null}
          onAccepted={async ({ id, total }) => {
            const { error } = await supabase.from('projects').update({ budget: total, source_quote_id: id } as any).eq('id', projectId);
            if (error) { toast.error('Erro a aplicar orçamento ao projeto'); return; }
            toast.success('Orçamento aplicado ao projeto');
            qc.invalidateQueries({ queryKey: ['project-budget', projectId] });
            qc.invalidateQueries({ queryKey: ['project-source-quote'] });
          }}
        />
      )}
    </Card>
  );
}