import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, ArrowDownToLine, ArrowUpFromLine, Scale, Percent } from 'lucide-react';
import { StatCard } from '@/components/editorial';
import { exportPdf } from '@/lib/exportPdf';
import { formatEuro } from '@/lib/formatting';
import type { TrimSale, TrimExpense } from './finTrimestral/types';
import { QUARTERS } from './finTrimestral/types';
import { useTrimestralData } from './finTrimestral/useTrimestralData';
import { AllQuartersView } from './finTrimestral/AllQuartersView';
import { SingleQuarterView } from './finTrimestral/SingleQuarterView';

interface Props {
  sales: TrimSale[];
  expenses: TrimExpense[];
  currentYear: number;
}

export function FinTrimestral({ sales, expenses, currentYear }: Props) {
  const [selectedQ, setSelectedQ] = useState<string>('todos');
  const {
    data, totals, monthlyData, allCategories, allProducts,
    selectedData, selectedQDef, selectedMonthlyData,
    filteredProducts, filteredCategories, bestQuarter, worstQuarter,
  } = useTrimestralData(sales, expenses, currentYear, selectedQ);

  const dv = selectedData ? {
    entradas: selectedData.entradas, saidas: selectedData.saidas, resultado: selectedData.resultado,
    margem: selectedData.margem, ivaCobrado: selectedData.ivaCobrado, ivaPago: selectedData.ivaPago,
    ivaBalanco: selectedData.ivaBalanco, ss: selectedData.ss,
  } : totals;

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Relatório Financeiro Trimestral — {currentYear}</h2>
        <Button size="sm" variant="outline" onClick={() => exportPdf(`Relatório Financeiro Trimestral — ${currentYear}`, 'fin-trimestral-report')}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar
        </Button>
      </div>

      <Tabs value={selectedQ} onValueChange={setSelectedQ}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {QUARTERS.map(q => (
            <TabsTrigger key={q.label} value={q.label}>
              {q.label} <span className="hidden sm:inline ml-1 text-muted-foreground text-[10px]">{q.range}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div id="fin-trimestral-report" className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard tone="success" size="sm" value={formatEuro(dv.entradas)} label={<><ArrowDownToLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />{selectedQ === 'todos' ? 'total' : selectedQ.toLowerCase()} entradas (s/ IVA)</>} />
          <StatCard tone="destructive" size="sm" value={formatEuro(dv.saidas)} label={<><ArrowUpFromLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />{selectedQ === 'todos' ? 'total' : selectedQ.toLowerCase()} saídas (s/ IVA)</>} />
          <StatCard tone={dv.resultado >= 0 ? 'success' : 'destructive'} size="sm" value={formatEuro(dv.resultado)} label={<><Scale className="h-3 w-3 inline mr-1.5 -mt-0.5" />resultado (s/ IVA)</>} />
          <StatCard tone={dv.margem >= 0 ? 'gold' : 'destructive'} size="sm" value={`${dv.margem}%`} label={<><Percent className="h-3 w-3 inline mr-1.5 -mt-0.5" />margem</>} />
        </div>

        {selectedQ === 'todos' ? (
          <AllQuartersView
            data={data}
            totals={totals}
            monthlyData={monthlyData}
            allProducts={allProducts}
            allCategories={allCategories}
            bestQuarter={bestQuarter}
            worstQuarter={worstQuarter}
            onSelectQuarter={setSelectedQ}
          />
        ) : selectedData && selectedQDef ? (
          <SingleQuarterView
            selectedData={selectedData}
            selectedMonthlyData={selectedMonthlyData}
            filteredProducts={filteredProducts}
            filteredCategories={filteredCategories}
            dv={dv}
          />
        ) : null}
      </div>
    </div>
  );
}
