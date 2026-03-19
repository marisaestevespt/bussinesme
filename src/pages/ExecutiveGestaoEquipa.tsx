import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Star, Users, BarChart3, MessageSquare, FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useTeamData, MEMBER_STATUSES, MEMBER_TYPES, CONTRACT_TYPES, CONTRACT_STATUSES,
  PAYMENT_TYPES, PAYMENT_STATUSES, FEEDBACK_TYPES, PERFORMANCE_STATUSES, labelFor,
} from '@/hooks/useTeamData';
import { getMonthName } from '@/hooks/useExecutiveData';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ─── Helper: Member Select ──────
function MemberSelect({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: any[] }) {
  return (
    <Select value={value || '_none'} onValueChange={v => onChange(v === '_none' ? '' : v)}>
      <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">Todos</SelectItem>
        {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const CONTRACT_DURATIONS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: 'unica', label: 'Vez única' },
  { value: 'indefinido', label: 'Indefinido' },
];

// ─── Member Form Dialog ──────
function MemberDialog({ open, onClose, initial, onSave }: any) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState(initial || {
    full_name: '', role_title: '', email: '', whatsapp: '', work_schedule: '',
    identification: '', status: 'ativo', member_type: 'colaborador_fixo',
    start_date: '', presentation: '', responsibilities: '',
  });
  const [contract, setContract] = useState({
    contract_type: 'contrato_trabalho',
    duration: '12',
    monthly_value: '',
    contracted_hours: '',
    payment_day: '1',
    start_date: '',
    end_date: '',
    status: 'ativo',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setC = (k: string, v: any) => setContract((p: any) => ({ ...p, [k]: v }));

  // Auto-calculate end_date from start_date + duration
  const calcEndDate = (start: string, dur: string) => {
    if (!start || dur === 'indefinido' || dur === 'unica') return '';
    const d = new Date(start);
    d.setMonth(d.getMonth() + parseInt(dur));
    return d.toISOString().split('T')[0];
  };

  const handleStartDateChange = (v: string) => {
    setC('start_date', v);
    set('start_date', v);
    setC('end_date', calcEndDate(v, contract.duration));
  };

  const handleDurationChange = (v: string) => {
    setC('duration', v);
    setC('end_date', calcEndDate(contract.start_date, v));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Membro' : 'Novo Membro'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Basic Info */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informação Pessoal</h3>
          <Input placeholder="Nome completo *" value={f.full_name} onChange={e => set('full_name', e.target.value)} />
          <Input placeholder="Função" value={f.role_title || ''} onChange={e => set('role_title', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Email" value={f.email || ''} onChange={e => set('email', e.target.value)} />
            <Input placeholder="Telefone" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Horário de trabalho" value={f.work_schedule || ''} onChange={e => set('work_schedule', e.target.value)} />
            <Input placeholder="Identificação (BI/NIF)" value={f.identification || ''} onChange={e => set('identification', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={f.member_type} onValueChange={v => set('member_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador_fixo">Equipa Interna</SelectItem>
                  <SelectItem value="prestador_servicos">Freelancer</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={f.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEMBER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <>
              <Separator />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato & Pagamento</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de contrato</label>
                  <Select value={contract.contract_type} onValueChange={v => setC('contract_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duração do contrato</label>
                  <Select value={contract.duration} onValueChange={handleDurationChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Valor mensal (€)</label>
                  <Input type="number" placeholder="0" value={contract.monthly_value} onChange={e => setC('monthly_value', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tempo contratado mensal (horas)</label>
                  <Input placeholder="Ex: 40h" value={contract.contracted_hours} onChange={e => setC('contracted_hours', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data de início</label>
                  <Input type="date" value={contract.start_date} onChange={e => handleStartDateChange(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de fim</label>
                  <Input type="date" value={contract.end_date} onChange={e => setC('end_date', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dia do mês de pagamento</label>
                  <Input type="number" min={1} max={31} placeholder="1" value={contract.payment_day} onChange={e => setC('payment_day', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status do contrato</label>
                <Select value={contract.status} onValueChange={v => setC('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          <Separator />
          <Textarea placeholder="Apresentação" value={f.presentation || ''} onChange={e => set('presentation', e.target.value)} rows={2} />
          <Textarea placeholder="Responsabilidades" value={f.responsibilities || ''} onChange={e => set('responsibilities', e.target.value)} rows={2} />
          <Button className="w-full" onClick={() => { onSave({ member: { ...initial, ...f }, contract: isEdit ? null : contract }); onClose(false); }} disabled={!f.full_name.trim()}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Member Detail Sheet ──────
function MemberDetailSheet({ open, onClose, member, team }: any) {
  const [newTask, setNewTask] = useState('');
  if (!member) return null;
  const items = (team.onboarding.data || []).filter((i: any) => i.member_id === member.id);
  const contracts = (team.contracts.data || []).filter((c: any) => c.member_id === member.id);
  const payments = (team.payments.data || []).filter((p: any) => p.member_id === member.id);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{member.full_name}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={member.status === 'ativo' ? 'default' : 'secondary'}>{labelFor(MEMBER_STATUSES, member.status)}</Badge>
            <Badge variant="outline">{labelFor(MEMBER_TYPES, member.member_type)}</Badge>
            {member.role_title && <Badge variant="outline">{member.role_title}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {member.email && <div><span className="text-muted-foreground text-xs">Email</span><p>{member.email}</p></div>}
            {member.whatsapp && <div><span className="text-muted-foreground text-xs">Whatsapp</span><p>{member.whatsapp}</p></div>}
            {member.work_schedule && <div><span className="text-muted-foreground text-xs">Horário</span><p>{member.work_schedule}</p></div>}
            {member.identification && <div><span className="text-muted-foreground text-xs">Identificação</span><p>{member.identification}</p></div>}
            {member.start_date && <div><span className="text-muted-foreground text-xs">Data de início</span><p>{member.start_date}</p></div>}
          </div>
          {member.presentation && <div><span className="text-xs text-muted-foreground">Apresentação</span><p className="text-sm mt-1">{member.presentation}</p></div>}
          {member.responsibilities && <div><span className="text-xs text-muted-foreground">Responsabilidades</span><p className="text-sm mt-1 whitespace-pre-wrap">{member.responsibilities}</p></div>}

          <Separator />
          <h3 className="text-sm font-semibold">Digital Desk</h3>
          <p className="text-xs text-muted-foreground">Link para o espaço individual do membro na Secretária.</p>

          <Separator />
          <h3 className="text-sm font-semibold">Onboarding</h3>
          <div className="space-y-1">
            {['Sobre o negócio', 'Valores da equipa', 'O que não fazemos', 'Comunicação', 'Hábitos importantes'].map(label => {
              const item = items.find((i: any) => i.task === label);
              return (
                <div key={label} className="flex items-center gap-2">
                  <Checkbox
                    checked={!!item?.completed}
                    onCheckedChange={v => {
                      if (item) team.toggleOnboardingItem.mutate({ id: item.id, completed: !!v });
                      else team.addOnboardingItem.mutate({ member_id: member.id, task: label });
                    }}
                  />
                  <span className="text-sm">{label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <Input placeholder="Novo item de checklist..." value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}} className="h-8 text-sm" />
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { if (newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}}><Plus className="h-4 w-4" /></Button>
          </div>
          {items.filter((i: any) => !['Sobre o negócio', 'Valores da equipa', 'O que não fazemos', 'Comunicação', 'Hábitos importantes'].includes(i.task)).map((i: any) => (
            <div key={i.id} className="flex items-center gap-2 group">
              <Checkbox checked={i.completed} onCheckedChange={v => team.toggleOnboardingItem.mutate({ id: i.id, completed: !!v })} />
              <span className={`text-sm flex-1 ${i.completed ? 'line-through text-muted-foreground' : ''}`}>{i.task}</span>
              <button onClick={() => team.deleteOnboardingItem.mutate(i.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
            </div>
          ))}

          <Separator />
          <h3 className="text-sm font-semibold">Work Together</h3>
          <div className="text-sm space-y-1">
            <p className="text-xs text-muted-foreground">Contratos: {contracts.length}</p>
            <p className="text-xs text-muted-foreground">Pagamentos: {payments.length}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Generic Form Dialog for records ──────
function RecordDialog({ open, onClose, title, fields, initial, onSave }: any) {
  const [f, setF] = useState(initial || {});
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((field: any) => {
            if (field.type === 'select') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={f[field.key] || field.options[0]?.value || ''} onValueChange={v => set(field.key, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{field.options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.type === 'textarea') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Textarea value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} rows={2} />
                </div>
              );
            }
            if (field.type === 'number') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Input type="number" value={f[field.key] || ''} onChange={e => set(field.key, e.target.value ? Number(e.target.value) : '')} />
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground">{field.label}</label>
                <Input type={field.type || 'text'} value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} />
              </div>
            );
          })}
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Equipa ──────
function TabEquipa({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [dialog, setDialog] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const allMembers = team.members.data || [];
  const qc = useQueryClient();

  const handleSave = async ({ member, contract: contractData }: any) => {
    try {
      const isNew = !member.id;
      let memberId = member.id;

      if (isNew) {
        const memberPayload = { ...member };
        delete memberPayload.id;
        const { data, error } = await supabase.from('team_members').insert(memberPayload).select('id').single();
        if (error) throw error;
        memberId = data.id;
      } else {
        const { error } = await supabase.from('team_members').update(member).eq('id', member.id);
        if (error) throw error;
      }

      // Auto-create contract + payments for new members
      if (isNew && contractData && memberId) {
        const monthlyVal = parseFloat(contractData.monthly_value) || 0;
        const paymentDay = parseInt(contractData.payment_day) || 1;

        // Create contract
        await supabase.from('member_contracts').insert({
          member_id: memberId,
          contract_type: contractData.contract_type,
          start_date: contractData.start_date || null,
          end_date: contractData.end_date || null,
          status: contractData.status,
          monthly_value: monthlyVal,
          contracted_hours: contractData.contracted_hours || null,
          payment_day: paymentDay,
        });

        // Calculate number of payments
        let numPayments = 0;
        if (contractData.duration === 'unica') {
          numPayments = 1;
        } else if (contractData.duration === 'indefinido') {
          numPayments = 12;
        } else {
          numPayments = parseInt(contractData.duration) || 0;
        }

        // Create payment entries
        if (numPayments > 0 && contractData.start_date) {
          const startDate = new Date(contractData.start_date);
          const payments = [];
          for (let i = 0; i < numPayments; i++) {
            const payMonth = ((startDate.getMonth() + i) % 12) + 1;
            const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
            payments.push({
              member_id: memberId,
              month: payMonth,
              year: payYear,
              gross_value: monthlyVal,
              net_value: monthlyVal,
              payment_type: contractData.contract_type === 'contrato_prestacao' ? 'prestacao' : 'salario',
              status: 'por_pagar',
            });
          }
          await supabase.from('member_payments').insert(payments);
        }
      }

      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Membro criado com contrato e pagamentos!' : 'Membro atualizado');
    } catch (err: any) {
      toast.error('Erro ao guardar: ' + (err.message || err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold">Equipa</h2>
        <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
      </div>
      {allMembers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem membros. Adiciona o primeiro!</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allMembers.map(m => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(m)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-sm">{m.full_name}</h3>
                    {m.role_title && <p className="text-xs text-muted-foreground">{m.role_title}</p>}
                  </div>
                  <Badge variant={m.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {labelFor(MEMBER_STATUSES, m.status)}
                  </Badge>
                </div>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                {m.whatsapp && <p className="text-xs text-muted-foreground">{m.whatsapp}</p>}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setDialog(m); }}>Editar</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={e => { e.stopPropagation(); team.deleteMember.mutate(m.id); }}>Apagar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog !== null && <MemberDialog open onClose={() => setDialog(null)} initial={dialog} onSave={handleSave} />}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} />}
    </div>
  );
}

// ─── Tab: Performance ──────
function TabPerformance({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [weeklyDialog, setWeeklyDialog] = useState<any>(null);
  const [monthlyDialog, setMonthlyDialog] = useState<any>(null);

  const weeklyData = useMemo(() => {
    let d = team.perfWeekly.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.perfWeekly.data, filterMember]);

  const monthlyData = useMemo(() => {
    let d = team.perfMonthly.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.perfMonthly.data, filterMember]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const weeklyFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'week_start', label: 'Início da semana', type: 'date' },
    { key: 'week_end', label: 'Fim da semana', type: 'date' },
    { key: 'tasks_completed', label: 'Tarefas concluídas', type: 'number' },
    { key: 'tasks_overdue', label: 'Tarefas em atraso', type: 'number' },
    { key: 'projects_active', label: 'Projetos ativos', type: 'number' },
    { key: 'notes', label: 'Notas de performance', type: 'textarea' },
    { key: 'overall_status', label: 'Status geral', type: 'select', options: PERFORMANCE_STATUSES },
  ];

  const monthlyFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'tasks_completed', label: 'Tarefas concluídas', type: 'number' },
    { key: 'tasks_overdue', label: 'Tarefas em atraso', type: 'number' },
    { key: 'projects_active', label: 'Projetos ativos', type: 'number' },
    { key: 'hours_worked', label: 'Total horas trabalhadas', type: 'number' },
    { key: 'rating', label: 'Avaliação (1-5)', type: 'number' },
    { key: 'comments', label: 'Comentários', type: 'textarea' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
    { key: 'overall_status', label: 'Status geral', type: 'select', options: PERFORMANCE_STATUSES },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Performance</h2>
        <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
      </div>

      <Tabs defaultValue="semanal">
        <TabsList><TabsTrigger value="semanal">Semanal</TabsTrigger><TabsTrigger value="mensal">Mensal</TabsTrigger></TabsList>

        <TabsContent value="semanal" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setWeeklyDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Registo</Button></div>
          <Card><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead><TableHead>Semana</TableHead><TableHead>Concluídas</TableHead><TableHead>Atraso</TableHead><TableHead>Projetos</TableHead><TableHead>Status</TableHead><TableHead>Notas</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {weeklyData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem registos</TableCell></TableRow> :
                  weeklyData.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                      <TableCell className="text-xs">{r.week_start} → {r.week_end}</TableCell>
                      <TableCell className="text-xs">{r.tasks_completed}</TableCell>
                      <TableCell className="text-xs">{r.tasks_overdue}</TableCell>
                      <TableCell className="text-xs">{r.projects_active}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{labelFor(PERFORMANCE_STATUSES, r.overall_status)}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{r.notes || '—'}</TableCell>
                      <TableCell><div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeeklyDialog(r)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePerfWeekly.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </div></Card>
          {weeklyDialog !== null && <RecordDialog open onClose={() => setWeeklyDialog(null)} title={weeklyDialog.id ? 'Editar Registo Semanal' : 'Novo Registo Semanal'} fields={weeklyFields} initial={weeklyDialog} onSave={(r: any) => team.upsertPerfWeekly.mutate(r)} />}
        </TabsContent>

        <TabsContent value="mensal" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" onClick={() => setMonthlyDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Registo</Button></div>
          <Card><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Concluídas</TableHead><TableHead>Atraso</TableHead><TableHead>Horas</TableHead><TableHead>Avaliação</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {monthlyData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem registos</TableCell></TableRow> :
                  monthlyData.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                      <TableCell className="text-xs">{r.month && r.year ? `${getMonthName(r.month)} ${r.year}` : '—'}</TableCell>
                      <TableCell className="text-xs">{r.tasks_completed}</TableCell>
                      <TableCell className="text-xs">{r.tasks_overdue}</TableCell>
                      <TableCell className="text-xs">{r.hours_worked || '—'}</TableCell>
                      <TableCell>{r.rating ? <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < (r.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />)}</div> : '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{labelFor(PERFORMANCE_STATUSES, r.overall_status)}</Badge></TableCell>
                      <TableCell><div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonthlyDialog(r)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePerfMonthly.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </div></Card>
          {monthlyDialog !== null && <RecordDialog open onClose={() => setMonthlyDialog(null)} title={monthlyDialog.id ? 'Editar Registo Mensal' : 'Novo Registo Mensal'} fields={monthlyFields} initial={monthlyDialog} onSave={(r: any) => team.upsertPerfMonthly.mutate(r)} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab: Feedback ──────
function TabFeedback({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [dialog, setDialog] = useState<any>(null);

  const data = useMemo(() => {
    let d = team.feedback.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.feedback.data, filterMember]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const fields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'session_date', label: 'Data', type: 'date' },
    { key: 'feedback_type', label: 'Tipo', type: 'select', options: FEEDBACK_TYPES },
    { key: 'went_well', label: 'O que correu bem', type: 'textarea' },
    { key: 'to_improve', label: 'O que melhorar', type: 'textarea' },
    { key: 'agreements', label: 'Acordos & próximos passos', type: 'textarea' },
    { key: 'next_session', label: 'Próxima sessão', type: 'date' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Feedback</h2>
        <div className="flex gap-2 items-center">
          <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
          <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Nova Sessão</Button>
        </div>
      </div>
      <Card><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>O que correu bem</TableHead><TableHead>O que melhorar</TableHead><TableHead>Acordos</TableHead><TableHead>Próxima</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem sessões de feedback</TableCell></TableRow> :
              data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.session_date}</TableCell>
                  <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, r.feedback_type)}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{r.went_well || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{r.to_improve || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{r.agreements || '—'}</TableCell>
                  <TableCell className="text-xs">{r.next_session || '—'}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDialog(r)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteFeedback.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div></Card>
      {dialog !== null && <RecordDialog open onClose={() => setDialog(null)} title={dialog.id ? 'Editar Feedback' : 'Nova Sessão de Feedback'} fields={fields} initial={dialog} onSave={(r: any) => team.upsertFeedback.mutate(r)} />}
    </div>
  );
}

// ─── Tab: Contratos & Pagamentos ──────
function TabContracts({ team }: { team: ReturnType<typeof useTeamData> }) {
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
    return d;
  }, [team.payments.data, filterMember]);

  const paidThisMonth = useMemo(() =>
    (team.payments.data || []).filter(p => p.status === 'pago' && p.month === currentMonth && p.year === currentYear)
      .reduce((s, p) => s + Number(p.net_value || 0), 0),
    [team.payments.data]
  );

  const paidThisYear = useMemo(() =>
    (team.payments.data || []).filter(p => p.status === 'pago' && p.year === currentYear)
      .reduce((s, p) => s + Number(p.net_value || 0), 0),
    [team.payments.data]
  );

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

      {/* Summary */}
      <div className="flex gap-4">
        <Card className="flex-1"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Pago este mês</p>
          <p className="text-lg font-bold">€{paidThisMonth.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="flex-1"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Pago este ano</p>
          <p className="text-lg font-bold">€{paidThisYear.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Contracts */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">/ Contratos</h3>
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

      <Separator />

      {/* Payments */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">/ Pagamentos</h3>
          <Button size="sm" onClick={() => setPaymentDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Pagamento</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paymentsData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem pagamentos</TableCell></TableRow> :
                paymentsData.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{memberName(p.member_id)}</TableCell>
                    <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                    <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                    <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === 'pago' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                    <TableCell>{p.document_url ? <a href={p.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPaymentDialog(p)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div></Card>
        {paymentDialog !== null && <RecordDialog open onClose={() => setPaymentDialog(null)} title={paymentDialog.id ? 'Editar Pagamento' : 'Novo Pagamento'} fields={paymentFields} initial={paymentDialog} onSave={(r: any) => team.upsertPayment.mutate(r)} />}
      </div>
    </div>
  );
}

// ─── Main Page ──────
export default function ExecutiveGestaoEquipa() {
  const team = useTeamData();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Recursos Humanos</h1>
          <p className="text-sm text-muted-foreground mt-1">Central de gestão de todos os membros do negócio</p>
        </div>

        <Tabs defaultValue="equipa">
          <TabsList>
            <TabsTrigger value="equipa" className="gap-1"><Users className="h-4 w-4" /> Equipa</TabsTrigger>
            <TabsTrigger value="performance" className="gap-1"><BarChart3 className="h-4 w-4" /> Performance</TabsTrigger>
            <TabsTrigger value="feedback" className="gap-1"><MessageSquare className="h-4 w-4" /> Feedback</TabsTrigger>
            <TabsTrigger value="contratos" className="gap-1"><FileText className="h-4 w-4" /> Contratos & Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="equipa"><TabEquipa team={team} /></TabsContent>
          <TabsContent value="performance"><TabPerformance team={team} /></TabsContent>
          <TabsContent value="feedback"><TabFeedback team={team} /></TabsContent>
          <TabsContent value="contratos"><TabContracts team={team} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
