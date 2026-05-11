import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Receipt } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewSaleDialog } from './NewSaleDialog';
import { formatEuro } from '@/lib/quoteCalculator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { EmptyHint } from '@/components/ui/loading-skeletons';

interface Props {
  clientId: string;
  clientName: string;
}

export function ClientQuotesSection({ clientId, clientName }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const quotes = useQuery({
    queryKey: ['client-quotes', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_quotes')
        .select('id, total, status, pricing_mode, valid_until, created_at, product_id')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleAccepted = async ({ id, total, productId }: { id: string; total: number; productId: string }) => {
    // Create a new project for this quote
    const { data: prod } = await supabase.from('products').select('name, sales_type, default_project_mode, task_mode, task_modes, cycle_duration, session_count, session_duration_minutes, estimated_project_hours, product_type').eq('id', productId).maybeSingle();
    let deadline: string | null = null;
    if (prod?.cycle_duration) {
      const end = new Date();
      end.setMonth(end.getMonth() + prod.cycle_duration);
      deadline = format(end, 'yyyy-MM-dd');
    }
    const isRecurring = (prod as any)?.default_project_mode === 'recorrente' || prod?.sales_type === 'avenca_mensal' || prod?.sales_type === 'subscricao';
    const { data: newProject, error } = await supabase.from('projects').insert({
      name: `${prod?.name || 'Projeto'} — ${clientName}`,
      type: isRecurring ? 'cliente_servico_mensal' : 'cliente_projeto_unico',
      status: 'em_onboarding',
      department: 'clientes',
      departments: ['clientes', 'operacao'],
      client_name: clientName,
      client_id: clientId,
      product_id: productId,
      product_name: prod?.name || null,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      deadline: isRecurring ? null : deadline,
      project_mode: isRecurring ? 'recorrente' : 'pontual',
      task_mode: (prod as any)?.task_mode || 'fases',
      task_modes: (prod as any)?.task_modes || [(prod as any)?.task_mode || 'fases'],
      session_count: (prod as any)?.session_count ?? null,
      session_duration_minutes: (prod as any)?.session_duration_minutes ?? null,
      budget: total,
      source_quote_id: id,
    } as any).select('id').single();
    if (error) { toast.error('Erro a criar projeto'); return; }
    toast.success('Venda registada e projeto criado');
    qc.invalidateQueries({ queryKey: ['client-quotes', clientId] });
    qc.invalidateQueries({ queryKey: ['projects', 'client'] });
    if (newProject?.id) navigate(`/hub/projetos/${newProject.id}`);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4" /> Orçamentos
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <ShoppingCart className="h-3.5 w-3.5" /> Novo orçamento
        </Button>
      </div>
      <div>
        {(quotes.data || []).length === 0 ? (
          <EmptyHint>Sem orçamentos. Cria um para gerar um novo projeto (as vendas/pagamentos aparecem na secção Pagamentos).</EmptyHint>
        ) : (
          <div className="divide-y">
            {(quotes.data || []).map((q: any) => (
              <div key={q.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="tabular-nums font-medium">{formatEuro(Number(q.total))}</span>
                  <Badge variant="outline" className="capitalize">{q.pricing_mode}</Badge>
                  <Badge variant="outline" className="capitalize">{q.status}</Badge>
                  {q.valid_until && <span className="text-xs text-muted-foreground">válido até {q.valid_until}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{q.created_at ? format(new Date(q.created_at), 'dd/MM/yyyy') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewSaleDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        onAccepted={handleAccepted}
      />
    </div>
  );
}