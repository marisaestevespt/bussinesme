import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Check, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { validateExpensePaymentMethod } from '@/lib/formValidation';
import type { useFinancialData, Expense, RecurringExpense } from '@/hooks/useFinancialData';
import type { TablesInsert } from '@/integrations/supabase/types';
import type { useQueryClient } from '@tanstack/react-query';
import { ExpenseStatusSelect } from '../InlineStatusSelect';
import { CategorySelect } from '../CategorySelect';
import { InvoiceUpload, type DocEntry } from '../InvoiceUpload';
import { VatDeductibleCell } from '../VatDeductibleCell';
import { formatEuro } from '@/lib/formatting';
import { locationLabel, EXPENSE_LOCATIONS } from '@/lib/labelMaps';
import { getAutoExpenseStatus } from '@/lib/expenseStatus';
import { supabase } from '@/integrations/supabase/client';
import { SubRow, ContractRow } from './SubRows';
import { MONTHS, VAT_RATES, canRenderSubscriptionForMonth, getSubscriptionDueDate } from './helpers';
import { buildSubscriptionExpense, buildContractExpense, type ContractLike } from './expenseBuilders';
import { VatPreview } from '../VatPreview';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { useBusinessSetupPaymentMethods } from '@/hooks/useBusinessSetup';
import { buildPaymentMethodOptions } from '@/lib/paymentMethods';

const LOCATIONS = EXPENSE_LOCATIONS.map(l => l.value);

export function SegurancaSocialCard({ ssExpense, month, currentYear, fin }: {
  ssExpense: Expense | undefined;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}) {
  const [ssValue, setSsValue] = useState('');
  const [ssEditing, setSsEditing] = useState(false);

  useEffect(() => {
    setSsValue(ssExpense ? String(ssExpense.total_with_vat) : '');
    setSsEditing(false);
  }, [ssExpense, month]);

  return (
    <Card className="border-2 border-primary/40 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-bold">SS</span>
              Segurança Social — {MONTHS[month - 1]} {currentYear}
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
                <span className="text-2xl font-bold text-primary">{formatEuro(ssExpense.total_with_vat)}</span>
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
                  const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;
                  if (ssExpense) {
                    await fin.upsertExpense.mutateAsync({ id: ssExpense.id, total_with_vat: val, base_value: val, description: `Segurança Social — ${MONTHS[month - 1]} ${currentYear}` });
                  } else {
                    await fin.upsertExpense.mutateAsync({
                      description: `Segurança Social — ${MONTHS[month - 1]} ${currentYear}`,
                      category: 'seguranca_social',
                      base_value: val,
                      vat_rate: 0,
                      total_with_vat: val,
                      location: 'portugal',
                      expense_date: dateStr,
                      expense_month: month,
                      expense_quarter: Math.ceil(month / 3),
                      expense_year: currentYear,
                      status: 'pago_falta_fatura',
                    });
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
  );
}

interface SaidasTableProps {
  monthExpenses: Expense[];
  dueSubscriptions: RecurringExpense[];
  subExpenseMap: Map<string, Expense>;
  activeContracts: ContractLike[];
  contractExpenseMap: Map<string, Expense>;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
  qc: ReturnType<typeof useQueryClient>;
  totalBaseSaidas: number;
  totalSaidas: number;
  onAddExpense: () => void;
  onSelectExpense: (e: Expense) => void;
  getCategoryLabel: (type: string, value: string) => string;
  onShowIvaPago?: () => void;
}

export function SaidasTable({
  monthExpenses, dueSubscriptions, subExpenseMap, activeContracts, contractExpenseMap,
  month, currentYear, fin, qc, totalBaseSaidas, totalSaidas,
  onAddExpense, onSelectExpense, getCategoryLabel, onShowIvaPago,
}: SaidasTableProps) {
  const handleSubClick = async (sub: RecurringExpense) => {
    const linkedExp = subExpenseMap.get(sub.id);
    if (linkedExp) {
      onSelectExpense(linkedExp);
      return;
    }
    if (!canRenderSubscriptionForMonth(sub, month, currentYear)) {
      toast.error('Esse pagamento já está fora do período do contrato.');
      return;
    }
    const status = getAutoExpenseStatus(getSubscriptionDueDate(sub, month, currentYear));
    await fin.upsertExpense.mutateAsync(buildSubscriptionExpense(sub, month, currentYear, status));
    await qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    const { data: createdExpense } = await supabase
      .from('financial_expenses')
      .select('*')
      .eq('source_type', 'subscription')
      .eq('source_id', sub.id)
      .eq('expense_month', month)
      .eq('expense_year', currentYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (createdExpense) onSelectExpense(createdExpense as Expense);
  };

  const handleContractClick = async (contract: ContractLike) => {
    const linkedExp = contractExpenseMap.get(contract.id);
    if (linkedExp) {
      onSelectExpense(linkedExp);
      return;
    }
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(contract.payment_day || 15).padStart(2, '0')}`;
    const status = getAutoExpenseStatus(dateStr);
    await fin.upsertExpense.mutateAsync(buildContractExpense(contract, month, currentYear, status));
    await qc.invalidateQueries({ queryKey: ['financial-expenses'] });
    const { data: createdExpense } = await supabase
      .from('financial_expenses')
      .select('*')
      .eq('source_type', 'contract')
      .eq('source_id', contract.id)
      .eq('expense_month', month)
      .eq('expense_year', currentYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (createdExpense) onSelectExpense(createdExpense as Expense);
    qc.invalidateQueries({ queryKey: ['my-payments'] });
  };

  // IDs das regras (subscriptions/contracts) que estão a ser renderizadas como linhas próprias
  const renderedSubIds = new Set(dueSubscriptions.map(s => s.id));
  const renderedContractIds = new Set(activeContracts.map(c => c.id));

  // Despesas regulares = tudo o que não é subscription/contract,
  // MAIS despesas materializadas cuja regra-mãe já não está a ser renderizada
  // (ex: fornecedor pausado depois da despesa ter sido criada). Sem isto, ficavam invisíveis.
  const regularExpenses = monthExpenses.filter(e => {
    if (e.source_type !== 'subscription' && e.source_type !== 'contract') return true;
    const parentId = e.source_id || e.parent_expense_id;
    if (!parentId) return true;
    if (e.source_type === 'subscription') return !renderedSubIds.has(parentId);
    if (e.source_type === 'contract') return !renderedContractIds.has(parentId);
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Saídas</CardTitle>
        <div className="flex items-center gap-2">
          {onShowIvaPago && (
            <Button size="sm" variant="outline" onClick={onShowIvaPago}><Receipt className="h-3.5 w-3.5 mr-1" /> Ver IVA</Button>
          )}
          <Button size="sm" variant="outline" onClick={onAddExpense}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Saída</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="whitespace-nowrap">ID</TableHead><TableHead>Data Pgto.</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Localização</TableHead><TableHead className="text-right whitespace-nowrap">Base (€)</TableHead><TableHead className="text-right whitespace-nowrap">IVA %</TableHead><TableHead className="text-right whitespace-nowrap">Total c/ IVA</TableHead><TableHead className="text-right whitespace-nowrap">IVA a Deduzir</TableHead></TableRow></TableHeader>
          <TableBody>
            {regularExpenses.map(e => (
              <TableRow key={e.id} className={cn(!['pago_falta_fatura', 'tudo_ok'].includes(e.status) ? 'bg-muted/30' : '', 'cursor-pointer hover:bg-muted/50')} onClick={() => onSelectExpense(e)}>
                <TableCell onClick={ev => ev.stopPropagation()}>
                  <ExpenseStatusSelect
                    expenseId={e.id}
                    currentStatus={e.status}
                    hasDocuments={Array.isArray(e.documents) ? e.documents.length > 0 : !!e.documents}
                    onUpdate={async (id, status) => {
                      await fin.upsertExpense.mutateAsync({ id, status });
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{e.expense_id || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{e.expense_date || '—'}</TableCell>
                <TableCell>{e.description || '—'}</TableCell>
                <TableCell>{getCategoryLabel('expense', e.category)}</TableCell>
                <TableCell>{locationLabel(e.location)}</TableCell>
                <TableCell className="text-right">{formatEuro(e.base_value)}</TableCell>
                <TableCell className="text-right">{e.vat_rate ?? 0}%</TableCell>
                <TableCell className="text-right">{formatEuro(e.total_with_vat)}</TableCell>
                <TableCell className="text-right" onClick={ev => ev.stopPropagation()}>
                  <VatDeductibleCell expense={e} />
                </TableCell>
              </TableRow>
            ))}
            {dueSubscriptions.map(sub => (
              <SubRow
                key={`sub-${sub.id}`}
                sub={sub}
                linkedExpense={subExpenseMap.get(sub.id)}
                month={month}
                currentYear={currentYear}
                fin={fin}
                onExpenseClick={() => handleSubClick(sub)}
                getCategoryLabel={getCategoryLabel}
              />
            ))}
            {activeContracts.map((contract) => (
              <ContractRow
                key={`contract-${contract.id}`}
                contract={contract}
                linkedExpense={contractExpenseMap.get(contract.id)}
                month={month}
                currentYear={currentYear}
                fin={fin}
                qc={qc}
                onExpenseClick={() => handleContractClick(contract)}
              />
            ))}
            {regularExpenses.length === 0 && dueSubscriptions.length === 0 && activeContracts.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem saídas</TableCell></TableRow>
            )}
          </TableBody>
          {(monthExpenses.length > 0 || dueSubscriptions.length > 0 || activeContracts.length > 0) && (
            <tfoot>
              <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
                <TableCell colSpan={6} className="text-right">Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalBaseSaidas)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatEuro(totalSaidas)}</TableCell>
              </TableRow>
            </tfoot>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

export function IvaPagoDialog({ open, onOpenChange, monthExpenses, month, totalSaidas, totalBaseSaidas, ivaPago, ivaDeduzir, ivaBalanco }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  monthExpenses: Expense[];
  month: number;
  totalSaidas: number;
  totalBaseSaidas: number;
  ivaPago: number;
  ivaDeduzir: number;
  ivaBalanco: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="text-base">IVA Pago / Dedutível — {MONTHS[month - 1]}</DialogTitle></DialogHeader>
        {monthExpenses.length === 0 ? (
          <EmptyHint>Sem despesas registadas neste mês.</EmptyHint>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Despesa</TableHead><TableHead className="text-right">Total c/ IVA</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">IVA Pago</TableHead><TableHead className="text-right">IVA a Deduzir</TableHead></TableRow></TableHeader>
            <TableBody>
              {monthExpenses.map((e, idx) => {
                const iva = Math.round((e.total_with_vat - e.base_value) * 100) / 100;
                return (
                  <TableRow key={idx}>
                    <TableCell className="text-sm">{e.description || `Despesa ${idx + 1}`}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(e.total_with_vat)}</TableCell>
                    <TableCell className="text-right text-sm">{formatEuro(e.base_value)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatEuro(iva)}</TableCell>
                    <TableCell className="text-right text-sm" onClick={ev => ev.stopPropagation()}>
                      <VatDeductibleCell expense={e} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatEuro(totalSaidas)}</TableCell>
                <TableCell className="text-right">{formatEuro(totalBaseSaidas)}</TableCell>
                <TableCell className="text-right">{formatEuro(ivaPago)}</TableCell>
                <TableCell className="text-right">{formatEuro(ivaDeduzir)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={4} className="text-sm font-medium">Balanço IVA (Cobrado − Deduzir)</TableCell>
                <TableCell className={cn('text-right font-semibold', ivaBalanco >= 0 ? 'text-destructive' : 'text-success')}>{formatEuro(ivaBalanco)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface NewExpenseDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: number;
  currentYear: number;
  fin: ReturnType<typeof useFinancialData>;
}

interface NewExpenseFormState {
  description: string;
  category: string;
  base_value: string;
  vat_rate: string;
  location: string;
  documents: DocEntry[];
  includes_vat: boolean;
  payment_method: string;
}

export function NewExpenseDialog({ open, onOpenChange, month, currentYear, fin }: NewExpenseDialogProps) {
  const initial: NewExpenseFormState = { description: '', category: 'outro', base_value: '', vat_rate: '23', location: 'portugal', documents: [], includes_vat: false, payment_method: '' };
  const [expForm, setExpForm] = useState<NewExpenseFormState>(initial);
  const { data: setupPaymentMethods } = useBusinessSetupPaymentMethods();
  const paymentMethods = buildPaymentMethodOptions(setupPaymentMethods);

  const saveExpense = async () => {
    if (!expForm.base_value) { toast.error('Valor é obrigatório'); return; }
    if (!expForm.payment_method) { toast.error('Seleciona o método de pagamento'); return; }
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
    const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-15`;
    await fin.upsertExpense.mutateAsync({
      description: expForm.description || null,
      category: expForm.category,
      base_value: base,
      vat_rate: vat,
      total_with_vat: total,
      location: expForm.location,
      documents: expForm.documents || [],
      expense_date: dateStr,
      expense_month: month,
      expense_quarter: Math.ceil(month / 3),
      expense_year: currentYear,
      status: 'por_pagar',
      payment_method: expForm.payment_method,
    });
    toast.success('Saída adicionada');
    onOpenChange(false);
    setExpForm(initial);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Saída — {MONTHS[month - 1]} {currentYear}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Descrição</Label><Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Categoria</Label>
            <CategorySelect type="expense" value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v }))} />
          </div>
          <div className="flex items-center gap-2 py-1">
            <Switch checked={expForm.includes_vat || false} onCheckedChange={v => setExpForm(f => ({ ...f, includes_vat: v }))} />
            <Label className="text-sm font-normal">Valor inclui IVA</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{expForm.includes_vat ? 'Valor Total c/ IVA (€)' : 'Valor Base (€)'}</Label><Input type="number" value={expForm.base_value} onChange={e => setExpForm(f => ({ ...f, base_value: e.target.value }))} /></div>
            <div><Label>IVA (%)</Label>
              <Select value={expForm.vat_rate} onValueChange={v => setExpForm(f => ({ ...f, vat_rate: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VAT_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <VatPreview
            value={expForm.base_value}
            vatRate={expForm.vat_rate}
            includesVat={!!expForm.includes_vat}
          />
          <div><Label>Localização</Label>
            <Select value={expForm.location} onValueChange={v => setExpForm(f => ({ ...f, location: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCATIONS.map(l => <SelectItem key={l} value={l}>{locationLabel(l)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Método Pagamento *</Label>
            <Select value={expForm.payment_method} onValueChange={v => setExpForm(f => ({ ...f, payment_method: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar método" /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <InvoiceUpload
            documents={Array.isArray(expForm.documents) ? expForm.documents : []}
            onChange={docs => setExpForm(f => ({ ...f, documents: docs }))}
          />
          <Button className="w-full" onClick={saveExpense}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}