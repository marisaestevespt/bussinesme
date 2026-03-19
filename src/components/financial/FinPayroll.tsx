import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { useFinancialData } from '@/hooks/useFinancialData';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const PAY_STATUS = [{ value: 'por_pagar', label: 'Por Pagar' }, { value: 'pago', label: 'Pago' }];
const LOCATIONS = [
  { value: 'portugal', label: 'Portugal' },
  { value: 'ue', label: 'União Europeia' },
  { value: 'fora_ue', label: 'Fora da UE' },
];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

interface Props {
  fin: ReturnType<typeof useFinancialData>;
  profiles: { id: string; full_name: string | null }[];
}

export function FinPayroll({ fin, profiles }: Props) {
  const payrollData = fin.payroll.data || [];
  const contractorsData = fin.contractors.data || [];
  const currentYear = new Date().getFullYear();

  // --- Payroll Dialog ---
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<any>({});

  const openNewPay = () => {
    setPayForm({ collaborator_name: '', month: String(new Date().getMonth() + 1), year: String(currentYear), gross_salary: '', withholding_rate: '', status: 'por_pagar' });
    setPayOpen(true);
  };

  const savePay = async () => {
    if (!payForm.collaborator_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    const profile = profiles.find(p => p.full_name === payForm.collaborator_name);
    await fin.upsertPayroll.mutateAsync({
      ...(payForm.id ? { id: payForm.id, expense_id: payForm.expense_id } : {}),
      collaborator_name: payForm.collaborator_name,
      profile_id: profile?.id || null,
      month: parseInt(payForm.month),
      year: parseInt(payForm.year),
      gross_salary: parseFloat(payForm.gross_salary) || 0,
      withholding_rate: parseFloat(payForm.withholding_rate) || 0,
      status: payForm.status,
    });
    setPayOpen(false);
    toast.success('Registo guardado');
  };

  // --- Contractor Dialog ---
  const [conOpen, setConOpen] = useState(false);
  const [conForm, setConForm] = useState<any>({});

  const openNewCon = () => {
    setConForm({ contractor_name: '', month: String(new Date().getMonth() + 1), year: String(currentYear), value: '', location: 'portugal', status: 'por_pagar', service: '' });
    setConOpen(true);
  };

  const saveCon = async () => {
    if (!conForm.contractor_name?.trim()) { toast.error('Nome é obrigatório'); return; }
    await fin.upsertContractor.mutateAsync({
      ...(conForm.id ? { id: conForm.id, expense_id: conForm.expense_id } : {}),
      contractor_name: conForm.contractor_name,
      month: parseInt(conForm.month),
      year: parseInt(conForm.year),
      service: conForm.service || null,
      value: parseFloat(conForm.value) || 0,
      location: conForm.location,
      documents: conForm.documents || [],
      status: conForm.status,
    });
    setConOpen(false);
    toast.success('Prestador guardado');
  };

  return (
    <div className="space-y-8 mt-4">
      {/* EMPLOYEES */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Colaboradores Fixos</h3>
          <Button size="sm" onClick={openNewPay}><Plus className="h-4 w-4 mr-1" /> Novo Registo</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Ret. Fonte</TableHead>
                  <TableHead className="text-right">SS Colab. (11%)</TableHead>
                  <TableHead className="text-right">SS Ent. (23,75%)</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem registos</TableCell></TableRow>
                ) : payrollData.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setPayForm({ ...p, month: String(p.month), year: String(p.year), gross_salary: p.gross_salary.toString(), withholding_rate: p.withholding_rate.toString() });
                    setPayOpen(true);
                  }}>
                    <TableCell className="font-medium">{p.collaborator_name}</TableCell>
                    <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
                    <TableCell className="text-right">{fmt(p.gross_salary)}</TableCell>
                    <TableCell className="text-right">{p.withholding_rate}% ({fmt(p.withholding_value)})</TableCell>
                    <TableCell className="text-right">{fmt(p.ss_employee)}</TableCell>
                    <TableCell className="text-right">{fmt(p.ss_employer)}</TableCell>
                    <TableCell className="text-right">{fmt(p.net_salary)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(p.total_cost)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                        {PAY_STATUS.find(s => s.value === p.status)?.label || p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* CONTRACTORS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Prestadores de Serviços</h3>
          <Button size="sm" onClick={openNewCon}><Plus className="h-4 w-4 mr-1" /> Novo Prestador</Button>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractorsData.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem prestadores</TableCell></TableRow>
                ) : contractorsData.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setConForm({ ...c, month: String(c.month), year: String(c.year), value: c.value.toString() });
                    setConOpen(true);
                  }}>
                    <TableCell className="font-medium">{c.contractor_name}</TableCell>
                    <TableCell>{MONTHS[c.month - 1]} {c.year}</TableCell>
                    <TableCell>{c.service || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.value)}</TableCell>
                    <TableCell>{LOCATIONS.find(l => l.value === c.location)?.label || c.location}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={c.status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                        {PAY_STATUS.find(s => s.value === c.status)?.label || c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* PAYROLL DIALOG */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{payForm.id ? 'Editar Registo' : 'Novo Registo de Salário'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Colaborador</Label>
              <Select value={payForm.collaborator_name || ''} onValueChange={v => setPayForm((f: any) => ({ ...f, collaborator_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => p.full_name).map(p => <SelectItem key={p.id} value={p.full_name!}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mês</Label>
                <Select value={payForm.month || ''} onValueChange={v => setPayForm((f: any) => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ano</Label><Input type="number" value={payForm.year || ''} onChange={e => setPayForm((f: any) => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Salário Bruto (€)</Label><Input type="number" step="0.01" value={payForm.gross_salary || ''} onChange={e => setPayForm((f: any) => ({ ...f, gross_salary: e.target.value }))} /></div>
              <div><Label>Retenção na Fonte (%)</Label><Input type="number" step="0.1" value={payForm.withholding_rate || ''} onChange={e => setPayForm((f: any) => ({ ...f, withholding_rate: e.target.value }))} /></div>
            </div>
            {payForm.gross_salary && (() => {
              const gross = parseFloat(payForm.gross_salary) || 0;
              const wh = parseFloat(payForm.withholding_rate) || 0;
              const whVal = Math.round(gross * wh / 100 * 100) / 100;
              const ssE = Math.round(gross * 0.11 * 100) / 100;
              const ssEr = Math.round(gross * 0.2375 * 100) / 100;
              const net = Math.round((gross - whVal - ssE) * 100) / 100;
              const total = Math.round((gross + ssEr) * 100) / 100;
              return (
                <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Retenção:</span><span>{fmt(whVal)}</span></div>
                  <div className="flex justify-between"><span>SS Colaborador (11%):</span><span>{fmt(ssE)}</span></div>
                  <div className="flex justify-between"><span>SS Entidade (23,75%):</span><span>{fmt(ssEr)}</span></div>
                  <div className="flex justify-between font-medium"><span>Salário Líquido:</span><span>{fmt(net)}</span></div>
                  <div className="flex justify-between font-medium text-primary"><span>Custo Total:</span><span>{fmt(total)}</span></div>
                </div>
              );
            })()}
            <div><Label>Status</Label>
              <Select value={payForm.status || 'por_pagar'} onValueChange={v => setPayForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={savePay}>Guardar</Button>
              {payForm.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deletePayroll.mutateAsync(payForm); setPayOpen(false); toast.success('Eliminado'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CONTRACTOR DIALOG */}
      <Dialog open={conOpen} onOpenChange={setConOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{conForm.id ? 'Editar Prestador' : 'Novo Prestador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do Prestador</Label><Input value={conForm.contractor_name || ''} onChange={e => setConForm((f: any) => ({ ...f, contractor_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mês</Label>
                <Select value={conForm.month || ''} onValueChange={v => setConForm((f: any) => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ano</Label><Input type="number" value={conForm.year || ''} onChange={e => setConForm((f: any) => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div><Label>Serviço</Label><Input value={conForm.service || ''} onChange={e => setConForm((f: any) => ({ ...f, service: e.target.value }))} /></div>
            <div><Label>Valor Pago (€)</Label><Input type="number" step="0.01" value={conForm.value || ''} onChange={e => setConForm((f: any) => ({ ...f, value: e.target.value }))} /></div>
            <div><Label>Localização</Label>
              <Select value={conForm.location || 'portugal'} onValueChange={v => setConForm((f: any) => ({ ...f, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={conForm.status || 'por_pagar'} onValueChange={v => setConForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveCon}>Guardar</Button>
              {conForm.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deleteContractor.mutateAsync(conForm); setConOpen(false); toast.success('Eliminado'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
