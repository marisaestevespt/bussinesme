import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FinancialHealthSection } from './FinancialHealthSection';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUp, BarChart3, ArrowDownToLine, ArrowUpFromLine, Scale, Percent } from 'lucide-react';
import { StatCard } from '@/components/editorial';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense, RecurringExpense, PayrollEntry, ContractorEntry, FinancialDocument } from '@/hooks/useFinancialData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EntryDetailSheet } from './EntryDetailSheet';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { SaleFormDialog } from '@/components/commercial/SaleFormDialog';
import { getAutoExpenseStatus, normalizeUnpaidExpenseStatus } from '@/lib/expenseStatus';
import { ExportContabilistaButton } from './ExportContabilistaButton';
import { computeVatForExpenses, computeVatForSales, computeVatBalance } from '@/lib/vatCalculations';
import { formatEuro } from '@/lib/formatting';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { MonthlyDocUpload, FiscalChecklistCard } from './finMensal/MonthlyDocs';
import { FinAlertasMes } from './FinAlertasMes';
import { EntradasTable, IvaCobradoDialog } from './finMensal/EntradasTable';
import { SegurancaSocialCard, SaidasTable, IvaPagoDialog, NewExpenseDialog } from './finMensal/SaidasSection';
import { MONTHS, getSubscriptionDueDate, canRenderSubscriptionForMonth, type Sale } from './finMensal/helpers';
import { buildSubscriptionExpense, buildContractExpense, type ContractLike } from './finMensal/expenseBuilders';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  sales: (Sale & { id?: string; sale_id?: string | null; payment_date?: string | null; documents?: unknown; })[];
  expenses: Expense[];
  payrollData: PayrollEntry[];
  contractorsData: ContractorEntry[];
  documents: FinancialDocument[];
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}

type SelectedSale = Sale & { id?: string; sale_id?: string | null; payment_date?: string | null; documents?: unknown; };

export function FinMensal({ sales, expenses, fin, currentYear }: Props) {
  const { getCategoryLabel } = useFinancialCategories();
  const qc = useQueryClient();
  const currentMonth = new Date().getMonth() + 1;
  // Persistir mês no URL (?m=4) — sobrevive a re-renders, refetch on focus,
  // navegação para outro tab do browser e regresso, e até partilha de link.
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('m');
  const parsedMonth = monthParam && /^\d+$/.test(monthParam) ? parseInt(monthParam) : NaN;
  const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth.toString()
    : currentMonth.toString();
  const setMonth = useCallback((next: string) => {
    setSearchParams(prev => {
      const sp = new URLSearchParams(prev);
      sp.set('m', next);
      return sp;
    }, { replace: true });
  }, [setSearchParams]);
  const [selectedSale, setSelectedSale] = useState<SelectedSale | null>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [ivaCobradoOpen, setIvaCobradoOpen] = useState(false);
  const [ivaPagoOpen, setIvaPagoOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const m = parseInt(month);

  const { data: monthExpensesFromDb = [] } = useQuery<Expense[]>({
    queryKey: ['financial-expenses', currentYear, m],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_expenses')
        .select('*')
        .or('source_type.is.null,source_type.neq.rule')
        .eq('expense_year', currentYear)
        .eq('expense_month', m)
        .order('expense_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data || []) as Expense[]).map(e => ({
        ...e,
        status: normalizeUnpaidExpenseStatus(e.status, e.expense_date),
      }));
    },
    staleTime: 30 * 1000,
  });

  // Active member contracts
  const { data: activeContracts = [] } = useQuery<ContractLike[]>({
    queryKey: ['active-member-contracts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name, role_title)')
        .in('status', ['ativo'])
        .not('contract_type', 'in', '(contrato_prestacao,prestacao_servicos)');
      const contracts = (data || []) as ContractLike[];
      // Defesa extra: se um membro já tem fornecedor ativo, não duplicar via contrato
      const memberIds = contracts.map(c => c.member_id).filter(Boolean);
      if (memberIds.length === 0) return contracts;
      const { data: sups } = await supabase
        .from('suppliers')
        .select('member_id')
        .in('member_id', memberIds as string[])
        .eq('is_active', true);
      const supMemberIds = new Set((sups || []).map(s => s.member_id));
      return contracts.filter(c => !supMemberIds.has(c.member_id));
    },
  });

  // Products for sale form
  const { data: productNames = [] } = useQuery({
    queryKey: ['product-names-for-sale'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name').order('name');
      return (data || []).map(p => p.name);
    },
  });

  const monthSales = useMemo(() => sales.filter(s => s.sale_year === currentYear && s.sale_month === m).sort((a, b) => {
    const da = a.payment_date || '';
    const db = b.payment_date || '';
    return da.localeCompare(db);
  }), [sales, currentYear, m]);
  const allMonthExpenses = useMemo(() => monthExpensesFromDb.sort((a, b) => {
    const da = a.expense_date || '';
    const db = b.expense_date || '';
    return da.localeCompare(db);
  }), [monthExpensesFromDb]);
  const isHiddenOccurrence = useCallback((e: Expense | undefined) => (
    !!e && e.description?.startsWith('Oculto —') && (e.total_with_vat || 0) === 0 && (e.base_value || 0) === 0
  ), []);
  const monthExpenses = useMemo(() => allMonthExpenses.filter(e => !isHiddenOccurrence(e)), [allMonthExpenses, isHiddenOccurrence]);

  const recurringExps = useMemo(() => fin.recurringExpenses.data || [], [fin.recurringExpenses.data]);
  const dueSubscriptions = useMemo(() => {
    return recurringExps.filter(sub => canRenderSubscriptionForMonth(sub, m, currentYear));
  }, [recurringExps, m, currentYear]);

  // Dedup robusto: o cron `daily-status-update` insere com parent_expense_id mas pode
  // não preencher source_type/source_id. Olhamos para AMBAS as chaves para evitar
  // duplicar uma despesa já criada pelo backend (ver mem://features/recurring-expenses-dedup.md).
  const subExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    allMonthExpenses.forEach(e => {
      if (e.source_type === 'subscription' && e.source_id) map.set(e.source_id, e);
      else if (e.parent_expense_id) map.set(e.parent_expense_id, e);
    });
    return map;
  }, [allMonthExpenses]);

  const contractExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    allMonthExpenses.forEach(e => {
      if (e.source_type === 'contract' && e.source_id) map.set(e.source_id, e);
      else if (e.parent_expense_id) map.set(e.parent_expense_id, e);
    });
    return map;
  }, [allMonthExpenses]);

  const visibleDueSubscriptions = useMemo(
    () => dueSubscriptions.filter(sub => !isHiddenOccurrence(subExpenseMap.get(sub.id))),
    [dueSubscriptions, subExpenseMap, isHiddenOccurrence],
  );
  const visibleActiveContracts = useMemo(
    () => activeContracts.filter(contract => !isHiddenOccurrence(contractExpenseMap.get(contract.id))),
    [activeContracts, contractExpenseMap, isHiddenOccurrence],
  );

  // Auto-materialize recurring subscription & contract expenses for current/past months
  const autoMaterializeRef = useRef(new Set<string>());
  const isMaterializingRef = useRef(false);
  const autoMaterialize = useCallback(async () => {
    if (isMaterializingRef.current) return;
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    if (currentYear > nowYear || (currentYear === nowYear && m > nowMonth)) return;

    const toCreate: Array<() => Promise<void>> = [];

    for (const sub of visibleDueSubscriptions) {
      const key = `sub-${sub.id}-${m}-${currentYear}`;
      if (subExpenseMap.has(sub.id) || autoMaterializeRef.current.has(key)) continue;
      autoMaterializeRef.current.add(key);

      // Dedup cruzado com cron: aceita correspondência por source_id OU parent_expense_id
      const { count } = await supabase.from('financial_expenses')
        .select('id', { count: 'exact', head: true })
        .or(`and(source_type.eq.subscription,source_id.eq.${sub.id}),parent_expense_id.eq.${sub.id}`)
        .eq('expense_month', m)
        .eq('expense_year', currentYear);
      if ((count || 0) > 0) continue;

      const dateStr = getSubscriptionDueDate(sub, m, currentYear);
      const status = getAutoExpenseStatus(dateStr);
      toCreate.push(async () => {
        await fin.upsertExpense.mutateAsync(buildSubscriptionExpense(sub, m, currentYear, status));
      });
    }

    for (const contract of visibleActiveContracts) {
      const key = `contract-${contract.id}-${m}-${currentYear}`;
      if (contractExpenseMap.has(contract.id) || autoMaterializeRef.current.has(key)) continue;
      autoMaterializeRef.current.add(key);

      const { count } = await supabase.from('financial_expenses')
        .select('id', { count: 'exact', head: true })
        .or(`and(source_type.eq.contract,source_id.eq.${contract.id}),parent_expense_id.eq.${contract.id}`)
        .eq('expense_month', m)
        .eq('expense_year', currentYear);
      if ((count || 0) > 0) continue;

      const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
      const status = getAutoExpenseStatus(dateStr);
      toCreate.push(async () => {
        await fin.upsertExpense.mutateAsync(buildContractExpense(contract, m, currentYear, status));
      });
    }

    if (toCreate.length > 0) {
      isMaterializingRef.current = true;
      for (const fn of toCreate) {
        try {
          await fn();
        } catch (err) {
          // O trigger DB block_expense_for_paused_supplier pode rejeitar com
          // check_violation (23514) se o fornecedor estiver pausado/inativo.
          // É comportamento esperado — silenciamos e seguimos para os outros.
          const e = err as { code?: string; message?: string };
          const isPausedBlock = e?.code === '23514' || /pausado|inativo/i.test(e?.message || '');
          if (!isPausedBlock) throw err;
        }
      }
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
      isMaterializingRef.current = false;
    }
  }, [visibleDueSubscriptions, visibleActiveContracts, subExpenseMap, contractExpenseMap, m, currentYear, fin, qc]);

  useEffect(() => { autoMaterialize(); }, [autoMaterialize]);

  // VAT calculations (centralised)
  const salesTotals = computeVatForSales(monthSales);
  const expensesTotals = computeVatForExpenses(monthExpenses);
  const vatBalance = computeVatBalance(monthSales, monthExpenses);
  const totalEntradas = salesTotals.totalEntradas;
  const totalBaseEntradas = salesTotals.totalBase;
  const ivaCobrado = salesTotals.ivaCobrado;
  const totalSaidas = expensesTotals.totalSaidas;
  const totalBaseSaidas = expensesTotals.totalBase;
  const ivaPago = expensesTotals.ivaPago;
  const ivaDeduzir = expensesTotals.ivaDeduzir;
  const ivaBalanco = vatBalance.balanco;

  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  const ssExpense = useMemo(() => monthExpenses.find(e => e.category === 'seguranca_social'), [monthExpenses]);

  const { upsertSale } = useCommercialData(currentYear);

  const saveSale = async (saleData: Record<string, unknown>) => {
    try {
      await upsertSale.mutateAsync({
        description: (saleData.description as string) || null,
        product: (saleData.product as string) || null,
        client: (saleData.client as string) || null,
        source: (saleData.source as string) || null,
        base_value: Number(saleData.base_value) || 0,
        invoice_total: Number(saleData.invoice_total) || 0,
        payment_date: (saleData.payment_date as string) || `${currentYear}-${String(m).padStart(2, '0')}-01`,
        status: (saleData.status as string) || 'aguarda_pagamento',
        documents: (saleData.documents as never) || [],
      });
      toast.success('Entrada adicionada');
      setSaleOpen(false);
    } catch {
      toast.error('Erro ao guardar entrada');
    }
  };

  // Bank statements & Meta Ads reports for this month
  const { data: bankStatements = [], refetch: refetchStatements } = useQuery({
    queryKey: ['bank-statements', currentYear, m],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_documents')
        .select('*')
        .eq('doc_type', 'extrato_bancario')
        .eq('period_month', m)
        .eq('period_year', currentYear)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: metaAdsReports = [], refetch: refetchMetaAds } = useQuery({
    queryKey: ['meta-ads-reports', currentYear, m],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_documents')
        .select('*')
        .eq('doc_type', 'meta_ads_report')
        .eq('period_month', m)
        .eq('period_year', currentYear)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const uploadMonthlyDoc = async (file: File, docType: string, titlePrefix: string) => {
    const ext = file.name.split('.').pop();
    const path = `${docType}/${currentYear}/${m}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('financial-files').upload(path, file);
    if (uploadErr) { toast.error('Erro ao carregar ficheiro'); return; }
    const { data: { publicUrl } } = supabase.storage.from('financial-files').getPublicUrl(path);
    await supabase.from('financial_documents').insert({
      title: `${titlePrefix} — ${MONTHS[m - 1]} ${currentYear}`,
      doc_type: docType,
      document_url: publicUrl,
      document_name: file.name,
      period_month: m,
      period_year: currentYear,
      status: 'ativo',
    });
    if (docType === 'extrato_bancario') refetchStatements();
    else refetchMetaAds();
    toast.success('Ficheiro carregado');
  };

  const deleteMonthlyDoc = async (id: string, docType: string) => {
    if (!(await confirmDestructive())) return;
    await supabase.from('financial_documents').delete().eq('id', id);
    if (docType === 'extrato_bancario') refetchStatements();
    else refetchMetaAds();
    toast.success('Ficheiro removido');
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48 bg-secondary text-secondary-foreground border-secondary font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{String(i + 1).padStart(2, '0')} {label}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">{currentYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExportContabilistaButton year={currentYear} month={m} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MonthlyDocUpload
          title="Extrato Bancário"
          icon={<FileUp className="h-4 w-4" />}
          docs={bankStatements}
          docType="extrato_bancario"
          accept=".pdf,.png,.jpg,.jpeg"
          onUpload={(file) => uploadMonthlyDoc(file, 'extrato_bancario', 'Extrato Bancário')}
          onDelete={(id) => deleteMonthlyDoc(id, 'extrato_bancario')}
        />
        <MonthlyDocUpload
          title="Relatório Meta Ads"
          icon={<BarChart3 className="h-4 w-4" />}
          docs={metaAdsReports}
          docType="meta_ads_report"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
          onUpload={(file) => uploadMonthlyDoc(file, 'meta_ads_report', 'Relatório Meta Ads')}
          onDelete={(id) => deleteMonthlyDoc(id, 'meta_ads_report')}
        />
      </div>

      <FiscalChecklistCard month={m} year={currentYear} />
      <FinAlertasMes year={currentYear} month={m} />

      <div id="fin-mensal-report" className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard tone="success" size="sm" value={formatEuro(totalEntradas)} label={<><ArrowDownToLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />entradas</>} />
          <StatCard tone="destructive" size="sm" value={formatEuro(totalSaidas)} label={<><ArrowUpFromLine className="h-3 w-3 inline mr-1.5 -mt-0.5" />saídas</>} />
          <StatCard tone={resultado >= 0 ? 'success' : 'destructive'} size="sm" value={formatEuro(resultado)} label={<><Scale className="h-3 w-3 inline mr-1.5 -mt-0.5" />balanço</>} />
          <StatCard tone={margem >= 0 ? 'gold' : 'destructive'} size="sm" value={`${margem}%`} label={<><Percent className="h-3 w-3 inline mr-1.5 -mt-0.5" />margem</>} />
        </div>

        <EntradasTable
          monthSales={monthSales}
          totalBaseEntradas={totalBaseEntradas}
          totalEntradas={totalEntradas}
          onAddSale={() => setSaleOpen(true)}
          onSelectSale={(s) => { setSelectedSale(s as SelectedSale); setSaleSheetOpen(true); }}
          onShowIvaCobrado={() => setIvaCobradoOpen(true)}
        />

        <SegurancaSocialCard ssExpense={ssExpense} month={m} currentYear={currentYear} fin={fin} />

        <SaidasTable
          monthExpenses={monthExpenses}
          dueSubscriptions={visibleDueSubscriptions}
          subExpenseMap={subExpenseMap}
          activeContracts={visibleActiveContracts}
          contractExpenseMap={contractExpenseMap}
          month={m}
          currentYear={currentYear}
          fin={fin}
          qc={qc}
          totalBaseSaidas={totalBaseSaidas}
          totalSaidas={totalSaidas}
          onAddExpense={() => setExpOpen(true)}
          onSelectExpense={(e) => { setSelectedExpense(e); setExpenseSheetOpen(true); }}
          getCategoryLabel={getCategoryLabel}
          onShowIvaPago={() => setIvaPagoOpen(true)}
        />

        <IvaCobradoDialog
          open={ivaCobradoOpen}
          onOpenChange={setIvaCobradoOpen}
          monthSales={monthSales}
          month={m}
          totalEntradas={totalEntradas}
          totalBaseEntradas={totalBaseEntradas}
          ivaCobrado={ivaCobrado}
        />

        <IvaPagoDialog
          open={ivaPagoOpen}
          onOpenChange={setIvaPagoOpen}
          monthExpenses={monthExpenses}
          month={m}
          totalSaidas={totalSaidas}
          totalBaseSaidas={totalBaseSaidas}
          ivaPago={ivaPago}
          ivaDeduzir={ivaDeduzir}
          ivaBalanco={ivaBalanco}
        />

        <FinancialHealthSection sales={monthSales} allSales={sales} currentYear={currentYear} month={m} />
      </div>

      <SaleFormDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        products={productNames}
        onSave={saveSale}
      />

      <NewExpenseDialog open={expOpen} onOpenChange={setExpOpen} month={m} currentYear={currentYear} fin={fin} />

      <EntryDetailSheet sale={selectedSale as Parameters<typeof EntryDetailSheet>[0]['sale']} open={saleSheetOpen} onOpenChange={setSaleSheetOpen} />
      <ExpenseDetailSheet expense={selectedExpense} open={expenseSheetOpen} onOpenChange={setExpenseSheetOpen} fin={fin} />
    </div>
  );
}