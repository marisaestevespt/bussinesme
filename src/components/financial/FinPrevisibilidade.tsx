import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { parseISO } from 'date-fns';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { computeFiscalDeadlines, type FiscalConfig } from '@/lib/fiscalDeadlines';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { sumVat } from '@/lib/salesCalculations';
import { formatEuro } from '@/lib/formatting';

const FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
type Sale = {
  sale_month: number | null;
  sale_year: number | null;
  invoice_total: number;
  base_value: number;
};

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  currentYear: number;
  sales: Sale[];
}

export function FinPrevisibilidade({ fin, currentYear, sales }: Props) {
  const { settings } = useBusinessSettings();
  const recurringExpenses = fin.recurringExpenses.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];
  const expenses = fin.expenses.data || [];

  const activeRecs = recurringExpenses.filter(s => s.status !== 'cancelado');
  const totalMonthly = activeRecs.reduce((s, sub) => s + ((sub as any).monthly_equivalent || 0), 0);

  const s = settings as any;
  const ssType: string = s?.ss_type || 'independente';
  const hasAccountant: boolean = s?.has_accountant ?? false;
  const fiscalConfig: FiscalConfig = {
    taxIvaRegime: s?.tax_iva_regime || 'trimestral',
    taxIrsRegime: s?.tax_irs_regime || 'simplificado',
    ssExempt: s?.ss_exempt ?? false,
    ivaExempt: s?.iva_exempt ?? false,
    hasAccountant,
  };
  const isContabOrganizada = fiscalConfig.taxIrsRegime === 'contabilidade_organizada';
  // Estimates remain visible when there's an accountant — only contabilidade organizada hides them.
  const showIndependente = (ssType === 'independente' || ssType === 'ambos') && !fiscalConfig.ssExempt && !isContabOrganizada;
  const showPatronal = (ssType === 'entidade_patronal' || ssType === 'ambos') && !fiscalConfig.ssExempt && !isContabOrganizada;

  const now = new Date();
  const currentMonth = now.getFullYear() === currentYear ? now.getMonth() + 1 : 12;

  // Estimate monthly tax burden
  const taxByMonth = useMemo(() => {
    const result: Record<number, { ss: number; iva: number; label: string }> = {};

    // Revenue by quarter for independente SS
    const yearSalesData = sales.filter(sl => sl.sale_year === currentYear);
    const revenueByQuarter: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    yearSalesData.forEach(sl => {
      const m = sl.sale_month || 0;
      if (m >= 1 && m <= 3) revenueByQuarter[1] += sl.invoice_total;
      else if (m >= 4 && m <= 6) revenueByQuarter[2] += sl.invoice_total;
      else if (m >= 7 && m <= 9) revenueByQuarter[3] += sl.invoice_total;
      else if (m >= 10 && m <= 12) revenueByQuarter[4] += sl.invoice_total;
    });

    for (let m = 1; m <= 12; m++) {
      let ss = 0;
      let iva = 0;
      const labels: string[] = [];

      // SS Independente: 21.4% on 70% of quarterly revenue / 3
      if (showIndependente) {
        let qRevenue = 0;
        if (m >= 7 && m <= 9) qRevenue = revenueByQuarter[1];
        else if (m >= 10 && m <= 12) qRevenue = revenueByQuarter[2];
        else if (m >= 1 && m <= 3) qRevenue = revenueByQuarter[3] || revenueByQuarter[1];
        else if (m >= 4 && m <= 6) qRevenue = revenueByQuarter[4] || revenueByQuarter[2];

        if (qRevenue === 0) {
          const totalRev = Object.values(revenueByQuarter).reduce((s, v) => s + v, 0);
          qRevenue = totalRev / 4;
        }
        const baseInd = (qRevenue * 0.70) / 3;
        const ssInd = Math.round(baseInd * 0.214 * 100) / 100;
        ss += baseInd > 0 ? Math.max(20, ssInd) : 0;
        if (ss > 0) labels.push('SS Ind.');
      }

      // SS Patronal: 23.75% on gross salaries
      if (showPatronal) {
        const monthPayroll = payrollData.filter(p => p.year === currentYear && p.month === m);
        const totalGross = monthPayroll.reduce((s, v) => s + ((v as any).gross_salary || 0), 0);
        let ssPat = Math.round(totalGross * 0.2375 * 100) / 100;
        if (ssPat === 0 && m > currentMonth) {
          const latestPayroll = payrollData.filter(p => p.year === currentYear && p.month <= currentMonth);
          if (latestPayroll.length > 0) {
            const avgGross = latestPayroll.reduce((s, v) => s + ((v as any).gross_salary || 0), 0) / latestPayroll.length;
            ssPat = Math.round(avgGross * 0.2375 * 100) / 100;
          }
        }
        ss += ssPat;
        if (ssPat > 0) labels.push('SS Pat.');
      }

      // IVA — só apura se NÃO estiver isenta (art. 53.º), não tiver contabilista e não for contab. organizada.
      // Quando iva_exempt = true: não cobra IVA nas vendas e não deduz IVA das despesas
      // (o IVA pago vira custo). Quando tem contabilista: este trata do apuramento.
      if (!fiscalConfig.ivaExempt && !isContabOrganizada) {
        const monthSales = sales.filter(sl => sl.sale_year === currentYear && sl.sale_month === m);
        const ivaCobrado = sumVat(monthSales);
        const monthExpenses = (expenses || []).filter(e => e.expense_year === currentYear && e.expense_month === m);
        const ivaPago = monthExpenses.reduce((s, v) => s + (v.total_with_vat - v.base_value), 0);
        iva = Math.round(Math.max(0, ivaCobrado - ivaPago) * 100) / 100;
        if (iva > 0) labels.push('IVA');
      }

      result[m] = { ss, iva, label: labels.join(' + ') || '—' };
    }
    return result;
  }, [fiscalConfig, isContabOrganizada, showIndependente, showPatronal, payrollData, currentYear, currentMonth, sales, expenses]);

  const predictability = useMemo(() => {
    const revenueByMonth: Record<number, number> = {};
    sales.filter(s => s.sale_year === currentYear).forEach(s => {
      if (s.sale_month) {
        revenueByMonth[s.sale_month] = (revenueByMonth[s.sale_month] || 0) + s.base_value;
      }
    });

    const pastMonths = Object.entries(revenueByMonth).filter(([m]) => parseInt(m) <= currentMonth);
    const avgRevenue = pastMonths.length > 0
      ? pastMonths.reduce((s, [, v]) => s + v, 0) / pastMonths.length
      : 0;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const subsTotal = totalMonthly;
      const pessoal = payrollData.filter(p => p.year === currentYear && p.month === m).reduce((s, v) => s + v.total_cost, 0);
      const prest = contractorsData.filter(c => c.year === currentYear && c.month === m).reduce((s, v) => s + v.value, 0);
      const tax = taxByMonth[m];
      const impostos = tax.ss + tax.iva;
      const totalSaidas = Math.round((subsTotal + pessoal + prest + impostos) * 100) / 100;

      const isPast = m <= currentMonth && now.getFullYear() === currentYear;
      const hasScheduled = revenueByMonth[m] !== undefined && revenueByMonth[m] > 0;
      const entradas = hasScheduled ? revenueByMonth[m] : 0;
      const balanco = Math.round((entradas - totalSaidas) * 100) / 100;

      const renewals = recurringExpenses.filter(s => {
        if (!(s as any).renewal_date || s.status === 'cancelado') return false;
        const rd = parseISO((s as any).renewal_date);
        return rd.getMonth() + 1 === m;
      });

      const isEstimate = !isPast && !hasScheduled && entradas > 0;
      return { mes: FULL[i], entradas, subs: subsTotal, pessoal, prestadores: prest, impostos, taxLabel: tax.label, totalSaidas, balanco, renewals, isPast, isEstimate };
    });
  }, [totalMonthly, payrollData, contractorsData, recurringExpenses, currentYear, sales, currentMonth, taxByMonth]);

  const totals = useMemo(() => {
    return predictability.reduce((acc, p) => ({
      entradas: acc.entradas + p.entradas,
      saidas: acc.saidas + p.totalSaidas,
      impostos: acc.impostos + p.impostos,
      balanco: acc.balanco + p.balanco,
    }), { entradas: 0, saidas: 0, impostos: 0, balanco: 0 });
  }, [predictability]);

  return (
    <div className="space-y-6 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas Previstas (s/ IVA)</p><p className="text-lg font-bold text-success">{formatEuro(totals.entradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas Previstas (c/ IVA)</p><p className="text-lg font-bold text-destructive">{formatEuro(totals.saidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Impostos Previstos (Ano)</p><p className="text-lg font-bold text-warning">{formatEuro(totals.impostos)}</p>{isContabOrganizada && <p className="text-[10px] text-muted-foreground">Gerido pelo contabilista</p>}</CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço Previsto (Ano)</p><p className={`text-lg font-bold ${totals.balanco >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(totals.balanco)}</p></CardContent></Card>
      </div>

      {isContabOrganizada && (
        <Card className="border-warning/30 bg-warning/15/50 dark:bg-warning/20 dark:border-warning">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Em contabilidade organizada, os valores de impostos são estimativas. Os valores reais são geridos pelo teu contabilista.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Subscrições</TableHead>
                <TableHead className="text-right">Pessoal</TableHead>
                <TableHead className="text-right">Prestadores</TableHead>
                <TableHead className="text-right">Impostos</TableHead>
                <TableHead className="text-right">Total Saídas</TableHead>
                <TableHead className="text-right">Balanço</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictability.map((p, i) => (
                <TableRow key={i} className={!p.isPast ? 'opacity-70' : ''}>
                  <TableCell className="font-medium">{p.mes}</TableCell>
                  <TableCell className="text-right text-success">
                    {formatEuro(p.entradas)}
                    {p.isEstimate && <span className="text-[10px] text-muted-foreground ml-1">(est.)</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatEuro(p.subs)}</TableCell>
                  <TableCell className="text-right">{formatEuro(p.pessoal)}</TableCell>
                  <TableCell className="text-right">{formatEuro(p.prestadores)}</TableCell>
                  <TableCell className="text-right text-warning">
                    {p.impostos > 0 ? formatEuro(p.impostos) : '—'}
                    {p.impostos > 0 && <span className="text-[10px] text-muted-foreground ml-1">({p.taxLabel})</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatEuro(p.totalSaidas)}</TableCell>
                  <TableCell className={`text-right font-bold ${p.balanco >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(p.balanco)}</TableCell>
                  <TableCell>
                    {p.renewals.length > 0 && <Badge variant="outline" className="bg-warning/15 text-warning dark:bg-warning/30 dark:text-warning text-xs">{p.renewals.length} renovação(ões)</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
