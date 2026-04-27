import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, ExternalLink, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';
import { formatEuro } from '@/lib/formatting';
const PAYMENT_LABELS: Record<string, string> = {
  mbway: 'MB WAY',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  paypal: 'PayPal',
  stripe: 'Stripe',
  numerario: 'Numerário',
  debito_direto: 'Débito Direto',
  plataforma: 'Plataforma',
  outro: 'Outro',
};

const CATEGORY_LABELS: Record<string, string> = {
  ferramentas: 'Ferramentas', marketing: 'Marketing', pessoal: 'Pessoal',
  escritorio: 'Escritório', freelancer: 'Freelancer', formacao: 'Formação',
  viagens: 'Viagens', outro: 'Outro',
};

interface Props {
  fin: ReturnType<typeof useFinancialData>;
}

export function FinSetupFinanceiro({ fin }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openSupplierId, setOpenSupplierId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseEdit, setExpenseEdit] = useState<any>({});

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-setup-fin'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').order('name');
      return (data || []) as any[];
    },
  });

  const supplier = openSupplierId ? suppliers.find((s: any) => s.id === openSupplierId) : null;

  const { data: supplierExpenses = [] } = useQuery({
    queryKey: ['supplier-expenses-setup', openSupplierId],
    enabled: !!openSupplierId,
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_expenses')
        .select('id,description,expense_name,expense_date,expense_id,base_value,vat_rate,total_with_vat,status,source_type,is_recurring,category,payment_method,expense_month,expense_quarter,expense_year')
        .eq('supplier_id', openSupplierId!)
        .order('expense_date', { ascending: true });
      return data || [];
    },
  });

  const updateExpense = useMutation({
    mutationFn: async (exp: any) => {
      const base = parseFloat(exp.base_value) || 0;
      const vat = exp.vat_rate ?? 23;
      const total = Math.round(base * (1 + vat / 100) * 100) / 100;
      const expenseDate = exp.expense_date || new Date().toISOString().slice(0, 10);
      const expenseMonth = parseInt(expenseDate.slice(5, 7));
      const expenseYear = parseInt(expenseDate.slice(0, 4));
      const expenseQuarter = Math.ceil(expenseMonth / 3);

      // Delegate write to the shared hook so cache invalidation and status
      // normalisation stay consistent across the module.
      await fin.upsertExpense.mutateAsync({
        id: exp.id,
        status: exp.status,
        expense_date: expenseDate,
        base_value: base,
        vat_rate: vat,
        total_with_vat: total,
        description: exp.description,
        category: exp.category,
        expense_month: expenseMonth,
        expense_quarter: expenseQuarter,
        expense_year: expenseYear,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-expenses-setup'] });
      setEditingExpenseId(null);
      toast.success('Despesa atualizada');
    },
  });

  const visibleExpenses = supplierExpenses.filter((e: any) => e.source_type !== 'rule');
  const totalPago = visibleExpenses.filter((e: any) => ['pago_falta_fatura', 'tudo_ok'].includes(e.status)).reduce((s: number, e: any) => s + (e.total_with_vat || 0), 0);
  const totalPendente = visibleExpenses.filter((e: any) => !['pago_falta_fatura', 'tudo_ok', 'cancelado'].includes(e.status)).reduce((s: number, e: any) => s + (e.total_with_vat || 0), 0);

  return (
    <div className="space-y-8">
      {/* FORNECEDORES */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fornecedores</h3>
        <Button size="sm" variant="outline" onClick={() => navigate('/hub/financeiro/fornecedores')}>
          <Truck className="h-4 w-4 mr-1" /> Gerir Fornecedores
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem fornecedores</TableCell></TableRow>
              ) : suppliers.map((s: any) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setOpenSupplierId(s.id)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.nif || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[s.category] || s.category || '—'}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{PAYMENT_LABELS[s.payment_method] || s.payment_method || '—'}</Badge></TableCell>
                  <TableCell>{s.default_vat_rate != null ? `${s.default_vat_rate}%` : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contract_start_date && s.contract_end_date
                      ? `${s.contract_start_date} → ${s.contract_end_date}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={s.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                      {s.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier detail dialog — opens inline, no navigation */}
      <Dialog open={!!openSupplierId} onOpenChange={(o) => { if (!o) { setOpenSupplierId(null); setEditingExpenseId(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fornecedor — {supplier?.name}</DialogTitle>
          </DialogHeader>
          {supplier && (
            <div className="space-y-4 mt-2">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">NIF</span>{supplier.nif || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">Email</span>{supplier.email || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">Telefone</span>{supplier.phone || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">IBAN</span>{supplier.iban || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">Pagamento</span>{PAYMENT_LABELS[supplier.payment_method] || supplier.payment_method || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">Categoria</span>{CATEGORY_LABELS[supplier.category] || supplier.category || '—'}</div>
                <div><span className="text-muted-foreground text-xs block">IVA padrão</span>{supplier.default_vat_rate != null ? `${supplier.default_vat_rate}%` : '—'}</div>
                <div><span className="text-muted-foreground text-xs block">Contrato</span>
                  {supplier.contract_start_date && supplier.contract_end_date
                    ? `${supplier.contract_start_date} → ${supplier.contract_end_date}`
                    : '—'}
                </div>
                <div><span className="text-muted-foreground text-xs block">Estado</span>
                  <Badge variant="outline" className={supplier.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                    {supplier.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              {supplier.address && <div className="text-sm"><span className="text-muted-foreground text-xs block">Morada</span>{supplier.address}</div>}
              {supplier.website && (
                <div className="text-sm">
                  <span className="text-muted-foreground text-xs block">Website</span>
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {supplier.website} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {supplier.notes && <div className="text-sm"><span className="text-muted-foreground text-xs block">Notas</span>{supplier.notes}</div>}

              {/* Documents */}
              {supplier.documents && Array.isArray(supplier.documents) && supplier.documents.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Documentos / Contratos</Label>
                  <div className="space-y-1 mt-1">
                    {supplier.documents.map((doc: any, i: number) => (
                      <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                        <ExternalLink className="h-3 w-3" /> {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {visibleExpenses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Despesas ({visibleExpenses.length})</Label>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Pago: {formatEuro(totalPago)}</span>
                      <span>Pendente: {formatEuro(totalPendente)}</span>
                    </div>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-1 border rounded-lg p-3">
                    {visibleExpenses.map((exp: any) => {
                      const isEditing = editingExpenseId === exp.id;
                      if (isEditing) {
                        const totalPreview = Math.round((parseFloat(expenseEdit.base_value) || 0) * (1 + (expenseEdit.vat_rate ?? 23) / 100) * 100) / 100;
                        return (
                          <div key={exp.id} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Editar Transação</span>
                              <Badge variant="outline" className="text-[10px]">{exp.expense_id || ''}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[10px]">Data</Label>
                                <Input type="date" className="h-8 text-xs" value={expenseEdit.expense_date || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, expense_date: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-[10px]">Status</Label>
                                <Select value={expenseEdit.status || 'por_pagar'} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, status: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="por_pagar">Por Pagar</SelectItem>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="em_atraso">Em Atraso</SelectItem>
                                    <SelectItem value="pago_falta_fatura">Pago, Falta Fatura</SelectItem>
                                    <SelectItem value="tudo_ok">Tudo OK</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[10px]">Categoria</Label>
                                <Select value={expenseEdit.category || 'outro'} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, category: v }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {['ferramentas', 'marketing', 'pessoal', 'escritorio', 'freelancer', 'formacao', 'viagens', 'outro'].map(c => (
                                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[10px]">Valor base (€)</Label>
                                <Input type="number" step="0.01" className="h-8 text-xs" value={expenseEdit.base_value || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, base_value: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-[10px]">IVA (%)</Label>
                                <Select value={String(expenseEdit.vat_rate ?? 23)} onValueChange={v => setExpenseEdit((f: any) => ({ ...f, vat_rate: parseInt(v) }))}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[0, 6, 13, 23].map(v => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-[10px]">Total c/ IVA</Label>
                                <div className="h-8 flex items-center text-xs font-medium">{formatEuro(totalPreview)}</div>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Descrição</Label>
                              <Input className="h-8 text-xs" value={expenseEdit.description || ''} onChange={e => setExpenseEdit((f: any) => ({ ...f, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
                              <span>Mês: {exp.expense_month || '—'}</span>
                              <span>Trimestre: T{exp.expense_quarter || '—'}</span>
                              <span>Ano: {exp.expense_year || '—'}</span>
                            </div>
                            {exp.payment_method && (
                              <div className="text-[10px] text-muted-foreground">Método: {PAYMENT_LABELS[exp.payment_method] || exp.payment_method}</div>
                            )}
                            <div className="flex gap-2 justify-end pt-1">
                              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingExpenseId(null)}>
                                <X className="h-3 w-3 mr-1" /> Cancelar
                              </Button>
                              <Button size="sm" className="h-7 px-3 text-xs" onClick={() => updateExpense.mutate(expenseEdit)}>
                                <Check className="h-3 w-3 mr-1" /> Guardar
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={exp.id} className="flex items-center justify-between text-xs py-2 border-b last:border-0 hover:bg-muted/30 rounded px-2 cursor-pointer"
                          onClick={() => { setEditingExpenseId(exp.id); setExpenseEdit({ ...exp, base_value: String(exp.base_value) }); }}
                        >
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-muted-foreground shrink-0">{exp.expense_date}</span>
                            <span className="truncate">{exp.description}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{formatEuro(exp.base_value || 0)}</span>
                            <span className="font-medium">{formatEuro(exp.total_with_vat || 0)}</span>
                            <Badge
                              variant="outline"
                              className={`cursor-pointer ${['pago_falta_fatura', 'tudo_ok'].includes(exp.status) ? 'bg-success/10 text-success' : exp.status === 'cancelado' ? 'bg-muted text-muted-foreground' : exp.status === 'em_atraso' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = ['por_pagar', 'pendente', 'em_atraso'].includes(exp.status) ? 'pago_falta_fatura' : ['pago_falta_fatura', 'tudo_ok'].includes(exp.status) ? 'por_pagar' : exp.status;
                                updateExpense.mutate({ ...exp, status: next });
                              }}
                            >
                              {exp.status === 'tudo_ok' ? 'Tudo OK' : exp.status === 'pago_falta_fatura' ? 'Pago' : exp.status === 'cancelado' ? 'Cancelado' : exp.status === 'em_atraso' ? 'Em Atraso' : exp.status === 'pendente' ? 'Pendente' : 'Por pagar'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Renewal history */}
              {supplier.renewal_history && Array.isArray(supplier.renewal_history) && supplier.renewal_history.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Histórico de renovações</Label>
                  {supplier.renewal_history.map((r: any, i: number) => (
                    <div key={i} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                      {r.date}: {r.old_end} → {r.new_end} {r.notes && `— ${r.notes}`}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => { setOpenSupplierId(null); navigate('/hub/financeiro/fornecedores'); }}>
                  Abrir página completa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
