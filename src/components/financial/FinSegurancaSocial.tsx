import { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import type { useFinancialData, Expense } from '@/hooks/useFinancialData';
import { FinDocumentsUpload, type FinDocItem } from './FinDocumentsUpload';
import { exportCsv } from '@/lib/exportCsv';
import { exportPdf } from '@/lib/exportPdf';
import { formatEuro } from '@/lib/formatting';
import { IndependenteSection } from './finSS/IndependenteSection';
import { PatronalSection } from './finSS/PatronalSection';
import { useSSData } from './finSS/useSSData';
import { SS_MONTHS } from './finSS/types';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  expenses: Expense[];
  currentYear: number;
  sales: { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null }[];
}

export function FinSegurancaSocial({ fin, expenses, currentYear, sales }: Props) {
  const { settings } = useBusinessSettings();
  const ssType: string = (settings as { ss_type?: string } | null)?.ss_type || 'independente';
  const showIndependente = ssType === 'independente' || ssType === 'ambos';
  const showPatronal = ssType === 'entidade_patronal' || ssType === 'ambos';
  const defaultTab = ssType === 'entidade_patronal' ? 'patronal' : 'independente';

  const {
    contracts,
    independenteData,
    patronalData,
    handleSavePayment,
    handleTogglePayment,
  } = useSSData({ fin, expenses, currentYear, sales, showIndependente, showPatronal });

  const ssDoc = useMemo(() => {
    return (fin.documents.data || []).find(d => d.doc_type === 'ss_declarations' && d.period_year === currentYear);
  }, [fin.documents.data, currentYear]);

  const ssDocuments: FinDocItem[] = useMemo(() => {
    if (!ssDoc?.notes) return [];
    try { return JSON.parse(ssDoc.notes); } catch { return []; }
  }, [ssDoc]);

  const handleDocsUpdate = useCallback(async (docs: FinDocItem[]) => {
    await fin.upsertDocument.mutateAsync({
      ...(ssDoc ? { id: ssDoc.id } : {}),
      title: `Declarações SS ${currentYear}`,
      doc_type: 'ss_declarations',
      period_year: currentYear,
      notes: JSON.stringify(docs),
      status: 'ativo',
    });
  }, [ssDoc, currentYear, fin]);

  const totalIndPrevisto = independenteData.reduce((s, d) => s + d.contribution, 0);
  const totalIndPago = independenteData.reduce((s, d) => s + d.paid, 0);
  const totalPatPrevisto = patronalData.reduce((s, d) => s + d.ssEmployer, 0);
  const totalPatPago = patronalData.reduce((s, d) => s + d.paid, 0);

  const hasBothTabs = showIndependente && showPatronal;

  const handleExportCsv = () => {
    if (showIndependente) {
      const headers = ['Mês', 'Rendimento Trimestre', 'Rend. Relevante (70%)', 'SS Prevista', 'SS Paga'];
      const rows = independenteData.map(d => [SS_MONTHS[d.month - 1], d.quarterRevenue, d.rendimentoRelevante, d.contribution, d.paid]);
      exportCsv(`ss_independente_${currentYear}.csv`, headers, rows);
    }
    if (showPatronal) {
      const headers = ['Mês', 'Salário Bruto', 'SS Entidade', 'SS Trabalhador', 'SS Total', 'SS Paga'];
      const rows = patronalData.map(d => [SS_MONTHS[d.month - 1], d.totalGross, d.ssEmployer, d.ssEmployee, d.totalSS, d.paid]);
      exportCsv(`ss_patronal_${currentYear}.csv`, headers, rows);
    }
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={handleExportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        <Button size="sm" variant="outline" onClick={() => { exportPdf(`Segurança Social — ${currentYear}`, 'fin-ss-export'); toast.success('PDF a gerar...'); }}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
      </div>
      <div id="fin-ss-export">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {showIndependente && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">SS Independente Prevista</p>
                  <p className="text-lg font-bold">{formatEuro(totalIndPrevisto)}</p>
                  <p className="text-[10px] text-muted-foreground">21,4% s/ 70% faturação</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">SS Independente Paga</p>
                  <p className="text-lg font-bold">{formatEuro(totalIndPago)}</p>
                </CardContent>
              </Card>
            </>
          )}
          {showPatronal && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">SS Patronal Prevista</p>
                  <p className="text-lg font-bold">{formatEuro(totalPatPrevisto)}</p>
                  <p className="text-[10px] text-muted-foreground">23,75% s/ salários brutos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">SS Patronal Paga</p>
                  <p className="text-lg font-bold">{formatEuro(totalPatPago)}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {hasBothTabs ? (
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="independente">Independente / ENI</TabsTrigger>
              <TabsTrigger value="patronal">Patronal</TabsTrigger>
            </TabsList>
            <TabsContent value="independente">
              <IndependenteSection
                data={independenteData}
                currentYear={currentYear}
                onSave={(m, v) => handleSavePayment(m, v, 'independente')}
                onToggle={(m) => handleTogglePayment(m, 'independente')}
              />
            </TabsContent>
            <TabsContent value="patronal">
              <PatronalSection
                data={patronalData}
                contracts={contracts}
                currentYear={currentYear}
                onSave={(m, v) => handleSavePayment(m, v, 'patronal')}
                onToggle={(m) => handleTogglePayment(m, 'patronal')}
              />
            </TabsContent>
          </Tabs>
        ) : showIndependente ? (
          <IndependenteSection
            data={independenteData}
            currentYear={currentYear}
            onSave={(m, v) => handleSavePayment(m, v, 'independente')}
            onToggle={(m) => handleTogglePayment(m, 'independente')}
          />
        ) : (
          <PatronalSection
            data={patronalData}
            contracts={contracts}
            currentYear={currentYear}
            onSave={(m, v) => handleSavePayment(m, v, 'patronal')}
            onToggle={(m) => handleTogglePayment(m, 'patronal')}
          />
        )}

        <FinDocumentsUpload
          title={`Declarações de Segurança Social — ${currentYear}`}
          documents={ssDocuments}
          onUpdate={handleDocsUpdate}
          namePrefix={`${currentYear}_SS`}
        />
      </div>
    </div>
  );
}
