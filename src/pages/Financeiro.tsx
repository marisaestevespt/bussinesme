import { useMemo, useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FinOverview } from '@/components/financial/FinOverview';
import { FinEntradas } from '@/components/financial/FinEntradas';
import { FinSaidas } from '@/components/financial/FinSaidas';
import { FinBalanco } from '@/components/financial/FinBalanco';
import { FinIVA } from '@/components/financial/FinIVA';
import { FinDocumentos } from '@/components/financial/FinDocumentos';
import { FinPayroll } from '@/components/financial/FinPayroll';
import { FinMensal } from '@/components/financial/FinMensal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings2, GripVertical } from 'lucide-react';

const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const ALL_TABS = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'mensal', label: 'Mensal' },
  { key: 'entradas', label: 'Entradas' },
  { key: 'saidas', label: 'Saídas' },
  { key: 'balanco', label: 'Balanço' },
  { key: 'iva', label: 'IVA' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'payroll', label: 'Folha de Pagamentos' },
];

const STORAGE_KEY = 'fin-tabs-config';

function loadTabConfig(): { order: string[]; hidden: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { order: ALL_TABS.map(t => t.key), hidden: [] };
}

function saveTabConfig(config: { order: string[]; hidden: string[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function FinanceiroPage() {
  const fin = useFinancialData();
  const com = useCommercialData();

  const profiles = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const currentYear = new Date().getFullYear();
  const sales = com.sales.data || [];
  const expenses = fin.expenses.data || [];
  const subscriptions = fin.subscriptions.data || [];
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];
  const documents = fin.documents.data || [];

  const [tabConfig, setTabConfig] = useState(loadTabConfig);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const visibleTabs = useMemo(() => {
    const allKeys = ALL_TABS.map(t => t.key);
    // Ensure order contains all keys
    const ordered = [...tabConfig.order.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !tabConfig.order.includes(k))];
    return ordered.filter(k => !tabConfig.hidden.includes(k)).map(k => ALL_TABS.find(t => t.key === k)!);
  }, [tabConfig]);

  const updateConfig = useCallback((next: { order: string[]; hidden: string[] }) => {
    setTabConfig(next);
    saveTabConfig(next);
  }, []);

  const toggleTab = useCallback((key: string) => {
    const hidden = tabConfig.hidden.includes(key)
      ? tabConfig.hidden.filter(k => k !== key)
      : [...tabConfig.hidden, key];
    updateConfig({ ...tabConfig, hidden });
  }, [tabConfig, updateConfig]);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const allKeys = ALL_TABS.map(t => t.key);
    const ordered = [...tabConfig.order.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !tabConfig.order.includes(k))];
    const visibleKeys = ordered.filter(k => !tabConfig.hidden.includes(k));
    const dragKey = visibleKeys[dragIdx];
    const newVisible = visibleKeys.filter((_, i) => i !== dragIdx);
    newVisible.splice(dropIdx, 0, dragKey);
    // Rebuild full order: visible in new order, then hidden in original order
    const hiddenKeys = ordered.filter(k => tabConfig.hidden.includes(k));
    updateConfig({ ...tabConfig, order: [...newVisible, ...hiddenKeys] });
    setDragIdx(null);
  };

  // Margin chart data
  const marginData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ent = sales.filter(s => s.sale_year === currentYear && s.sale_month === m).reduce((s, v) => s + v.invoice_total, 0);
      const sai = expenses.filter(e => e.expense_year === currentYear && e.expense_month === m).reduce((s, v) => s + v.total_with_vat, 0);
      const res = ent - sai;
      const margem = ent > 0 ? Math.round(res / ent * 10000) / 100 : 0;
      return { mes: ML[i], margem };
    });
  }, [sales, expenses, currentYear]);

  const { totalEntradas, totalSaidas, resultado, margem } = useMemo(() => {
    const ent = sales.filter(s => s.sale_year === currentYear).reduce((s, v) => s + v.invoice_total, 0);
    const sai = expenses.filter(e => e.expense_year === currentYear).reduce((s, v) => s + v.total_with_vat, 0);
    const res = ent - sai;
    const mar = ent > 0 ? Math.round(res / ent * 10000) / 100 : 0;
    return { totalEntradas: ent, totalSaidas: sai, resultado: res, margem: mar };
  }, [sales, expenses, currentYear]);

  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].key : 'overview';

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>

        {/* Top area: cards + margin chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Entradas ({currentYear})</p><p className="text-xl font-bold text-green-600">{fmt(totalEntradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Saídas ({currentYear})</p><p className="text-xl font-bold text-red-600">{fmt(totalSaidas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço ({currentYear})</p><p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(resultado)}</p></CardContent></Card>
        </div>

        {/* Margin chart */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-2">Margem de Lucro ao longo do ano — {currentYear}</p>
            <div className="h-32">
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

        <Tabs defaultValue={defaultTab} className="w-full">
          <div className="flex items-center gap-2">
            <TabsList className="flex-1 justify-start flex-wrap h-auto gap-1">
              {visibleTabs.map((tab, idx) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0"><Settings2 className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56">
                <p className="text-sm font-medium mb-2">Tabs visíveis</p>
                <div className="space-y-2">
                  {ALL_TABS.map(tab => (
                    <label key={tab.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!tabConfig.hidden.includes(tab.key)}
                        onCheckedChange={() => toggleTab(tab.key)}
                      />
                      {tab.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Arrasta as tabs para reordenar.</p>
              </PopoverContent>
            </Popover>
          </div>

          <TabsContent value="overview">
            <FinOverview sales={sales} expenses={expenses} subscriptions={subscriptions} payrollData={payrollData} contractorsData={contractorsData} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="mensal">
            <FinMensal sales={sales} expenses={expenses} subscriptions={subscriptions} payrollData={payrollData} contractorsData={contractorsData} documents={documents} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="entradas">
            <FinEntradas sales={sales} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="saidas">
            <FinSaidas fin={fin} />
          </TabsContent>
          <TabsContent value="balanco">
            <FinBalanco sales={sales} expenses={expenses} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="iva">
            <FinIVA sales={sales} expenses={expenses} currentYear={currentYear} />
          </TabsContent>
          <TabsContent value="documentos">
            <FinDocumentos fin={fin} />
          </TabsContent>
          <TabsContent value="payroll">
            <FinPayroll fin={fin} profiles={profiles.data || []} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
