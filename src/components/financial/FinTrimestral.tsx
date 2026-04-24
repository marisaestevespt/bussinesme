import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{selectedQ === 'todos' ? 'Total' : selectedQ} Entradas</p><p className="text-xl font-bold text-success">{formatEuro(dv.entradas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{selectedQ === 'todos' ? 'Total' : selectedQ} Saídas</p><p className="text-xl font-bold text-destructive">{formatEuro(dv.saidas)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Resultado</p><p className={`text-xl font-bold ${dv.resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatEuro(dv.resultado)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem</p><p className={`text-xl font-bold ${dv.margem >= 0 ? 'text-success' : 'text-destructive'}`}>{dv.margem}%</p></CardContent></Card>
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
