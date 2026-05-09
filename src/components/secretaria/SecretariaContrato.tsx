import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { useMyTeamMember } from './secretaria-shared';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { isPaidExpenseStatus } from '@/lib/expenseStatus';

const STATUS_LABEL: Record<string, string> = {
  tudo_ok: 'Pago',
  pago_falta_fatura: 'Pago (s/ fatura)',
  pendente: 'Pendente',
  em_atraso: 'Em atraso',
  por_pagar: 'Por pagar',
};

function statusVariant(status?: string | null): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (isPaidExpenseStatus(status)) return 'default';
  if (status === 'em_atraso') return 'destructive';
  if (status === 'pendente') return 'secondary';
  return 'outline';
}

function statusLabel(status?: string | null) {
  if (!status) return 'Por pagar';
  return STATUS_LABEL[status] || status;
}

export default function SecretariaContrato() {
  const teamMember = useMyTeamMember();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const contracts = useQuery({
    queryKey: ['my-contracts', teamMember.data?.id],
    enabled: !!teamMember.data?.id,
    queryFn: async () => {
      const { data } = await supabase.from('member_contracts').select('*').eq('member_id', teamMember.data!.id).order('start_date', { ascending: false });
      return data || [];
    },
  });

  const payments = useQuery({
    queryKey: ['my-payments', teamMember.data?.id, (contracts.data || []).map(c => c.id).join(',')],
    // Esperar que os contratos carreguem para conseguir cruzar com financial_expenses
    enabled: !!teamMember.data?.id && !contracts.isLoading,
    queryFn: async () => {
      // 1. Pagamentos formais em member_payments
      const { data: memberPayments } = await supabase
        .from('member_payments')
        .select('*')
        .eq('member_id', teamMember.data!.id)
        .order('year', { ascending: false });

      // 2. Saídas financeiras (categoria 'ordenados') ligadas aos contratos do membro
      const contractIds = (contracts.data || []).map((c: any) => c.id);
      let expenses: any[] = [];
      if (contractIds.length > 0) {
        const { data: expData } = await supabase
          .from('financial_expenses')
          .select('id,expense_date,description,base_value,total_with_vat,status,documents,expense_month,expense_year,source_id,source_type,category')
          .eq('category', 'ordenados')
          .in('source_id', contractIds)
          .order('expense_date', { ascending: false });
        expenses = expData || [];
      }

      // Normalizar saídas para o mesmo shape (mantém o status original)
      const normalizedExpenses = expenses.map((e: any) => {
        const docs = Array.isArray(e.documents) ? e.documents : [];
        const firstDoc = docs[0];
        const docUrl = typeof firstDoc === 'string' ? firstDoc : firstDoc?.url || firstDoc?.file_url || null;
        return {
          id: `exp-${e.id}`,
          source: 'expense' as const,
          month: e.expense_month,
          year: e.expense_year,
          payment_type: 'ordenado',
          gross_value: Number(e.total_with_vat || e.base_value || 0),
          net_value: Number(e.base_value || 0),
          status: e.status || 'por_pagar',
          document_url: docUrl,
          description: e.description,
          expense_date: e.expense_date,
        };
      });

      const normalizedMemberPayments = (memberPayments || []).map((p: any) => ({ ...p, source: 'member_payment' as const }));

      // financial_expenses (contabilidade) é a fonte da verdade para ordenado/contrato.
      // Se houver uma despesa para um determinado mês/ano, escondemos qualquer member_payment
      // do mesmo mês com tipo equivalente (contrato_trabalho/ordenado/ordenados) para não duplicar.
      const SALARY_TYPES = new Set(['contrato_trabalho', 'ordenado', 'ordenados']);
      const expenseKeys = new Set(
        normalizedExpenses.map(e => `${e.year}-${e.month}`),
      );

      const filteredMemberPayments = normalizedMemberPayments.filter((p: any) => {
        if (!SALARY_TYPES.has(p.payment_type)) return true; // outros tipos (ex: prestacao) mantêm-se
        return !expenseKeys.has(`${p.year}-${p.month}`);
      });

      const merged = [...filteredMemberPayments, ...normalizedExpenses];
      return merged.sort((a, b) => (b.year - a.year) || ((b.month || 0) - (a.month || 0)));
    },
  });

  const currentYear = new Date().getFullYear();
  const yearTotal = (payments.data || [])
    .filter(p => p.year === currentYear && isPaidExpenseStatus(p.status))
    .reduce((s, p) => s + Number(p.net_value || 0), 0);
  const activeContract = (contracts.data || []).find(c => c.status === 'ativo');

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">O Meu Contrato</CardTitle></CardHeader>
        <CardContent>
          {!activeContract ? (
            <EmptyHint>Sem contrato registado.</EmptyHint>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{activeContract.contract_type?.replace('_', ' ')}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de início</p><p className="font-medium">{activeContract.start_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Data de fim</p><p className="font-medium">{activeContract.end_date || '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className="capitalize">{activeContract.status}</Badge></div>
              {activeContract.document_url && (
                <div className="col-span-full"><Button variant="outline" size="sm" asChild><a href={activeContract.document_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4 mr-1" /> Ver Documento</a></Button></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Os Meus Pagamentos</CardTitle>
            <Badge variant="outline">Total pago {currentYear}: {yearTotal.toFixed(2)} €</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Bruto</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments.data || []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem pagamentos registados.</TableCell></TableRow>}
              {(payments.data || []).map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedPayment(p)}>
                  <TableCell className="text-sm">{monthNames[p.month - 1] || p.month}/{p.year}</TableCell>
                  <TableCell className="text-sm capitalize">{p.payment_type?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-sm">{Number(p.gross_value).toFixed(2)} €</TableCell>
                  <TableCell className="text-sm font-medium">{Number(p.net_value).toFixed(2)} €</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)} className="text-[10px]">{statusLabel(p.status)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedPayment} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalhe do Pagamento</SheetTitle>
          </SheetHeader>
          {selectedPayment && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Mês / Ano</p><p className="font-medium">{monthNames[(selectedPayment.month || 1) - 1]}/{selectedPayment.year}</p></div>
                <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-medium capitalize">{selectedPayment.payment_type?.replace('_', ' ')}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Bruto</p><p className="font-medium">{Number(selectedPayment.gross_value).toFixed(2)} €</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Líquido</p><p className="font-medium">{Number(selectedPayment.net_value).toFixed(2)} €</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={statusVariant(selectedPayment.status)}>{statusLabel(selectedPayment.status)}</Badge></div>
              </div>

              {selectedPayment.document_url ? (
                <div className="pt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Documento / Fatura</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedPayment.document_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedPayment.document_url} download>
                        <Download className="h-4 w-4 mr-1" /> Download
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyHint className="pt-2">Nenhum documento associado a este pagamento.</EmptyHint>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
