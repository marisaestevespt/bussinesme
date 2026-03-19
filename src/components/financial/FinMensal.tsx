import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Expense, Subscription, PayrollEntry, ContractorEntry, FinancialDocument } from '@/hooks/useFinancialData';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; description?: string | null; status?: string };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  subscriptions: Subscription[];
  payrollData: PayrollEntry[];
  contractorsData: ContractorEntry[];
  documents: FinancialDocument[];
  currentYear: number;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function FinMensal({ sales, expenses, subscriptions, payrollData, contractorsData, documents, currentYear }: Props) {
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth.toString());
  const m = parseInt(month);

  const monthSales = useMemo(() => sales.filter(s => s.sale_year === currentYear && s.sale_month === m), [sales, currentYear, m]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear && e.expense_month === m), [expenses, currentYear, m]);
  const monthPayroll = useMemo(() => payrollData.filter(p => p.year === currentYear && p.month === m), [payrollData, currentYear, m]);
  const monthContractors = useMemo(() => contractorsData.filter(c => c.year === currentYear && c.month === m), [contractorsData, currentYear, m]);
  const monthDocs = useMemo(() => documents.filter(d => d.period_month === m && d.period_year === currentYear), [documents, currentYear, m]);

  const totalEntradas = monthSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalSaidas = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  const activeSubs = subscriptions.filter(s => s.status === 'ativo');
  const totalSubsMonthly = activeSubs.reduce((s, sub) => s + sub.monthly_equivalent, 0);
  const totalPayroll = monthPayroll.reduce((s, v) => s + v.total_cost, 0);
  const totalContractors = monthContractors.reduce((s, v) => s + v.value, 0);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{currentYear}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço</p><p className={`text-lg font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem</p><p className={`text-lg font-bold ${margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margem}%</p></CardContent></Card>
      </div>

      {/* Entradas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas — {MONTHS[m - 1]}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Produto</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Fatura Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthSales.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem entradas</TableCell></TableRow>
              ) : monthSales.map((s, i) => (
                <TableRow key={i}><TableCell>{(s as any).description || '—'}</TableCell><TableCell>{(s as any).product || '—'}</TableCell><TableCell>{(s as any).client || '—'}</TableCell><TableCell className="text-right">{fmt(s.invoice_total)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saídas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Saídas — {MONTHS[m - 1]}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Total c/ IVA</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem saídas</TableCell></TableRow>
              ) : monthExpenses.map(e => (
                <TableRow key={e.id}><TableCell className="font-mono text-xs">{e.expense_id}</TableCell><TableCell>{e.description || '—'}</TableCell><TableCell>{e.category}</TableCell><TableCell className="text-right">{fmt(e.total_with_vat)}</TableCell><TableCell><Badge variant="outline">{e.status}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saídas Previstas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Saídas Previstas — {MONTHS[m - 1]}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Subscrições</p><p className="font-semibold">{fmt(totalSubsMonthly)}</p></div>
            <div><p className="text-muted-foreground">Pessoal Fixo</p><p className="font-semibold">{fmt(totalPayroll)}</p></div>
            <div><p className="text-muted-foreground">Prestadores</p><p className="font-semibold">{fmt(totalContractors)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll */}
      {monthPayroll.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Folha de Pagamentos — {MONTHS[m - 1]}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead className="text-right">Custo Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthPayroll.map(p => (
                  <TableRow key={p.id}><TableCell>{p.collaborator_name}</TableCell><TableCell className="text-right">{fmt(p.gross_salary)}</TableCell><TableCell className="text-right">{fmt(p.net_salary)}</TableCell><TableCell className="text-right">{fmt(p.total_cost)}</TableCell><TableCell><Badge variant="outline">{p.status}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Contractors */}
      {monthContractors.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Prestadores — {MONTHS[m - 1]}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Serviço</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthContractors.map(c => (
                  <TableRow key={c.id}><TableCell>{c.contractor_name}</TableCell><TableCell>{c.service || '—'}</TableCell><TableCell className="text-right">{fmt(c.value)}</TableCell><TableCell><Badge variant="outline">{c.status}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {monthDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Documentos — {MONTHS[m - 1]}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tipo</TableHead><TableHead>Data Entrega</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthDocs.map(d => (
                  <TableRow key={d.id}><TableCell>{d.title}</TableCell><TableCell>{d.doc_type}</TableCell><TableCell>{d.due_date || '—'}</TableCell><TableCell><Badge variant="outline">{d.status}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
