import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Editable } from '@/components/ui/editable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { CRM_SOURCES, statusLabel } from '@/hooks/useCrmData';
import { useCrmStages } from '@/hooks/useCrmStages';
import { useCommercialMembers } from '@/hooks/useTeamByWorkArea';

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  potential_product: string;
  closed_product: string;
  responsible_id: string | null;
  estimated_value: string;
  next_followup: Date | undefined;
  followup_notes: string;
  context: string;
  lost_reason: string;
};

const EMPTY: LeadForm = {
  name: '', email: '', phone: '', source: '', status: 'lead',
  potential_product: '', closed_product: '', responsible_id: null,
  estimated_value: '', next_followup: undefined, followup_notes: '',
  context: '', lost_reason: '',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const confirm = useConfirm();
  const { stages } = useCrmStages();
  const { data: members = [] } = useCommercialMembers();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['crm-lead-detail', id],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*').eq('id', id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['crm-lead-interactions', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_interactions')
        .select('*')
        .eq('lead_id', id!)
        .order('interaction_date', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['lead-tasks', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, name, status, deadline')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list-names'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name').order('name');
      return (data || []).map((p) => p.name).filter(Boolean) as string[];
    },
  });

  const [form, setForm] = useState<LeadForm>(EMPTY);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (lead && !initialized) {
      setForm({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || '',
        status: lead.status || 'lead',
        potential_product: lead.potential_product || '',
        closed_product: lead.closed_product || '',
        responsible_id: lead.responsible_id || null,
        estimated_value: lead.estimated_value?.toString() || '',
        next_followup: lead.next_followup ? new Date(lead.next_followup) : undefined,
        followup_notes: lead.followup_notes || '',
        context: lead.context || '',
        lost_reason: lead.lost_reason || '',
      });
      setInitialized(true);
    }
  }, [lead, initialized]);

  const update = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || 'outro',
      status: form.status,
      potential_product: form.potential_product || null,
      closed_product: form.closed_product || null,
      responsible_id: form.responsible_id || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : 0,
      next_followup: form.next_followup
        ? format(form.next_followup, 'yyyy-MM-dd')
        : null,
      followup_notes: form.followup_notes || null,
      context: form.context || null,
      lost_reason: form.status === 'perdido' ? form.lost_reason || null : null,
    };
    const { error } = await supabase.from('crm_leads').update(payload).eq('id', id!);
    if (error) {
      toast.error('Erro ao guardar lead');
      return;
    }
    toast.success('Lead atualizado');
    qc.invalidateQueries({ queryKey: ['crm-lead-detail', id] });
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar lead?',
      description: 'Esta ação não pode ser revertida.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('crm_leads').delete().eq('id', id!);
    if (error) {
      toast.error('Erro ao eliminar');
      return;
    }
    toast.success('Lead eliminado');
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
    navigate('/hub/comercial/crm');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <InlineLoader />
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Lead não encontrado</div>
      </AppLayout>
    );
  }

  const createdAt = lead.created_at ? parseISO(lead.created_at) : null;
  const updatedAt = lead.updated_at ? parseISO(lead.updated_at) : null;
  const daysInCrm = createdAt && updatedAt ? differenceInDays(updatedAt, createdAt) : null;

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <EntityHeroHeader
          icon={parseIcon((lead as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('crm_leads').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['crm-lead-detail', id] });
            qc.invalidateQueries({ queryKey: ['crm-leads'] });
          }}
          coverUrl={(lead as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('crm_leads').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['crm-lead-detail', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`leads/${id}`}
          disabled={!isOwner}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <BackNavigation parentRoute="/hub/comercial/crm" parentLabel="CRM" />
          <h1 className="text-xl font-bold leading-tight tracking-tight truncate max-w-[60%]">
            {form.name || 'Sem nome'}
          </h1>
          <Badge variant="outline">{statusLabel(form.status)}</Badge>
          <div className="flex-1" />
          {isOwner && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button size="sm" onClick={handleSave}>Guardar</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Dados principais */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informação do Lead</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome">
                <Editable display={form.name} disabled={!isOwner} placeholder="Sem nome" render={({ stop, autoFocusRef }) => (
                  <Input ref={autoFocusRef as any} value={form.name} onBlur={stop} onChange={(e) => update('name', e.target.value)} />
                )} />
              </Field>
              <Field label="Email">
                <Editable display={form.email} disabled={!isOwner} placeholder="Sem email" render={({ stop, autoFocusRef }) => (
                  <Input ref={autoFocusRef as any} type="email" value={form.email} onBlur={stop} onChange={(e) => update('email', e.target.value)} />
                )} />
              </Field>
              <Field label="Telefone">
                <Editable display={form.phone} disabled={!isOwner} placeholder="Sem telefone" render={({ stop, autoFocusRef }) => (
                  <Input ref={autoFocusRef as any} value={form.phone} onBlur={stop} onChange={(e) => update('phone', e.target.value)} />
                )} />
              </Field>
              <Field label="Fonte">
                <Select value={form.source || undefined} onValueChange={(v) => update('source', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar fonte" /></SelectTrigger>
                  <SelectContent>
                    {CRM_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado">
                <Select value={form.status} onValueChange={(v) => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s: any) => (
                      <SelectItem key={s.key || s.id} value={s.key || s.id}>
                        {s.label || s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável">
                <Select
                  value={form.responsible_id || undefined}
                  onValueChange={(v) => update('responsible_id', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m: any) => (
                      <SelectItem key={m.profile_id || m.id} value={m.profile_id || m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Produto Potencial">
                <Select
                  value={form.potential_product || undefined}
                  onValueChange={(v) => update('potential_product', v)}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor estimado (€)">
                <Editable
                  display={form.estimated_value}
                  disabled={!isOwner}
                  format={(v) => `${v} €`}
                  placeholder="0 €"
                  render={({ stop, autoFocusRef }) => (
                    <Input
                      ref={autoFocusRef as any}
                      type="number"
                      inputMode="decimal"
                      value={form.estimated_value}
                      onBlur={stop}
                      onChange={(e) => update('estimated_value', e.target.value)}
                    />
                  )}
                />
              </Field>
              <Field label="Próximo follow-up">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('justify-start font-normal', !form.next_followup && 'text-muted-foreground')}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {form.next_followup ? format(form.next_followup, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.next_followup} onSelect={(d) => update('next_followup', d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </Field>
              {form.status === 'perdido' && (
                <Field label="Motivo da perda">
                  <Editable display={form.lost_reason} disabled={!isOwner} placeholder="Sem motivo" render={({ stop, autoFocusRef }) => (
                    <Input ref={autoFocusRef as any} value={form.lost_reason} onBlur={stop} onChange={(e) => update('lost_reason', e.target.value)} />
                  )} />
                </Field>
              )}
              <Field label="Notas de follow-up" className="md:col-span-2">
                <Editable display={form.followup_notes} disabled={!isOwner} placeholder="Sem notas" render={({ stop, autoFocusRef }) => (
                  <Textarea ref={autoFocusRef as any} rows={3} value={form.followup_notes} onBlur={stop} onChange={(e) => update('followup_notes', e.target.value)} />
                )} />
              </Field>
              <Field label="Contexto" className="md:col-span-2">
                <Editable display={form.context} disabled={!isOwner} placeholder="Sem contexto" render={({ stop, autoFocusRef }) => (
                  <Textarea ref={autoFocusRef as any} rows={3} value={form.context} onBlur={stop} onChange={(e) => update('context', e.target.value)} />
                )} />
              </Field>
            </CardContent>
          </Card>

          {/* Métricas */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Entrada" value={createdAt ? format(createdAt, 'dd/MM/yyyy') : '—'} />
                <Row label="Última atualização" value={updatedAt ? format(updatedAt, 'dd/MM/yyyy') : '—'} />
                <Row label="Tempo no CRM" value={daysInCrm !== null ? `${daysInCrm} dia(s)` : '—'} />
                <Row label="Interações" value={String(interactions.length)} />
                <Row label="Ações" value={String(actions.length)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Interações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {interactions.length === 0 && <EmptyHint>Sem interações registadas</EmptyHint>}
                {interactions.map((i: any) => (
                  <div key={i.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px]">{i.interaction_type}</Badge>
                      <span className="text-muted-foreground">
                        {i.interaction_date ? format(parseISO(i.interaction_date), 'dd/MM/yyyy') : '—'}
                      </span>
                    </div>
                    {i.notes && <p className="whitespace-pre-wrap">{i.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tarefas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {actions.length === 0 && <EmptyHint>Sem tarefas associadas</EmptyHint>}
                {actions.map((a: any) => (
                  <div key={a.id} className="rounded-md border p-2 text-xs flex items-center justify-between">
                    <span className={cn((a.status === 'concluida' || a.status === 'done' || a.status === 'completed') && 'line-through text-muted-foreground')}>{a.name}</span>
                    {(a.status === 'concluida' || a.status === 'done' || a.status === 'completed') && <Badge variant="secondary" className="text-[10px]">Feita</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}