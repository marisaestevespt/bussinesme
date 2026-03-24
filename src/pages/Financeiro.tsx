import { useMemo } from 'react';
import { useKpiSettings } from '@/hooks/useKpiSettings';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { excludeCancelled } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarDays, CalendarRange, ArrowDownLeft, ArrowUpRight, Receipt, Shield, FolderOpen, Settings } from 'lucide-react';

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const SECTIONS = [
  { path: '/hub/financeiro/mensal', label: 'Mensal', icon: CalendarDays, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { path: '/hub/financeiro/trimestral', label: 'Trimestral', icon: CalendarRange, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { path: '/hub/financeiro/entradas', label: 'Entradas', icon: ArrowDownLeft, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
  { path: '/hub/financeiro/saidas', label: 'Saídas', icon: ArrowUpRight, iconColor: 'text-red-600', color: 'from-red-500/10 to-red-600/5 hover:from-red-500/20 hover:to-red-600/10' },
  { path: '/hub/financeiro/iva', label: 'IVA', icon: Receipt, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/financeiro/seguranca-social', label: 'Segurança Social', icon: Shield, iconColor: 'text-cyan-600', color: 'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10' },
  { path: '/hub/financeiro/documentos', label: 'Documentos', icon: FolderOpen, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
  { path: '/hub/financeiro/setup-financeiro', label: 'Setup Financeiro', icon: Settings, iconColor: 'text-slate-600', color: 'from-slate-500/10 to-slate-600/5 hover:from-slate-500/20 hover:to-slate-600/10' },
];

export default function FinanceiroPage() {
  const fin = useFinancialData();
  const com = useCommercialData();
  const navigate = useNavigate();
  const { isKpiEnabled, isAreaEnabled } = useKpiSettings();

  const currentYear = new Date().getFullYear();
  const sales = excludeCancelled(com.sales.data || []);
  const expenses = excludeCancelled(fin.expenses.data || []);

  const marginData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ent = sales.filter(s => s.sale_year === currentYear && s.sale_month === m).reduce((s, v) => s + v.invoice_total, 0);
      const sai = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const res = ent - sai;
      return { mes: ML[i], margem: ent > 0 ? Math.round(res / ent * 10000) / 100 : 0 };
    });
  }, [sales, expenses, currentYear]);

  const { totalEntradas, totalSaidas, resultado } = useMemo(() => {
    const ent = sales.filter(s => s.sale_year === currentYear).reduce((s, v) => s + v.invoice_total, 0);
    const sai = expenses.filter(e => e.expense_year === currentYear).reduce((s, v) => s + v.total_with_vat, 0);
    return { totalEntradas: ent, totalSaidas: sai, resultado: ent - sai };
  }, [sales, expenses, currentYear]);

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        <PageHeader title="Contabilidade" subtitle="Gestão contabilística, entradas, saídas e obrigações fiscais." />

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {SECTIONS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="font-medium text-sm text-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Summary cards */}
        {isAreaEnabled('financeiro') && isKpiEnabled('financeiro', 'entradas_vs_saidas') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Entradas ({currentYear})</p><p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Saídas ({currentYear})</p><p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço ({currentYear})</p><p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
        </div>
        )}

        {/* Margin chart */}
        {isAreaEnabled('financeiro') && isKpiEnabled('financeiro', 'margem_lucro') && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-2">Margem de Lucro ao longo do ano — {currentYear}</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marginData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} unit="%" stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="margem" name="Margem" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </AppLayout>
  );
}
