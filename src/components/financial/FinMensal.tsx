import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { FinancialHealthSection } from './FinancialHealthSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Check, Download, FileUp, BarChart3, ExternalLink, Trash2 as TrashIcon, ClipboardCheck, Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';
import type { Expense, RecurringExpense, PayrollEntry, ContractorEntry, FinancialDocument } from '@/hooks/useFinancialData';
import { getSubscriptionOccurrences } from '@/hooks/useFinancialData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceUpload } from './InvoiceUpload';
import { CategorySelect } from './CategorySelect';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { EntryStatusSelect, ExpenseStatusSelect } from './InlineStatusSelect';
import { EntryDetailSheet } from './EntryDetailSheet';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { SaleFormDialog } from '@/components/commercial/SaleFormDialog';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { computeFiscalDeadlines, type FiscalConfig } from '@/lib/fiscalDeadlines';
import { getAutoExpenseStatus } from '@/lib/expenseStatus';
import { ExportContabilistaButton } from './ExportContabilistaButton';
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const VAT_RATES = [0, 6, 13, 23];
const LOCATIONS = ['portugal', 'ue', 'fora_ue'];
const LOC_LABELS: Record<string, string> = { portugal: 'Portugal', ue: 'União Europeia', fora_ue: 'Fora da UE' };

function parseDateString(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getSubscriptionDueDate(subscription: RecurringExpense, month: number, year: number) {
  const startDate = parseDateString(subscription.expense_date);
  const fallbackDay = startDate?.getDate() ?? 15;
  const targetDay = subscription.recurrence_day || fallbackDay;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(targetDay, lastDayOfMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

function canRenderSubscriptionForMonth(subscription: RecurringExpense, month: number, year: number) {
  if (subscription.status === 'cancelado' || !subscription.periodicity) return false;
  if (getSubscriptionOccurrences(subscription.expense_date, subscription.periodicity, month, year) <= 0) return false;

  if (!subscription.recurrence_end_date) return true;

  return getSubscriptionDueDate(subscription, month, year) <= subscription.recurrence_end_date;
}

type Sale = { invoice_total: number; base_value: number; sale_month: number | null; sale_year: number | null; product?: string | null; client?: string | null; description?: string | null; status?: string };

interface Props {
  sales: Sale[];
  expenses: Expense[];
  payrollData: PayrollEntry[];
  contractorsData: ContractorEntry[];
  documents: FinancialDocument[];
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function FinMensal({ sales, expenses, fin, currentYear }: Props) {
  const { getCategoryLabel } = useFinancialCategories();
  const qc = useQueryClient();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth.toString());
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleSheetOpen, setSaleSheetOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [ivaCobradoOpen, setIvaCobradoOpen] = useState(false);
  const [ivaPagoOpen, setIvaPagoOpen] = useState(false);
  const [editingDeductId, setEditingDeductId] = useState<string | null>(null);
  const [editingDeductValue, setEditingDeductValue] = useState<string>('');
  const m = parseInt(month);

  // Active member contracts
  const { data: activeContracts = [] } = useQuery({
    queryKey: ['active-member-contracts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('member_contracts')
        .select('*, team_members(id, full_name, role_title)')
        .in('status', ['ativo'])
        .neq('contract_type', 'contrato_prestacao');
      return data || [];
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
    const da = (a as any).payment_date || '';
    const db = (b as any).payment_date || '';
    return da.localeCompare(db);
  }), [sales, currentYear, m]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.expense_year === currentYear && e.expense_month === m).sort((a, b) => {
    const da = (a as any).expense_date || '';
    const db = (b as any).expense_date || '';
    return da.localeCompare(db);
  }), [expenses, currentYear, m]);

  // Recurring expenses due this month (based on expense_date + periodicity)
  const recurringExps = fin.recurringExpenses.data || [];
  const dueSubscriptions = useMemo(() => {
    return recurringExps.filter(sub => canRenderSubscriptionForMonth(sub, m, currentYear));
  }, [recurringExps, m, currentYear]);

  // Check which subs already have a confirmed expense for this month
  const subExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    monthExpenses.forEach(e => {
      if (e.source_type === 'subscription' && e.source_id) {
        map.set(e.source_id, e);
      }
    });
    return map;
  }, [monthExpenses]);

  // Check which contracts already have a confirmed expense for this month
  const contractExpenseMap = useMemo(() => {
    const map = new Map<string, Expense>();
    monthExpenses.forEach(e => {
      if (e.source_type === 'contract' && e.source_id) {
        map.set(e.source_id, e);
      }
    });
    return map;
  }, [monthExpenses]);

  // Auto-materialize recurring subscription & contract expenses for current/past months
  const autoMaterializeRef = useRef(new Set<string>());
  const isMaterializingRef = useRef(false);
  const autoMaterialize = useCallback(async () => {
    if (isMaterializingRef.current) return;
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    // Only auto-create for current or past months (not future)
    if (currentYear > nowYear || (currentYear === nowYear && m > nowMonth)) return;

    const toCreate: Array<() => Promise<void>> = [];

    // Subscriptions without linked expense — check DB before creating
    for (const sub of dueSubscriptions) {
      const key = `sub-${sub.id}-${m}-${currentYear}`;
      if (subExpenseMap.has(sub.id) || autoMaterializeRef.current.has(key)) continue;
      autoMaterializeRef.current.add(key);

      // Double-check in DB to prevent duplicates
      const { count } = await supabase.from('financial_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'subscription')
        .eq('source_id', sub.id)
        .eq('expense_month', m)
        .eq('expense_year', currentYear);
      if ((count || 0) > 0) continue;

      const subName = sub.expense_name || sub.description || '';
      const dateStr = getSubscriptionDueDate(sub, m, currentYear);
      const status = getAutoExpenseStatus(dateStr);
      toCreate.push(async () => {
        await fin.upsertExpense.mutateAsync({
          description: `${subName} — ${MONTHS[m - 1]} ${currentYear}`,
          category: sub.category || 'outro',
          base_value: sub.base_value,
          vat_rate: sub.vat_rate || 0,
          total_with_vat: sub.total_with_vat,
          location: sub.location,
          expense_date: dateStr,
          expense_month: m,
          expense_quarter: Math.ceil(m / 3),
          expense_year: currentYear,
          status,
          source_type: 'subscription',
          source_id: sub.id,
          parent_expense_id: sub.id,
          supplier_id: sub.supplier_id,
          payment_method: sub.payment_method,
        } as any);
      });
    }

    // Contracts without linked expense — check DB before creating
    for (const contract of activeContracts as any[]) {
      const key = `contract-${contract.id}-${m}-${currentYear}`;
      if (contractExpenseMap.has(contract.id) || autoMaterializeRef.current.has(key)) continue;
      autoMaterializeRef.current.add(key);

      // Double-check in DB to prevent duplicates
      const { count } = await supabase.from('financial_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('source_type', 'contract')
        .eq('source_id', contract.id)
        .eq('expense_month', m)
        .eq('expense_year', currentYear);
      if ((count || 0) > 0) continue;

      const memberName = contract.team_members?.full_name || '—';
      const value = contract.monthly_value || 0;
      const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
      const status = getAutoExpenseStatus(dateStr);
      toCreate.push(async () => {
        await fin.upsertExpense.mutateAsync({
          description: `Pagamento — ${memberName} — ${String(m).padStart(2, '0')}/${currentYear}`,
          category: 'ordenados',
          base_value: value, vat_rate: 0, total_with_vat: value, location: 'portugal',
          expense_date: dateStr, expense_month: m, expense_quarter: Math.ceil(m / 3),
          expense_year: currentYear, status, source_type: 'contract', source_id: contract.id,
        } as any);
      });
    }

    if (toCreate.length > 0) {
      isMaterializingRef.current = true;
      for (const fn of toCreate) await fn();
      qc.invalidateQueries({ queryKey: ['financial-expenses'] });
      isMaterializingRef.current = false;
    }
  }, [dueSubscriptions, activeContracts, subExpenseMap, contractExpenseMap, m, currentYear, fin, qc]);

  useEffect(() => { autoMaterialize(); }, [autoMaterialize]);


  const totalEntradas = monthSales.reduce((s, v) => s + v.invoice_total, 0);
  const totalBaseEntradas = monthSales.reduce((s, v) => s + v.base_value, 0);
  const ivaCobrado = totalEntradas - totalBaseEntradas;

  const totalSaidas = monthExpenses.reduce((s, v) => s + v.total_with_vat, 0);
  const totalBaseSaidas = monthExpenses.reduce((s, v) => s + v.base_value, 0);
  const ivaPago = totalSaidas - totalBaseSaidas;

  // IVA a Deduzir: usa vat_deductible_amount se preenchido, senão assume IVA pago (100%)
  const ivaDeduzir = monthExpenses.reduce((s, e) => {
    const ivaP = Math.max(0, (e.total_with_vat || 0) - (e.base_value || 0));
    const ded = (e as any).vat_deductible_amount;
    return s + (ded != null ? Number(ded) : ivaP);
  }, 0);

  // Balanço IVA = IVA Cobrado − IVA a Deduzir
  const ivaBalanco = Math.round((ivaCobrado - ivaDeduzir) * 100) / 100;

  const resultado = totalEntradas - totalSaidas;
  const margem = totalEntradas > 0 ? Math.round(resultado / totalEntradas * 10000) / 100 : 0;

  // SS value for this month (stored as expense with category 'seguranca_social')
  const ssExpense = useMemo(() => monthExpenses.find(e => e.category === 'seguranca_social'), [monthExpenses]);
  const [ssValue, setSsValue] = useState('');
  const [ssEditing, setSsEditing] = useState(false);
  
  // Sync SS value when month changes
  useMemo(() => {
    setSsValue(ssExpense ? String(ssExpense.total_with_vat) : '');
    setSsEditing(false);
  }, [ssExpense, m]);

  // Sale dialog
  const [saleOpen, setSaleOpen] = useState(false);

  const saveSale = async (saleData: any) => {
    const q = Math.ceil(m / 3);
    const { error } = await supabase.from('commercial_sales').insert({
      sale_id: saleData.sale_id || `V${currentYear}-${String(Date.now()).slice(-4)}`,
      description: saleData.description || null,
      product: saleData.product || null,
      client: saleData.client || null,
      source: saleData.source || null,
      base_value: saleData.base_value || 0,
      invoice_total: saleData.invoice_total || 0,
      payment_date: saleData.payment_date || null,
      status: saleData.status || 'aguarda_pagamento',
      documents: saleData.documents || [],
      sale_month: m,
      sale_quarter: q,
      sale_year: currentYear,
    });
    if (error) { toast.error('Erro ao guardar entrada'); return; }
    toast.success('Entrada adicionada');
    setSaleOpen(false);
    qc.invalidateQueries({ queryKey: ['commercial'] });
  };

  // Expense dialog
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<any>({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal', documents: [], includes_vat: false });

  const saveExpense = async () => {
    if (!expForm.base_value) { toast.error('Valor é obrigatório'); return; }
    const inputValue = parseFloat(expForm.base_value) || 0;
    const vat = parseInt(expForm.vat_rate) || 0;
    let base: number, total: number;
    if (expForm.includes_vat) {
      total = inputValue;
      base = Math.round(inputValue / (1 + vat / 100) * 100) / 100;
    } else {
      base = inputValue;
      total = Math.round(base * (1 + vat / 100) * 100) / 100;
    }
    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;
    await fin.upsertExpense.mutateAsync({
      description: expForm.description || null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_date: dateStr,
      expense_month: m,
      expense_quarter: Math.ceil(m / 3),
      expense_year: currentYear,
      status: 'por_pagar',
    } as any);
    toast.success('Saída adicionada');
    setExpOpen(false);
    setExpForm({ description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal', documents: [], includes_vat: false });
  };

  // Bank statements for this month
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

  // Meta Ads reports for this month
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

      {/* Monthly Documents: Bank Statement + Meta Ads */}
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

      {/* Fiscal Obligations Checklist */}
      <FiscalChecklistCard month={m} year={currentYear} />

      <div id="fin-mensal-report" className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-2xl font-bold text-success">{fmt(totalEntradas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-2xl font-bold text-destructive">{fmt(totalSaidas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Balanço</p><p className={`text-2xl font-bold ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(resultado)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Margem</p><p className={`text-2xl font-bold ${margem >= 0 ? 'text-success' : 'text-destructive'}`}>{margem}%</p></CardContent></Card>
      </div>

      {/* Entradas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Entradas</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSaleOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Entrada</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Data Pgto.</TableHead><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">Fatura Total</TableHead><TableHead>Ficheiros</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthSales.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem entradas</TableCell></TableRow>
              ) : monthSales.map((s: any, i) => {
                const docs = Array.isArray(s.documents) ? s.documents : [];
                return (
                  <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSale(s); setSaleSheetOpen(true); }}>
                    <TableCell onClick={e => e.stopPropagation()}><EntryStatusSelect saleId={s.id} currentStatus={s.status || 'aguarda_pagamento'} paymentDate={s.payment_date} hasDocuments={docs.length > 0} /></TableCell>
                    <TableCell className="whitespace-nowrap">{s.payment_date || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{s.sale_id || '—'}</TableCell>
                    <TableCell>{s.description || '—'}</TableCell>
                    <TableCell>{s.client || '—'}</TableCell>
                    <TableCell className="text-right">{fmt(s.base_value)}</TableCell>
                    <TableCell className="text-right">{fmt(s.invoice_total)}</TableCell>
                    <TableCell>{docs.length > 0 ? <Badge variant="outline" className="text-xs">{docs.length} ficheiro{docs.length > 1 ? 's' : ''}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {monthSales.length > 0 && (
              <tfoot>
                <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell colSpan={5} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{fmt(totalBaseEntradas)}</TableCell>
                  <TableCell className="text-right">{fmt(totalEntradas)}</TableCell>
                  <TableCell />
                </TableRow>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Segurança Social — destaque mensal */}
      <Card className="border-2 border-primary/40 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-bold">SS</span>
                Segurança Social — {MONTHS[m - 1]} {currentYear}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {ssExpense
                  ? 'Valor pago este mês. Clica em editar para alterar.'
                  : 'Insere aqui o valor pago de Segurança Social este mês.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {ssExpense && !ssEditing ? (
                <>
                  <span className="text-2xl font-bold text-primary">{fmt(ssExpense.total_with_vat)}</span>
                  <Button size="sm" variant="outline" onClick={() => setSsEditing(true)}>Editar</Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="h-10 w-32 text-base font-semibold"
                    value={ssValue}
                    onChange={e => setSsValue(e.target.value)}
                    autoFocus={ssEditing}
                  />
                  <span className="text-sm text-muted-foreground">€</span>
                  <Button size="sm" onClick={async () => {
                    const val = parseFloat(ssValue) || 0;
                    if (val <= 0 && !ssExpense) return;
                    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-15`;
                    if (ssExpense) {
                      await fin.upsertExpense.mutateAsync({ id: ssExpense.id, total_with_vat: val, base_value: val, description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}` } as any);
                    } else {
                      await fin.upsertExpense.mutateAsync({
                        description: `Segurança Social — ${MONTHS[m - 1]} ${currentYear}`,
                        category: 'seguranca_social',
                        base_value: val,
                        vat_rate: 0,
                        total_with_vat: val,
                        location: 'portugal',
                        expense_date: dateStr,
                        expense_month: m,
                        expense_quarter: Math.ceil(m / 3),
                        expense_year: currentYear,
                        status: 'pago_falta_fatura',
                      } as any);
                    }
                    setSsEditing(false);
                    toast.success('Segurança Social guardada');
                  }}>
                    <Check className="h-4 w-4 mr-1" /> Guardar
                  </Button>
                  {ssExpense && (
                    <Button size="sm" variant="ghost" onClick={() => { setSsValue(String(ssExpense.total_with_vat)); setSsEditing(false); }}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Saídas */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Saídas</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setExpOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Saída</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Data Pgto.</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Localização</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">IVA %</TableHead><TableHead className="text-right whitespace-nowrap">Total c/ IVA</TableHead></TableRow></TableHeader>
            <TableBody>
              {/* Regular expenses (excluding subscription/contract-linked ones to avoid duplicates) */}
              {monthExpenses.filter(e => e.source_type !== 'subscription' && e.source_type !== 'contract').map(e => (
                <TableRow key={e.id} className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(e.status) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={() => { setSelectedExpense(e); setExpenseSheetOpen(true); }}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <ExpenseStatusSelect
                      expenseId={e.id}
                      currentStatus={e.status}
                      hasDocuments={Array.isArray(e.documents) ? e.documents.length > 0 : !!e.documents}
                      onUpdate={async (id, status) => {
                        await fin.upsertExpense.mutateAsync({ id, status } as any);
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{(e as any).expense_id || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{(e as any).expense_date || '—'}</TableCell>
                  <TableCell>{e.description || '—'}</TableCell>
                  <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                  <TableCell>{LOC_LABELS[(e as any).location] || (e as any).location || '—'}</TableCell>
                  <TableCell className="text-right">{fmt(e.base_value)}</TableCell>
                  <TableCell className="text-right">{(e as any).vat_rate ?? 0}%</TableCell>
                  <TableCell className="text-right">{fmt(e.total_with_vat)}</TableCell>
                </TableRow>
              ))}
              {/* Subscription rows due this month */}
              {dueSubscriptions.map(sub => {
                const linkedExp = subExpenseMap.get(sub.id);
                const isPaid = ['pago_falta_fatura', 'tudo_ok'].includes(linkedExp?.status || '');
                const handleSubClick = async () => {
                  if (linkedExp) {
                    setSelectedExpense(linkedExp);
                    setExpenseSheetOpen(true);
                  } else {
                    if (!canRenderSubscriptionForMonth(sub, m, currentYear)) {
                      toast.error('Esse pagamento já está fora do período do contrato.');
                      return;
                    }

                    // Auto-create the individual expense for this month, then open it
                    const MONTHS_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                    const subName = sub.expense_name || sub.description || '';
                    const dateStr = getSubscriptionDueDate(sub, m, currentYear);
                    const status = getAutoExpenseStatus(dateStr);
                    await fin.upsertExpense.mutateAsync({
                      description: `${subName} — ${MONTHS_LABEL[m - 1]} ${currentYear}`,
                      category: sub.category || 'outro',
                      base_value: sub.base_value,
                      vat_rate: sub.vat_rate || 0,
                      total_with_vat: sub.total_with_vat,
                      location: sub.location,
                      expense_date: dateStr,
                      expense_month: m,
                      expense_quarter: Math.ceil(m / 3),
                      expense_year: currentYear,
                      status,
                      source_type: 'subscription',
                      source_id: sub.id,
                      parent_expense_id: sub.id,
                      supplier_id: sub.supplier_id,
                      payment_method: sub.payment_method,
                    } as any);
                    await qc.invalidateQueries({ queryKey: ['financial-expenses'] });
                    const { data: createdExpense } = await supabase
                      .from('financial_expenses')
                      .select('*')
                      .eq('source_type', 'subscription')
                      .eq('source_id', sub.id)
                      .eq('expense_month', m)
                      .eq('expense_year', currentYear)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (createdExpense) {
                      setSelectedExpense(createdExpense as Expense);
                      setExpenseSheetOpen(true);
                    }
                  }
                };
                return (
                  <SubRow
                    key={`sub-${sub.id}`}
                    sub={sub}
                    linkedExpense={linkedExp}
                    isPaid={isPaid}
                    month={m}
                    currentYear={currentYear}
                    fin={fin}
                    onExpenseClick={handleSubClick}
                    getCategoryLabel={getCategoryLabel}
                  />
                );
              })}
              {/* Contract rows (ordenados) due this month */}
              {activeContracts.map((contract: any) => {
                const linkedExp = contractExpenseMap.get(contract.id);
                const isPaid = ['pago_falta_fatura', 'tudo_ok'].includes(linkedExp?.status || '');
                const handleContractClick = async () => {
                  if (linkedExp) {
                    setSelectedExpense(linkedExp);
                    setExpenseSheetOpen(true);
                  } else {
                    // Auto-create the expense for this contract month
                    const memberName = contract.team_members?.full_name || '—';
                    const value = contract.monthly_value || 0;
                    const dateStr = `${currentYear}-${String(m).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
                    const status = getAutoExpenseStatus(dateStr);
                    await fin.upsertExpense.mutateAsync({
                      description: `Pagamento — ${memberName} — ${String(m).padStart(2, '0')}/${currentYear}`,
                      category: 'ordenados',
                      base_value: value, vat_rate: 0, total_with_vat: value, location: 'portugal',
                      expense_date: dateStr, expense_month: m, expense_quarter: Math.ceil(m / 3),
                      expense_year: currentYear, status, source_type: 'contract', source_id: contract.id,
                    } as any);
                    await qc.invalidateQueries({ queryKey: ['financial-expenses'] });
                    const { data: createdExpense } = await supabase
                      .from('financial_expenses')
                      .select('*')
                      .eq('source_type', 'contract')
                      .eq('source_id', contract.id)
                      .eq('expense_month', m)
                      .eq('expense_year', currentYear)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (createdExpense) {
                      setSelectedExpense(createdExpense as Expense);
                      setExpenseSheetOpen(true);
                    }
                    qc.invalidateQueries({ queryKey: ['my-payments'] });
                  }
                };
                return (
                  <ContractRow
                    key={`contract-${contract.id}`}
                    contract={contract}
                    linkedExpense={linkedExp}
                    isPaid={isPaid}
                    month={m}
                    currentYear={currentYear}
                    fin={fin}
                    qc={qc}
                    onExpenseClick={handleContractClick}
                  />
                );
              })}
              {monthExpenses.filter(e => e.source_type !== 'subscription' && e.source_type !== 'contract').length === 0 && dueSubscriptions.length === 0 && activeContracts.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem saídas</TableCell></TableRow>
              )}
            </TableBody>
            {(monthExpenses.length > 0 || dueSubscriptions.length > 0 || activeContracts.length > 0) && (
              <tfoot>
                <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell colSpan={6} className="text-right">Total</TableCell>
                  <TableCell className="text-right">{fmt(totalBaseSaidas)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{fmt(totalSaidas)}</TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* IVA Cobrado Detail */}
      <Dialog open={ivaCobradoOpen} onOpenChange={setIvaCobradoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-base">IVA Cobrado — {MONTHS[m - 1]}</DialogTitle></DialogHeader>
          {monthSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem vendas registadas neste mês.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Venda</TableHead><TableHead className="text-right">Total Fatura</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">IVA</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthSales.map((s, idx) => {
                  const iva = Math.round((s.invoice_total - s.base_value) * 100) / 100;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{s.client || s.product || `Venda ${idx + 1}`}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.invoice_total)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(s.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(iva)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(totalEntradas)}</TableCell>
                  <TableCell className="text-right">{fmt(totalBaseEntradas)}</TableCell>
                  <TableCell className="text-right">{fmt(ivaCobrado)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* IVA Pago Detail */}
      <Dialog open={ivaPagoOpen} onOpenChange={setIvaPagoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-base">IVA Pago / Dedutível — {MONTHS[m - 1]}</DialogTitle></DialogHeader>
          {monthExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sem despesas registadas neste mês.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Despesa</TableHead><TableHead className="text-right">Total c/ IVA</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">IVA Pago</TableHead><TableHead className="text-right">IVA a Deduzir</TableHead></TableRow></TableHeader>
              <TableBody>
                {monthExpenses.map((e, idx) => {
                  const iva = Math.round((e.total_with_vat - e.base_value) * 100) / 100;
                  const ded = (e as any).vat_deductible_amount;
                  const dedDisplay = ded != null ? Number(ded) : iva;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-sm">{e.description || `Despesa ${idx + 1}`}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(e.total_with_vat)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(e.base_value)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(iva)}</TableCell>
                      <TableCell className="text-right text-sm" onClick={ev => ev.stopPropagation()}>
                        {editingDeductId === e.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            autoFocus
                            value={editingDeductValue}
                            onChange={ev => setEditingDeductValue(ev.target.value)}
                            onBlur={async () => {
                              const parsed = editingDeductValue === '' ? null : parseFloat(editingDeductValue);
                              const finalValue = parsed === null || isNaN(parsed) ? null : Math.max(0, Math.min(parsed, iva));
                              const { error } = await supabase
                                .from('financial_expenses')
                                .update({ vat_deductible_amount: finalValue } as any)
                                .eq('id', e.id);
                              if (error) toast.error('Erro ao guardar');
                              else {
                                toast.success('IVA dedutível atualizado');
                                qc.invalidateQueries({ queryKey: ['financial-expenses'] });
                              }
                              setEditingDeductId(null);
                            }}
                            onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); if (ev.key === 'Escape') setEditingDeductId(null); }}
                            className="h-7 w-24 text-right text-xs ml-auto"
                          />
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-primary group"
                            onClick={() => {
                              setEditingDeductValue(ded != null ? String(ded) : iva.toFixed(2));
                              setEditingDeductId(e.id);
                            }}
                          >
                            <span className={ded != null ? 'font-medium text-primary' : 'text-muted-foreground'}>
                              {fmt(dedDisplay)}
                            </span>
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{fmt(totalSaidas)}</TableCell>
                  <TableCell className="text-right">{fmt(totalBaseSaidas)}</TableCell>
                  <TableCell className="text-right">{fmt(ivaPago)}</TableCell>
                  <TableCell className="text-right">{fmt(ivaDeduzir)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={4} className="text-sm font-medium">Balanço IVA (Cobrado − Deduzir)</TableCell>
                  <TableCell className={cn("text-right font-semibold", ivaBalanco >= 0 ? 'text-destructive' : 'text-success')}>{fmt(ivaBalanco)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>


      {/* Saúde Financeira */}
      <FinancialHealthSection sales={monthSales} allSales={sales} currentYear={currentYear} month={m} />

      </div>

      <SaleFormDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        products={productNames}
        onSave={saveSale}
      />

      {/* New Expense Dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Saída — {MONTHS[m - 1]} {currentYear}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={expForm.description} onChange={e => setExpForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Categoria</Label>
              <CategorySelect type="expense" value={expForm.category} onValueChange={v => setExpForm((f: any) => ({ ...f, category: v }))} />
            </div>
            <div className="flex items-center gap-2 py-1">
              <Switch checked={expForm.includes_vat || false} onCheckedChange={v => setExpForm((f: any) => ({ ...f, includes_vat: v }))} />
              <Label className="text-sm font-normal">Valor inclui IVA</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{expForm.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label><Input type="number" value={expForm.base_value} onChange={e => setExpForm((f: any) => ({ ...f, base_value: e.target.value }))} /></div>
              <div><Label>IVA (%)</Label>
                <Select value={expForm.vat_rate} onValueChange={v => setExpForm((f: any) => ({ ...f, vat_rate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {expForm.base_value && parseFloat(expForm.base_value) > 0 && parseInt(expForm.vat_rate) > 0 && (
              <p className="text-xs text-muted-foreground">
                {expForm.includes_vat
                  ? `Base: ${(parseFloat(expForm.base_value) / (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) - parseFloat(expForm.base_value) / (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} €`
                  : `Total c/ IVA: ${(parseFloat(expForm.base_value) * (1 + parseInt(expForm.vat_rate) / 100)).toFixed(2)} € · IVA: ${(parseFloat(expForm.base_value) * parseInt(expForm.vat_rate) / 100).toFixed(2)} €`
                }
              </p>
            )}
            <div><Label>Localização</Label>
              <Select value={expForm.location} onValueChange={v => setExpForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{LOC_LABELS[l]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <InvoiceUpload
              documents={Array.isArray(expForm.documents) ? expForm.documents : []}
              onChange={docs => setExpForm((f: any) => ({ ...f, documents: docs }))}
            />
            <Button className="w-full" onClick={saveExpense}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <EntryDetailSheet sale={selectedSale} open={saleSheetOpen} onOpenChange={setSaleSheetOpen} />
      <ExpenseDetailSheet expense={selectedExpense} open={expenseSheetOpen} onOpenChange={setExpenseSheetOpen} fin={fin} />
    </div>
  );
}

function SubRow({ sub, linkedExpense, isPaid, month, currentYear, fin, onExpenseClick, getCategoryLabel }: {
  sub: RecurringExpense;
  linkedExpense: Expense | undefined;
  isPaid: boolean;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
  onExpenseClick?: () => void;
  getCategoryLabel: (type: string, value: string) => string;
}) {
  const MONTHS_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const LOC_LABELS: Record<string, string> = { portugal: 'Portugal', ue: 'União Europeia', fora_ue: 'Fora da UE' };
  const [confirming, setConfirming] = useState(false);

  const vatRate = sub.vat_rate || 0;
  const displayBase = linkedExpense ? linkedExpense.base_value : sub.base_value;
  const displayTotal = linkedExpense ? linkedExpense.total_with_vat : sub.total_with_vat;
  const projectedExpenseDate = getSubscriptionDueDate(sub, month, currentYear);

  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const isCurrentMonth = month === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const defaultStatus = isCurrentMonth ? 'pendente' : 'por_pagar';
  const currentStatus = linkedExpense?.status || defaultStatus;
  const subName = sub.expense_name || sub.description || '';
  const expenseId = linkedExpense ? (linkedExpense as any).expense_id || 'A gerar' : 'A gerar';
  const category = linkedExpense?.category || sub.category || 'outro';
  const expenseDate = linkedExpense ? (linkedExpense as any).expense_date || '—' : projectedExpenseDate;

  const handleStatusChange = async (_id: string, newStatus: string) => {
    setConfirming(true);
    const dateStr = projectedExpenseDate;
    if (linkedExpense) {
      await fin.upsertExpense.mutateAsync({ id: linkedExpense.id, status: newStatus } as any);
    } else {
      if (!canRenderSubscriptionForMonth(sub, month, currentYear)) {
        setConfirming(false);
        toast.error('Esse pagamento já está fora do período do contrato.');
        return;
      }

      await fin.upsertExpense.mutateAsync({
        description: `${subName} — ${MONTHS_LABEL[month - 1]} ${currentYear}`,
        category: sub.category || 'plataformas', base_value: sub.base_value, vat_rate: vatRate, total_with_vat: sub.total_with_vat,
        location: sub.location, expense_date: dateStr, expense_month: month,
        expense_quarter: Math.ceil(month / 3), expense_year: currentYear,
        status: newStatus, source_type: 'subscription', source_id: sub.id,
        parent_expense_id: sub.id,
        supplier_id: sub.supplier_id,
        payment_method: sub.payment_method,
      } as any);
    }
    setConfirming(false);
  };

  return (
    <TableRow className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(currentStatus) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={onExpenseClick}>
      <TableCell onClick={e => e.stopPropagation()}>
        <ExpenseStatusSelect expenseId={linkedExpense?.id || `sub-${sub.id}`} currentStatus={currentStatus} onUpdate={handleStatusChange} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{expenseId}</TableCell>
      <TableCell className="whitespace-nowrap">{expenseDate}</TableCell>
      <TableCell>{linkedExpense?.description || subName}</TableCell>
      <TableCell>{getCategoryLabel('expense', category)}</TableCell>
      <TableCell>{LOC_LABELS[linkedExpense ? ((linkedExpense as any).location || sub.location) : sub.location] || sub.location || '—'}</TableCell>
      <TableCell className="text-right">{fmt(displayBase)}</TableCell>
      <TableCell className="text-right">{vatRate}%</TableCell>
      <TableCell className="text-right">{fmt(displayTotal)}</TableCell>
    </TableRow>
  );
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  contrato_trabalho: 'Colaborador',
  contrato_prestacao: 'Prestador',
  prestacao_servicos: 'Prestador',
  acordo: 'Acordo',
  outro: 'Ordenado',
};

function ContractRow({ contract, linkedExpense, isPaid, month, currentYear, fin, qc, onExpenseClick }: {
  contract: any;
  linkedExpense: Expense | undefined;
  isPaid: boolean;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
  qc: ReturnType<typeof useQueryClient>;
  onExpenseClick?: () => void;
}) {
  const MONTHS_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const [confirming, setConfirming] = useState(false);
  const memberName = contract.team_members?.full_name || '—';
  const value = contract.monthly_value || 0;
  const contractType = contract.contract_type || 'outro';
  const typeLabel = CONTRACT_TYPE_LABELS[contractType] || contractType;


  const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const isCurrentMonth = month === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const defaultStatus = isCurrentMonth ? 'pendente' : 'por_pagar';
  const currentStatus = linkedExpense?.status || defaultStatus;

  const handleStatusChange = async (_id: string, newStatus: string) => {
    setConfirming(true);
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
    if (linkedExpense) {
      await fin.upsertExpense.mutateAsync({ id: linkedExpense.id, status: newStatus } as any);
      await supabase.from('member_payments').update({ status: newStatus }).eq('member_id', contract.member_id).eq('month', month).eq('year', currentYear).eq('payment_type', contractType);
    } else {
      await fin.upsertExpense.mutateAsync({
        description: `${memberName} — ${MONTHS_LABEL[month - 1]} ${currentYear}`,
        category: (contractType === 'contrato_trabalho' || contractType === 'outro') ? 'ordenados' : 'prestadores',
        base_value: value, vat_rate: 0, total_with_vat: value, location: 'portugal',
        expense_date: dateStr, expense_month: month, expense_quarter: Math.ceil(month / 3),
        expense_year: currentYear, status: newStatus, source_type: 'contract', source_id: contract.id,
      } as any);
      await supabase.from('member_payments').insert({
        member_id: contract.member_id, month, year: currentYear,
        gross_value: value, net_value: value, payment_type: contractType, status: newStatus,
      });
    }
    qc.invalidateQueries({ queryKey: ['my-payments'] });
    setConfirming(false);
  };

  const expenseId = linkedExpense ? (linkedExpense as any).expense_id || 'A gerar' : 'A gerar';
  const description = linkedExpense?.description || `Pagamento — ${memberName} — ${String(month).padStart(2, '0')}/${currentYear}`;
  const categoryLabel = contractType === 'contrato_prestacao' || contractType === 'prestacao_servicos' ? 'Prestadores' : 'Ordenados';
  const location = linkedExpense ? (LOC_LABELS[(linkedExpense as any).location] || (linkedExpense as any).location || 'Portugal') : 'Portugal';
  const baseValue = linkedExpense?.base_value ?? value;
  const vatRate = (linkedExpense as any)?.vat_rate ?? 0;
  const totalWithVat = linkedExpense?.total_with_vat ?? value;
  const expenseDate = linkedExpense ? (linkedExpense as any).expense_date || '—' : `${currentYear}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;

  return (
    <TableRow className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(currentStatus) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={onExpenseClick}>
      <TableCell onClick={e => e.stopPropagation()}>
        <ExpenseStatusSelect expenseId={linkedExpense?.id || `contract-${contract.id}`} currentStatus={currentStatus} onUpdate={handleStatusChange} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{expenseId}</TableCell>
      <TableCell className="whitespace-nowrap">{expenseDate}</TableCell>
      <TableCell>{description}</TableCell>
      <TableCell>{categoryLabel}</TableCell>
      <TableCell>{location}</TableCell>
      <TableCell className="text-right">{fmt(baseValue)}</TableCell>
      <TableCell className="text-right">{vatRate}%</TableCell>
      <TableCell className="text-right">{fmt(totalWithVat)}</TableCell>
    </TableRow>
  );
}

function MonthlyDocUpload({ title, icon, docs, docType, accept, onUpload, onDelete }: {
  title: string;
  icon: React.ReactNode;
  docs: any[];
  docType: string;
  accept: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            <span>{title}</span>
          </div>
          <div>
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5 mr-1" />
              {uploading ? 'A carregar...' : 'Upload'}
            </Button>
          </div>
        </div>
        {docs.length > 0 ? (
          <div className="space-y-1.5">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-2 text-sm rounded-md bg-muted/50 px-3 py-1.5">
                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-1 min-w-0 hover:underline text-foreground">
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.document_name || doc.title}</span>
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onDelete(doc.id)}>
                  <TrashIcon className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum ficheiro carregado para este mês.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Fiscal Obligations Checklist ──
function FiscalChecklistCard({ month, year }: { month: number; year: number }) {
  const { settings } = useBusinessSettings();
  const qc = useQueryClient();
  const s = settings as any;

  const fiscalConfig: FiscalConfig = {
    taxIvaRegime: s?.tax_iva_regime || 'trimestral',
    taxIrsRegime: s?.tax_irs_regime || 'simplificado',
    ssExempt: s?.ss_exempt ?? false,
    ivaExempt: s?.iva_exempt ?? false,
    ivaExemptionEndDate: s?.iva_exemption_end_date || null,
    ssExemptionEndDate: s?.ss_exemption_end_date || null,
    hasAccountant: s?.has_accountant ?? false,
  };

  const isContabOrganizada = fiscalConfig.taxIrsRegime === 'contabilidade_organizada';

  // Determine which checks are applicable this month
  const checkItems = useMemo(() => {
    const items: { key: string; label: string }[] = [];

    const monthDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const isAfterIvaEnd = !fiscalConfig.ivaExemptionEndDate || monthDateStr >= fiscalConfig.ivaExemptionEndDate;
    const isAfterSsEnd = !fiscalConfig.ssExemptionEndDate || monthDateStr >= fiscalConfig.ssExemptionEndDate;

    // SS — payment until day 20 of next month (checklist shown in payment month)
    if (!fiscalConfig.ssExempt && isAfterSsEnd) {
      const refMonth = month === 1 ? 12 : month - 1;
      const refYear = month === 1 ? year - 1 : year;
      items.push({ key: 'ss_payment', label: `SS Pagamento — ${MONTHS[refMonth - 1]} ${refYear} (até dia 20)` });
    }

    // IVA trimestral — declaration (dia 20) & payment (dia 25)
    if (!fiscalConfig.ivaExempt && fiscalConfig.taxIvaRegime === 'trimestral' && isAfterIvaEnd) {
      const qMonths: Record<number, string> = { 2: `4º Trim ${year - 1}`, 5: `1º Trim ${year}`, 8: `2º Trim ${year}`, 11: `3º Trim ${year}` };
      if (qMonths[month]) {
        items.push({ key: `iva_decl_q_${month}`, label: `IVA Declaração — ${qMonths[month]} (até dia 20)` });
        items.push({ key: `iva_pay_q_${month}`, label: `IVA Pagamento — ${qMonths[month]} (até dia 25)` });
      }
    }

    // IVA mensal — declaration (dia 20) & payment (dia 25)
    if (!fiscalConfig.ivaExempt && fiscalConfig.taxIvaRegime === 'mensal' && isAfterIvaEnd) {
      const refMonth = month <= 2 ? 10 + month : month - 2;
      const refYear = month <= 2 ? year - 1 : year;
      items.push({ key: 'iva_decl_m', label: `IVA Declaração — ${MONTHS[refMonth - 1]} ${refYear} (até dia 20)` });
      items.push({ key: 'iva_pay_m', label: `IVA Pagamento — ${MONTHS[refMonth - 1]} ${refYear} (até dia 25)` });
    }

    // Bank statement upload check
    items.push({ key: 'bank_statement', label: 'Extrato bancário carregado' });

    return items;
  }, [month, year, fiscalConfig]);

  // Map a Mensal check key to the corresponding deadline_key used by FinContabilidade.
  // Returns null when the key is not mirrored (IRS handled separately, bank_statement is local).
  const toDeadlineKey = (key: string): string | null => {
    if (key === 'ss_payment') {
      const refMonth = month === 1 ? 12 : month - 1;
      const refYear = month === 1 ? year - 1 : year;
      return `ss-${refYear}-${refMonth}`;
    }
    if (key.startsWith('iva_decl_q_') || key.startsWith('iva_pay_q_')) {
      const isPay = key.startsWith('iva_pay_q_');
      // month → quarter mapping used by computeFiscalDeadlines
      // Feb=Q4 prev year, May=Q1, Aug=Q2, Nov=Q3
      const map: Record<number, { q: number; y: number }> = {
        2: { q: 4, y: year - 1 },
        5: { q: 1, y: year },
        8: { q: 2, y: year },
        11: { q: 3, y: year },
      };
      const m = map[month];
      if (!m) return null;
      return `iva-${isPay ? 'pay' : 'decl'}-q${m.q}-${m.y}`;
    }
    if (key === 'iva_decl_m' || key === 'iva_pay_m') {
      const isPay = key === 'iva_pay_m';
      const refMonth = month <= 2 ? 10 + month : month - 2;
      const refYear = month <= 2 ? year - 1 : year;
      return `iva-${isPay ? 'pay' : 'decl'}-m${refMonth}-${refYear}`;
    }
    return null;
  };

  // Load saved checks for this month (local-only keys: bank_statement, legacy IRS, etc.)
  const { data: checks = [] } = useQuery({
    queryKey: ['fiscal-checks', year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from('fiscal_monthly_checks')
        .select('*')
        .eq('year', year)
        .eq('month', month);
      return data || [];
    },
  });

  // SS/IVA completions live in fiscal_deadline_completions (shared with Contabilidade).
  const { data: deadlineCompletions = [] } = useQuery({
    queryKey: ['fiscal-deadline-completions', year],
    queryFn: async () => {
      const { data } = await supabase
        .from('fiscal_deadline_completions' as any)
        .select('*')
        .eq('year', year);
      return (data || []) as any[];
    },
  });
  const completedDeadlineKeys = useMemo(
    () => new Set(deadlineCompletions.map((c: any) => c.deadline_key)),
    [deadlineCompletions],
  );

  const checkedMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    checks.forEach((c: any) => { map[c.check_key] = c.checked; });
    // Layer in SS/IVA from fiscal_deadline_completions
    checkItems.forEach(item => {
      const dk = toDeadlineKey(item.key);
      if (dk && completedDeadlineKeys.has(dk)) map[item.key] = true;
    });
    return map;
  }, [checks, checkItems, completedDeadlineKeys, month, year]);

  const toggleCheck = useMutation({
    mutationFn: async ({ key, checked }: { key: string; checked: boolean }) => {
      // SS / IVA → mirror into fiscal_deadline_completions (shared with Contabilidade)
      const deadlineKey = toDeadlineKey(key);
      if (deadlineKey) {
        const existing = deadlineCompletions.find((c: any) => c.deadline_key === deadlineKey);
        if (checked && !existing) {
          await supabase
            .from('fiscal_deadline_completions' as any)
            .insert({ deadline_key: deadlineKey, year, completed_by: (await supabase.auth.getUser()).data.user?.id });
        } else if (!checked && existing) {
          await supabase.from('fiscal_deadline_completions' as any).delete().eq('id', existing.id);
        }
        return;
      }
      // Local-only checks (e.g. bank_statement)
      const existing = checks.find((c: any) => c.check_key === key);
      if (existing) {
        await supabase.from('fiscal_monthly_checks').update({ checked, checked_at: checked ? new Date().toISOString() : null }).eq('id', (existing as any).id);
      } else {
        await supabase.from('fiscal_monthly_checks').insert({ year, month, check_key: key, checked, checked_at: checked ? new Date().toISOString() : null });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-checks', year, month] });
      qc.invalidateQueries({ queryKey: ['fiscal-deadline-completions', year] });
    },
  });

  const visibleCheckItems = checkItems;

  if (visibleCheckItems.length === 0) return null;

  const doneCount = visibleCheckItems.filter(i => checkedMap[i.key]).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Obrigações Fiscais — {MONTHS[month - 1]}
          <Badge variant="secondary" className="ml-auto text-xs">{doneCount}/{visibleCheckItems.length}</Badge>
        </CardTitle>
        {isContabOrganizada && (
          <p className="text-xs text-muted-foreground">O teu contabilista trata destas obrigações — usa esta checklist como guia.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleCheckItems.map(item => (
          <label key={item.key} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer">
            <Checkbox
              checked={checkedMap[item.key] || false}
              onCheckedChange={(v) => toggleCheck.mutate({ key: item.key, checked: !!v })}
            />
            <span className={cn('text-sm', checkedMap[item.key] && 'line-through text-muted-foreground')}>{item.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
