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
  member_id: string | null;
  expense_month: number | null;
  expense_year: number | null;
  source_type: string | null;
  status: string | null;
  base_value: number | null;
  total_with_vat: number | null;
  expense_date: string | null;
}

interface PaymentRow {
  id: string;
  member_id: string | null;
  month: number;
  year: number;
  payment_type: string | null;
  status: string | null;
  gross_value: number | null;
  net_value: number | null;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  contract_type: string | null;
}

type DiffType = 'missing_payment' | 'missing_expense' | 'status_mismatch' | 'value_mismatch';

interface Diff {
  key: string;
  type: DiffType;
  member_id: string | null;
  member_name: string;
  month: number | null;
  year: number | null;
  expense?: ExpenseRow;
  payment?: PaymentRow;
  details: string;
}

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TYPE_LABELS: Record<DiffType, string> = {
  missing_payment: 'Pagamento em falta',
  missing_expense: 'Despesa em falta',
  status_mismatch: 'Status divergente',
  value_mismatch: 'Valor divergente',
};

const TYPE_COLORS: Record<DiffType, string> = {
  missing_payment: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  missing_expense: 'bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning',
  status_mismatch: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  value_mismatch: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-destructive',
};

function eqMoney(a: number | null | undefined, b: number | null | undefined) {
  const av = Number(a || 0);
  const bv = Number(b || 0);
  return Math.abs(av - bv) < 0.01;
}

function paymentTypeFor(member: MemberRow | undefined) {
  if (!member) return 'outro';
  if (member.contract_type === 'recibos_verdes') return 'recibo_verde';
  if (member.contract_type === 'contrato_trabalho') return 'salario';
  return 'outro';
}

export function FinAuditoriaPagamentos() {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [reconcilingAll, setReconcilingAll] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const memberById = useMemo(() => {
    const m = new Map<string, MemberRow>();
    members.forEach(x => m.set(x.id, x));
    return m;
  }, [members]);

  async function load() {
    setLoading(true);
    try {
      const [{ data: ex }, { data: pa }, { data: tm }] = await Promise.all([
        supabase
          .from('financial_expenses')
          .select('id,member_id,expense_month,expense_year,source_type,status,base_value,total_with_vat,expense_date')
          .in('source_type', ['contract', 'contractor', 'salary', 'member_payment'])
          .not('member_id', 'is', null),
        supabase
          .from('member_payments')
          .select('id,member_id,month,year,payment_type,status,gross_value,net_value'),
        supabase.from('team_members').select('id,full_name,contract_type'),
      ]);
      setExpenses(((ex as unknown) as ExpenseRow[]) || []);
      setPayments(((pa as unknown) as PaymentRow[]) || []);
      setMembers(((tm as unknown) as MemberRow[]) || []);
    } catch (e: any) {
      toast.error('Erro a carregar dados de auditoria');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const diffs = useMemo<Diff[]>(() => {
    const result: Diff[] = [];
    const paymentByKey = new Map<string, PaymentRow>();
    payments.forEach(p => {
      paymentByKey.set(`${p.member_id}|${p.month}|${p.year}`, p);
    });
    const expenseByKey = new Map<string, ExpenseRow>();
    expenses.forEach(e => {
      if (!e.member_id || !e.expense_month || !e.expense_year) return;
      expenseByKey.set(`${e.member_id}|${e.expense_month}|${e.expense_year}`, e);
    });

    // Walk expenses
    expenses.forEach(e => {
      if (!e.member_id || !e.expense_month || !e.expense_year) return;
      const key = `${e.member_id}|${e.expense_month}|${e.expense_year}`;
      const member = memberById.get(e.member_id);
      const memberName = member?.full_name || 'Membro desconhecido';
      const p = paymentByKey.get(key);
      if (!p) {
        result.push({
          key: `mp-${e.id}`,
          type: 'missing_payment',
          member_id: e.member_id,
          member_name: memberName,
          month: e.expense_month,
          year: e.expense_year,
          expense: e,
          details: 'Existe despesa mas não há pagamento correspondente.',
        });
        return;
      }
      if ((p.status || 'pendente') !== (e.status || 'pendente')) {
        result.push({
          key: `sm-${e.id}`,
          type: 'status_mismatch',
          member_id: e.member_id,
          member_name: memberName,
          month: e.expense_month,
          year: e.expense_year,
          expense: e,
          payment: p,
          details: `Despesa: ${e.status || 'pendente'} · Pagamento: ${p.status || 'pendente'}`,
        });
      }
      const expGross = e.total_with_vat ?? e.base_value;
      const expNet = e.base_value ?? e.total_with_vat;
      if (!eqMoney(expGross, p.gross_value) || !eqMoney(expNet, p.net_value)) {
        result.push({
          key: `vm-${e.id}`,
          type: 'value_mismatch',
          member_id: e.member_id,
          member_name: memberName,
          month: e.expense_month,
          year: e.expense_year,
          expense: e,
          payment: p,
          details: `Despesa: ${Number(expNet || 0).toFixed(2)}€ · Pagamento: ${Number(p.net_value || 0).toFixed(2)}€`,
        });
      }
    });

    // Walk payments to find missing expenses
    payments.forEach(p => {
      if (!p.member_id) return;
      const key = `${p.member_id}|${p.month}|${p.year}`;
      if (!expenseByKey.has(key)) {
        const member = memberById.get(p.member_id);
        result.push({
          key: `me-${p.id}`,
          type: 'missing_expense',
          member_id: p.member_id,
          member_name: member?.full_name || 'Membro desconhecido',
          month: p.month,
          year: p.year,
          payment: p,
          details: 'Existe pagamento mas não há despesa correspondente em saídas.',
        });
      }
    });

    return result.sort((a, b) => {
      if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
      return (b.month || 0) - (a.month || 0);
    });
  }, [expenses, payments, memberById]);

  const counts = useMemo(() => {
    const c: Record<DiffType, number> = {
      missing_payment: 0,
      missing_expense: 0,
      status_mismatch: 0,
      value_mismatch: 0,
    };
    diffs.forEach(d => { c[d.type] += 1; });
    return c;
  }, [diffs]);

  async function reconcile(diff: Diff) {
    setReconciling(diff.key);
    try {
      if (diff.type === 'missing_payment' && diff.expense) {
        const e = diff.expense;
        const member = memberById.get(e.member_id!);
        const payload: any = {
          member_id: e.member_id!,
          month: e.expense_month!,
          year: e.expense_year!,
          payment_type: paymentTypeFor(member),
          gross_value: e.total_with_vat ?? e.base_value ?? 0,
          net_value: e.base_value ?? e.total_with_vat ?? 0,
          status: e.status || 'pendente',
        };
        const { error } = await supabase.from('member_payments').insert(payload);
        if (error) throw error;
      } else if (diff.type === 'missing_expense' && diff.payment) {
        // Removing the orphan payment is the safest reconciliation here —
        // it matches the cascade-on-delete behaviour the triggers enforce.
        const { error } = await supabase
          .from('member_payments')
          .delete()
          .eq('id', diff.payment.id);
        if (error) throw error;
      } else if (diff.type === 'status_mismatch' && diff.expense && diff.payment) {
        // Source of truth: financial_expenses
        const { error } = await supabase
          .from('member_payments')
          .update({ status: diff.expense.status || 'pendente' })
          .eq('id', diff.payment.id);
        if (error) throw error;
      } else if (diff.type === 'value_mismatch' && diff.expense && diff.payment) {
        const { error } = await supabase
          .from('member_payments')
          .update({
            gross_value: diff.expense.total_with_vat ?? diff.expense.base_value ?? 0,
            net_value: diff.expense.base_value ?? diff.expense.total_with_vat ?? 0,
          })
          .eq('id', diff.payment.id);
        if (error) throw error;
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
    if (diffs.length === 0) return;
    setReconcilingAll(true);
    let ok = 0;
    let fail = 0;
    for (const d of diffs) {
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

  const totalSynced = expenses.length + payments.length - diffs.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">Sincronizados</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-2xl font-semibold">{totalSynced}</span>
            </div>
          </CardContent>
        </Card>
        {(['missing_payment', 'missing_expense', 'status_mismatch', 'value_mismatch'] as DiffType[]).map(t => (
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
                ? 'Despesas e pagamentos estão 100% sincronizados.'
                : `${diffs.length} diferença${diffs.length === 1 ? '' : 's'} entre saídas financeiras e pagamentos de membros.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading || reconcilingAll}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            {diffs.length > 0 && (
              <Button size="sm" onClick={reconcileAll} disabled={reconcilingAll}>
                <Wand2 className="h-4 w-4 mr-2" />
                {reconcilingAll ? 'A reconciliar...' : 'Reconciliar tudo'}
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
                Não há diferenças entre saídas financeiras e pagamentos de membros.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Membro</TableHead>
                  <TableHead>Período</TableHead>
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
                    <TableCell className="font-medium">{d.member_name}</TableCell>
                    <TableCell>
                      {d.month ? PT_MONTHS[d.month - 1] : '—'} {d.year || ''}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.details}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reconcile(d)}
                        disabled={reconciling === d.key || reconcilingAll}
                      >
                        {reconciling === d.key ? 'A reconciliar...' : 'Reconciliar'}
                      </Button>
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