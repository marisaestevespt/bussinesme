import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  year: number;
  month: number;
}

type Severity = 'high' | 'medium' | 'low';
interface Alert {
  key: string;
  severity: Severity;
  label: string;
  detail: string;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-muted text-muted-foreground',
};

/**
 * FinAlertasMes — alertas financeiros acionáveis filtrados pelo mês selecionado.
 * Cobre apenas o que não está visível em mais lado nenhum:
 *  - Pagamentos em atraso (despesa por pagar com data passada do mês)
 *  - Fornecedor inexistente (referência partida)
 *  - Fornecedor inativo a ser usado
 *  - Despesa após fim de contrato
 *  - Instância recorrente divergente do pai (supplier)
 */
export function FinAlertasMes({ year, month }: Props) {
  const { data } = useQuery({
    queryKey: ['fin-alertas-mes', year, month],
    queryFn: async () => {
      const [exRes, supRes] = await Promise.all([
        supabase
          .from('financial_expenses')
          .select('id,expense_id,expense_name,description,status,expense_date,supplier_id,parent_expense_id,source_type')
          .eq('expense_year', year)
          .eq('expense_month', month),
        supabase.from('suppliers').select('id,name,is_active,contract_end_date'),
      ]);
      const expenses = exRes.data || [];
      const suppliers = supRes.data || [];

      // For drift detection we need parent rows (may be in another month)
      const parentIds = [...new Set(expenses.map(e => e.parent_expense_id).filter(Boolean) as string[])];
      let parents: Array<{ id: string; supplier_id: string | null }> = [];
      if (parentIds.length > 0) {
        const { data: pData } = await supabase
          .from('financial_expenses')
          .select('id,supplier_id')
          .in('id', parentIds);
        parents = pData || [];
      }
      return { expenses, suppliers, parents };
    },
  });

  const alerts = useMemo<Alert[]>(() => {
    if (!data) return [];
    const supById = new Map(data.suppliers.map(s => [s.id, s]));
    const parentById = new Map(data.parents.map(p => [p.id, p]));
    const today = new Date().toISOString().slice(0, 10);
    const out: Alert[] = [];

    for (const e of data.expenses) {
      const isMember = !!e.source_type && ['contract', 'contractor', 'salary', 'member_payment'].includes(e.source_type);
      const status = (e.status || '').toLowerCase();
      const isUnpaid = !['pago', 'cancelado', 'tudo_ok', 'pago_falta_fatura'].includes(status);
      const label = e.expense_name || e.description || e.expense_id || 'Despesa';

      if (isUnpaid && e.expense_date && e.expense_date < today) {
        out.push({
          key: `overdue-${e.id}`,
          severity: 'high',
          label: 'Pagamento em atraso',
          detail: `${label} — data ${e.expense_date}, estado ${e.status || '—'}.`,
        });
      }

      if (isMember) continue;

      if (e.supplier_id) {
        const sup = supById.get(e.supplier_id);
        if (!sup) {
          out.push({
            key: `orphan-${e.id}`,
            severity: 'high',
            label: 'Fornecedor inexistente',
            detail: `${label} referencia um fornecedor que já não existe.`,
          });
        } else {
          if (sup.is_active === false && status !== 'pago') {
            out.push({
              key: `inactive-${e.id}`,
              severity: 'medium',
              label: 'Fornecedor inativo em uso',
              detail: `${label} — fornecedor "${sup.name}" está inativo.`,
            });
          }
          if (sup.contract_end_date && e.expense_date && e.expense_date > sup.contract_end_date) {
            out.push({
              key: `expired-${e.id}`,
              severity: 'medium',
              label: 'Contrato expirado',
              detail: `${label} — ${e.expense_date} é posterior ao fim de contrato (${sup.contract_end_date}).`,
            });
          }
        }
      }

      if (e.parent_expense_id) {
        const parent = parentById.get(e.parent_expense_id);
        if (parent && parent.supplier_id && parent.supplier_id !== e.supplier_id) {
          out.push({
            key: `drift-${e.id}`,
            severity: 'low',
            label: 'Recorrente divergente',
            detail: `${label} — fornecedor desta instância difere do recorrente original.`,
          });
        }
      }
    }

    const order: Severity[] = ['high', 'medium', 'low'];
    return out.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  }, [data]);

  if (!data) return null;

  if (alerts.length === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-4 pb-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">Sem alertas financeiros para este mês.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Alertas financeiros do mês
          <Badge variant="secondary" className="ml-1">{alerts.length}</Badge>
        </div>
        <ul className="space-y-1.5 text-sm">
          {alerts.map(a => (
            <li key={a.key} className="flex items-start gap-2">
              <Badge variant="secondary" className={`${SEVERITY_STYLE[a.severity]} shrink-0 mt-0.5`}>
                {a.label}
              </Badge>
              <span className="text-muted-foreground">{a.detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}