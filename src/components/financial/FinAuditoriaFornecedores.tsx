import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ExpenseRow {
  id: string;
  expense_id: string | null;
  supplier_id: string | null;
  description: string | null;
  expense_name: string | null;
  category: string | null;
  status: string | null;
  base_value: number | null;
  total_with_vat: number | null;
  vat_rate: number | null;
  expense_date: string | null;
  expense_month: number | null;
  expense_year: number | null;
  is_recurring: boolean | null;
  parent_expense_id: string | null;
  source_type: string | null;
}

interface SupplierRow {
  id: string;
  name: string;
  is_active: boolean | null;
  default_vat_rate: number | null;
  contract_end_date: string | null;
  category: string | null;
}

type DiffType =
  | 'orphan_supplier'         // expense.supplier_id points to deleted supplier
  | 'unlinked_match'          // expense without supplier_id but description matches a supplier name
  | 'unused_supplier'         // active supplier with zero expenses
  | 'recurring_drift'         // child instance value/vat differs from parent
  | 'expired_contract'        // expense after contract_end_date
  | 'inactive_supplier_used'; // expense linked to is_active=false supplier

interface Diff {
  key: string;
  type: DiffType;
  expense?: ExpenseRow;
  supplier?: SupplierRow;
  parent?: ExpenseRow;
  details: string;
  fixable: boolean;
  suggested_supplier_id?: string;
}

const TYPE_LABELS: Record<DiffType, string> = {
  orphan_supplier: 'Fornecedor inexistente',
  unlinked_match: 'Despesa sem fornecedor (match)',
  unused_supplier: 'Fornecedor sem despesas',
  recurring_drift: 'Instância divergente do recorrente',
  expired_contract: 'Contrato expirado',
  inactive_supplier_used: 'Fornecedor inativo em uso',
};

const TYPE_COLORS: Record<DiffType, string> = {
  orphan_supplier: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
  unlinked_match: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  unused_supplier: 'bg-muted text-muted-foreground',
  recurring_drift: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  expired_contract: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  inactive_supplier_used: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
};

function normalizeName(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

export function FinAuditoriaFornecedores() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [reconcilingAll, setReconcilingAll] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  const supplierById = useMemo(() => {
    const m = new Map<string, SupplierRow>();
    suppliers.forEach(s => m.set(s.id, s));
    return m;
  }, [suppliers]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: ex, error: exErr }, { data: sp, error: spErr }] = await Promise.all([
        supabase
          .from('financial_expenses')
          .select('id,expense_id,supplier_id,description,expense_name,category,status,base_value,total_with_vat,vat_rate,expense_date,expense_month,expense_year,is_recurring,parent_expense_id,source_type'),
        supabase
          .from('suppliers')
          .select('id,name,is_active,default_vat_rate,contract_end_date,category'),
      ]);
      if (exErr) throw exErr;
      if (spErr) throw spErr;
      setExpenses((ex as unknown as ExpenseRow[]) || []);
      setSuppliers((sp as unknown as SupplierRow[]) || []);
    } catch (e: any) {
      toast.error('Erro a carregar dados de fornecedores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const diffs = useMemo<Diff[]>(() => {
    const result: Diff[] = [];
    const supplierByNormName = new Map<string, SupplierRow>();
    suppliers.forEach(s => {
      supplierByNormName.set(normalizeName(s.name), s);
    });

    const usedSupplierIds = new Set<string>();
    const expensesByParent = new Map<string, ExpenseRow[]>();
    const expenseById = new Map<string, ExpenseRow>();
    expenses.forEach(e => {
      expenseById.set(e.id, e);
      if (e.parent_expense_id) {
        const arr = expensesByParent.get(e.parent_expense_id) || [];
        arr.push(e);
        expensesByParent.set(e.parent_expense_id, arr);
      }
    });

    expenses.forEach(e => {
      const isMemberExpense = !!e.source_type && ['contract', 'contractor', 'salary', 'member_payment'].includes(e.source_type);

      // Always mark supplier as used (even for member-related expenses) so that
      // suppliers tied to team members/contractors don't show as "unused".
      if (e.supplier_id) {
        usedSupplierIds.add(e.supplier_id);
      }

      // The remaining checks belong to the member auditor — skip them here.
      if (isMemberExpense) {
        return;
      }

      // 1. Orphan supplier reference
      if (e.supplier_id) {
        const sup = supplierById.get(e.supplier_id);
        if (!sup) {
          result.push({
            key: `orphan-${e.id}`,
            type: 'orphan_supplier',
            expense: e,
            details: `Despesa "${e.expense_name || e.description || e.expense_id}" referencia fornecedor inexistente.`,
            fixable: true,
          });
          return;
        }
        // 6. Inactive supplier used
        if (sup.is_active === false && (e.status || '').toLowerCase() !== 'pago') {
          result.push({
            key: `inactive-${e.id}`,
            type: 'inactive_supplier_used',
            expense: e,
            supplier: sup,
            details: `Fornecedor "${sup.name}" está inativo mas tem despesa pendente.`,
            fixable: false,
          });
        }
        // 5. Expired contract
        if (sup.contract_end_date && e.expense_date && e.expense_date > sup.contract_end_date) {
          result.push({
            key: `expired-${e.id}`,
            type: 'expired_contract',
            expense: e,
            supplier: sup,
            details: `Despesa de ${e.expense_date} é posterior ao fim de contrato (${sup.contract_end_date}).`,
            fixable: false,
          });
        }
      } else {
        // 2. Unlinked match — try to match by description/name
        const candidateText = normalizeName(e.expense_name || e.description || '');
        if (candidateText.length >= 4) {
          let matched: SupplierRow | undefined;
          for (const [norm, sup] of supplierByNormName.entries()) {
            if (norm.length >= 4 && (candidateText.includes(norm) || norm.includes(candidateText))) {
              matched = sup;
              break;
            }
          }
          if (matched) {
            result.push({
              key: `match-${e.id}`,
              type: 'unlinked_match',
              expense: e,
              supplier: matched,
              details: `Despesa "${e.expense_name || e.description}" parece ser do fornecedor "${matched.name}".`,
              fixable: true,
              suggested_supplier_id: matched.id,
            });
          }
        }
      }

      // 4. Recurring drift — if this expense has a parent, compare key fields
      if (e.parent_expense_id) {
        const parent = expenseById.get(e.parent_expense_id);
        if (parent) {
          if (parent.supplier_id && parent.supplier_id !== e.supplier_id) {
            result.push({
              key: `drift-sup-${e.id}`,
              type: 'recurring_drift',
              expense: e,
              parent,
              details: `Fornecedor da instância difere do recorrente original.`,
              fixable: true,
              suggested_supplier_id: parent.supplier_id,
            });
          }
        }
      }
    });

    // 3. Unused active suppliers
    suppliers.forEach(s => {
      if (s.is_active !== false && !usedSupplierIds.has(s.id)) {
        result.push({
          key: `unused-${s.id}`,
          type: 'unused_supplier',
          supplier: s,
          details: `Fornecedor ativo "${s.name}" não tem despesas associadas.`,
          fixable: false,
        });
      }
    });

    return result.sort((a, b) => {
      const order: DiffType[] = ['orphan_supplier', 'recurring_drift', 'unlinked_match', 'inactive_supplier_used', 'expired_contract', 'unused_supplier'];
      return order.indexOf(a.type) - order.indexOf(b.type);
    });
  }, [expenses, suppliers, supplierById]);

  const counts = useMemo(() => {
    const c: Record<DiffType, number> = {
      orphan_supplier: 0,
      unlinked_match: 0,
      unused_supplier: 0,
      recurring_drift: 0,
      expired_contract: 0,
      inactive_supplier_used: 0,
    };
    diffs.forEach(d => { c[d.type] += 1; });
    return c;
  }, [diffs]);

  async function reconcile(diff: Diff) {
    setReconciling(diff.key);
    try {
      if (diff.type === 'orphan_supplier' && diff.expense) {
        const { error } = await supabase
          .from('financial_expenses')
          .update({ supplier_id: null })
          .eq('id', diff.expense.id);
        if (error) throw error;
      } else if (diff.type === 'unlinked_match' && diff.expense && diff.suggested_supplier_id) {
        const { error } = await supabase
          .from('financial_expenses')
          .update({ supplier_id: diff.suggested_supplier_id })
          .eq('id', diff.expense.id);
        if (error) throw error;
      } else if (diff.type === 'recurring_drift' && diff.expense && diff.suggested_supplier_id) {
        const { error } = await supabase
          .from('financial_expenses')
          .update({ supplier_id: diff.suggested_supplier_id })
          .eq('id', diff.expense.id);
        if (error) throw error;
      } else {
        toast.info('Esta diferença não tem reconciliação automática.');
        setReconciling(null);
        return;
      }
      toast.success('Registo reconciliado');
      await load();
    } catch (e: any) {
      toast.error(`Erro a reconciliar: ${e.message || 'desconhecido'}`);
    } finally {
      setReconciling(null);
    }
  }

  async function reconcileAll() {
    const fixable = diffs.filter(d => d.fixable);
    if (fixable.length === 0) return;
    setReconcilingAll(true);
    let ok = 0;
    let fail = 0;
    for (const d of fixable) {
      try {
        await reconcile(d);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setReconcilingAll(false);
    toast.success(`Reconciliação concluída: ${ok} sucesso, ${fail} falhas`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fixableCount = diffs.filter(d => d.fixable).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(TYPE_LABELS) as DiffType[]).map(t => (
          <Card key={t}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground font-normal">{TYPE_LABELS[t]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${counts[t] > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className="text-2xl font-semibold">{counts[t]}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Diferenças encontradas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {diffs.length === 0
                ? 'Despesas e fornecedores estão 100% alinhados.'
                : `${diffs.length} diferença${diffs.length === 1 ? '' : 's'} entre despesas financeiras e fornecedores. ${fixableCount} reconciliáve${fixableCount === 1 ? 'l' : 'is'}.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading || reconcilingAll}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            {fixableCount > 0 && (
              <Button size="sm" onClick={reconcileAll} disabled={reconcilingAll}>
                <Wand2 className="h-4 w-4 mr-2" />
                {reconcilingAll ? 'A reconciliar...' : `Reconciliar (${fixableCount})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-success mb-3" />
              <p className="font-medium">Tudo em ordem</p>
              <p className="text-sm text-muted-foreground">
                Não há diferenças entre despesas e fornecedores.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diffs.map(d => (
                  <TableRow key={d.key}>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[d.type]}>
                        {TYPE_LABELS[d.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.expense?.expense_id || d.supplier?.name || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.details}</TableCell>
                    <TableCell className="text-right">
                      {d.fixable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reconcile(d)}
                          disabled={reconciling === d.key || reconcilingAll}
                        >
                          {reconciling === d.key ? 'A reconciliar...' : 'Reconciliar'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Revisão manual</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
