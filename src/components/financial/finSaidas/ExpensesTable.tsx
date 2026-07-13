import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TableSkeleton, EmptyState } from '@/components/ui/loading-skeletons';
import { Copy, Plus, Receipt, RefreshCw } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { VatDeductibleCell } from '../VatDeductibleCell';
import type { Expense } from '@/hooks/useFinancialData';
import type { ExpenseFormState } from '../types';
import { EXP_STATUS, LOCATIONS, PERIODICITIES, type SaidasFilter } from './constants';

interface Props {
  expenses: Expense[];
  loading: boolean;
  filter: SaidasFilter;
  ivaExempt: boolean;
  getCategoryLabel: (type: 'expense', cat: string) => string;
  onOpenNew: () => void;
  onEdit: (form: ExpenseFormState) => void;
}

export function ExpensesTable({ expenses, loading, filter, ivaExempt, getCategoryLabel, onOpenNew, onEdit }: Props) {
  if (loading) return <TableSkeleton columns={10} rows={6} />;

  return (
    <Card id="fin-saidas-export">
      <CardContent className="p-0">
        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Sem despesas"
            description={filter === 'recurring' ? 'Não existem despesas recorrentes registadas.' : 'Ainda não foram registadas despesas para este período.'}
            action={<Button size="sm" onClick={onOpenNew}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor Base</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead className="text-right">Total c/ IVA</TableHead>
                {!ivaExempt && <TableHead className="text-right">IVA a Deduzir</TableHead>}
                <TableHead>Localização</TableHead>
                {filter === 'recurring' ? <TableHead>Periodicidade</TableHead> : <TableHead>Mês</TableHead>}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map(e => (
                <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onEdit({
                  ...(e as unknown as ExpenseFormState),
                  expense_date: e.expense_date ? new Date(e.expense_date + 'T00:00:00') : undefined,
                  base_value: e.base_value.toString(),
                  includes_vat: false,
                  periodicity: e.periodicity || 'mensal',
                })}>
                  <TableCell>
                    <Badge variant="outline" className={EXP_STATUS.find(s => s.value === e.status)?.cls || 'bg-muted text-muted-foreground'}>
                      {EXP_STATUS.find(s => s.value === e.status)?.label || e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{e.expense_id}</TableCell>
                  <TableCell>{e.expense_date || '—'}</TableCell>
                  <TableCell className="truncate max-w-[200px]">
                    {e.description || '—'}
                    {e.is_recurring && <RefreshCw className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                  </TableCell>
                  <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                  <TableCell className="text-right">{formatEuro(e.base_value)}</TableCell>
                  <TableCell>{e.vat_rate}%</TableCell>
                  <TableCell className="text-right font-medium">{formatEuro(e.total_with_vat)}</TableCell>
                  {!ivaExempt && (
                    <TableCell className="text-right" onClick={ev => ev.stopPropagation()}>
                      <VatDeductibleCell expense={e} />
                    </TableCell>
                  )}
                  <TableCell>{LOCATIONS.find(l => l.value === e.location)?.label || e.location}</TableCell>
                  {filter === 'recurring'
                    ? <TableCell>{PERIODICITIES.find(p => p.value === e.periodicity)?.label || '—'}</TableCell>
                    : <TableCell>{e.expense_month || '—'}</TableCell>
                  }
                  <TableCell onClick={ev => ev.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" aria-label="Copiar" size="icon" className="h-7 w-7" onClick={() => {
                          const { id: _id, expense_id: _eid, created_at: _ca, updated_at: _ua, ...rest } = e;
                          onEdit({
                            ...(rest as unknown as ExpenseFormState),
                            expense_date: e.expense_date ? new Date(e.expense_date + 'T00:00:00') : undefined,
                            base_value: e.base_value.toString(),
                            includes_vat: false,
                            status: 'pendente',
                            periodicity: e.periodicity || 'mensal',
                          });
                        }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicar</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
