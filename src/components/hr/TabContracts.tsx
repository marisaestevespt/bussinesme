import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { getMonthName } from '@/hooks/useExecutiveData';
import {
  useTeamData, CONTRACT_TYPES, CONTRACT_STATUSES,
  PAYMENT_TYPES, PAYMENT_STATUSES, labelFor,
} from '@/hooks/useTeamData';
import { MemberSelect, currentYear, currentMonth } from '@/components/hr/team-helpers';
import { RecordDialog } from '@/components/hr/RecordDialog';

export function TabContracts({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [contractDialog, setContractDialog] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState<any>(null);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const contractsData = useMemo(() => {
    let d = team.contracts.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.contracts.data, filterMember]);

  const paymentsData = useMemo(() => {
    let d = team.payments.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [team.payments.data, filterMember]);

  const contractFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'contract_type', label: 'Tipo de contrato', type: 'select', options: CONTRACT_TYPES },
    { key: 'start_date', label: 'Data de início', type: 'date' },
    { key: 'end_date', label: 'Data de fim', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: CONTRACT_STATUSES },
    { key: 'document_url', label: 'Documento (URL)', type: 'text' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ];

  const paymentFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'payment_type', label: 'Tipo', type: 'select', options: PAYMENT_TYPES },
    { key: 'gross_value', label: 'Valor Bruto (€)', type: 'number' },
    { key: 'net_value', label: 'Valor Líquido (€)', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: PAYMENT_STATUSES },
    { key: 'document_url', label: 'Documentos (URL)', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Contratos & Pagamentos</h2>
        <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Contratos</h3>
          <Button size="sm" onClick={() => setContractDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {contractsData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem contratos</TableCell></TableRow> :
                contractsData.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{memberName(c.member_id)}</TableCell>
                    <TableCell className="text-xs">{labelFor(CONTRACT_TYPES, c.contract_type)}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell className="text-xs">{c.end_date || '—'}</TableCell>
                    <TableCell><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(CONTRACT_STATUSES, c.status)}</Badge></TableCell>
                    <TableCell>{c.document_url ? <a href={c.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setContractDialog(c)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteContract.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div></Card>
        {contractDialog !== null && <RecordDialog open onClose={() => setContractDialog(null)} title={contractDialog.id ? 'Editar Contrato' : 'Novo Contrato'} fields={contractFields} initial={contractDialog} onSave={(r: any) => team.upsertContract.mutate(r)} />}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Pagamentos</h3>
          <Button size="sm" onClick={() => setPaymentDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Pagamento</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paymentsData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem pagamentos</TableCell></TableRow> :
                paymentsData.map(p => {
                  const isOverdue = p.status === 'por_pagar' && (p.year < currentYear || (p.year === currentYear && p.month < currentMonth));
                  return (
                    <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                      <TableCell className="text-sm">{memberName(p.member_id)}</TableCell>
                      <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                      <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                      <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={p.status === 'pago' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">{isOverdue ? 'Em atraso' : labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                      <TableCell><div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPaymentDialog(p)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div></TableCell>
                    </TableRow>
                  );
                })
              }
            </TableBody>
          </Table>
        </div></Card>
        {paymentDialog !== null && <RecordDialog open onClose={() => setPaymentDialog(null)} title={paymentDialog.id ? 'Editar Pagamento' : 'Novo Pagamento'} fields={paymentFields} initial={paymentDialog} onSave={(r: any) => team.upsertPayment.mutate(r)} />}
      </div>
    </div>
  );
}