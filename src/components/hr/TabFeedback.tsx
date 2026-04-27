import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeamData, FEEDBACK_TYPES, labelFor } from '@/hooks/useTeamData';
import { MemberSelect } from '@/components/hr/team-helpers';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function FeedbackDialog({ open, onClose, initial, members, onSave }: any) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState(initial || {
    member_id: '', session_date: '', session_time: '', feedback_type: 'feedback_formal',
    went_well: '', to_improve: '', agreements: '', next_session: '', summary: '', transcript_url: '',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Feedback' : 'Nova Sessão de Feedback'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Membro *</label>
            <Select value={f.member_id || ''} onValueChange={v => set('member_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
              <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Data *</label><Input type="date" value={f.session_date || ''} onChange={e => set('session_date', e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Hora</label><Input type="time" value={f.session_time || ''} onChange={e => set('session_time', e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={f.feedback_type || 'feedback_formal'} onValueChange={v => set('feedback_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FEEDBACK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Resumo</label><Textarea value={f.summary || ''} onChange={e => set('summary', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que correu bem</label><Textarea value={f.went_well || ''} onChange={e => set('went_well', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que melhorar</label><Textarea value={f.to_improve || ''} onChange={e => set('to_improve', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">Acordos & próximos passos</label><Textarea value={f.agreements || ''} onChange={e => set('agreements', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">URL da transcrição (PDF)</label><Input placeholder="https://..." value={f.transcript_url || ''} onChange={e => set('transcript_url', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Próxima sessão</label><Input type="date" value={f.next_session || ''} onChange={e => set('next_session', e.target.value)} /></div>
          <Button className="w-full" disabled={!f.member_id || !f.session_date} onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TabFeedback({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [dialog, setDialog] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: feedbackEventType } = useQuery({
    queryKey: ['event-type', 'feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_types')
        .select('id')
        .eq('slug', 'feedback')
        .maybeSingle();
      return data;
    },
    staleTime: Infinity,
  });

  const data = useMemo(() => {
    let d = team.feedback.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.feedback.data, filterMember]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const saveFeedback = async (rec: any) => {
    try {
      const isNew = !rec.id;
      const memberObj = allMembers.find((m: any) => m.id === rec.member_id);
      if (isNew) {
        const payload = { ...rec };
        delete payload.id;
        const startDate = rec.session_date && rec.session_time
          ? `${rec.session_date}T${rec.session_time}:00`
          : `${rec.session_date}T09:00:00`;
        const { data: eventData } = await supabase.from('events').insert({
          title: `Sessão de Feedback — ${memberObj?.full_name || 'Membro'}`,
          start_date: startDate, event_type_id: feedbackEventType?.id || null,
          department: 'recursos-humanos', created_by: user?.id || null, notes: rec.summary || null,
        }).select('id').single();
        if (eventData?.id) {
          const memberProfiles: string[] = [];
          if (user?.id) memberProfiles.push(user.id);
          if (memberObj?.profile_id && memberObj.profile_id !== user?.id) memberProfiles.push(memberObj.profile_id);
          if (memberProfiles.length > 0) {
            await supabase.from('event_members').insert(memberProfiles.map(pid => ({ event_id: eventData.id, profile_id: pid })));
          }
          payload.event_id = eventData.id;
        }
        const { error } = await supabase.from('feedback_sessions').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feedback_sessions').update(rec).eq('id', rec.id);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Sessão criada e adicionada à agenda!' : 'Sessão atualizada');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err));
    }
  };

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
            <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Resumo</TableHead><TableHead>Transcrição</TableHead><TableHead>Próxima</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem sessões</TableCell></TableRow> :
              data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="">{r.session_date}</TableCell>
                  <TableCell className="">{r.session_time || '—'}</TableCell>
                  <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, r.feedback_type)}</Badge></TableCell>
                  <TableCell className="max-w-[150px] truncate">{r.summary || '—'}</TableCell>
                  <TableCell>{r.transcript_url ? <a href={r.transcript_url} target="_blank" rel="noopener" className="text-xs text-primary underline">PDF</a> : '—'}</TableCell>
                  <TableCell className="">{r.next_session || '—'}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDialog(r)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setConfirmDelete({ id: r.id, label: `a sessão de ${memberName(r.member_id)} de ${r.session_date}` })}><Trash2 className="h-3 w-3" /></Button>
                  </div></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div></Card>
      {dialog !== null && <FeedbackDialog open onClose={() => setDialog(null)} initial={dialog} members={allMembers} onSave={saveFeedback} />}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title="Apagar sessão de feedback?"
        description={confirmDelete ? `Vais apagar ${confirmDelete.label}. Esta ação é irreversível.` : ''}
        confirmLabel="Apagar"
        onConfirm={() => {
          if (!confirmDelete) return;
          team.deleteFeedback.mutate(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}