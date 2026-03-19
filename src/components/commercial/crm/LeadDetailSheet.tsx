import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CRM_STATUSES, CRM_SOURCES, INTERACTION_TYPES, statusLabel, getFollowUpState } from '@/hooks/useCrmData';
import { useCrmData } from '@/hooks/useCrmData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  products: string[];
  onSave: (lead: any) => void;
  onDelete?: (id: string) => void;
}

export function LeadDetailSheet({ open, onOpenChange, lead, products, onSave, onDelete }: LeadDetailSheetProps) {
  const { useLeadInteractions, upsertInteraction, deleteInteraction, useLeadActions, upsertLeadAction, deleteLeadAction } = useCrmData();

  const [form, setForm] = useState<any>({});
  const [interactionDialog, setInteractionDialog] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [lostReasonDialog, setLostReasonDialog] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const interactions = useLeadInteractions(lead?.id || null);
  const actions = useLeadActions(lead?.id || null);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        id: lead.id,
        name: lead.name || '',
        added_at: lead.added_at || new Date().toISOString().split('T')[0],
        source: lead.source || '',
        status: lead.status || 'lead',
        email: lead.email || '',
        phone: lead.phone || '',
        potential_product: lead.potential_product || '',
        closed_product: lead.closed_product || '',
        next_followup: lead.next_followup ? new Date(lead.next_followup) : undefined,
        followup_notes: lead.followup_notes || '',
        estimated_value: lead.estimated_value?.toString() || '',
        documents: lead.documents || '',
        context: lead.context || '',
        lost_reason: lead.lost_reason || '',
      });
    } else {
      setForm({
        name: '', added_at: new Date().toISOString().split('T')[0], source: '', status: 'lead',
        email: '', phone: '', potential_product: '', closed_product: '',
        next_followup: undefined, followup_notes: '', estimated_value: '', documents: '', context: '', lost_reason: '',
      });
    }
  }, [open, lead]);

  const set = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'perdido' && form.status !== 'perdido') {
      setPendingStatus(newStatus);
      setLostReasonDialog(true);
      return;
    }
    set({ status: newStatus });
  };

  const handleLostReasonConfirm = () => {
    set({ status: pendingStatus, lost_reason: lostReason });
    setLostReasonDialog(false);
    setLostReason('');
    setPendingStatus(null);
  };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error('Nome é obrigatório'); return; }
    onSave({
      ...(form.id ? { id: form.id } : {}),
      name: form.name,
      added_at: form.added_at,
      source: form.source || null,
      status: form.status,
      email: form.email || null,
      phone: form.phone || null,
      potential_product: form.potential_product || null,
      closed_product: form.closed_product || null,
      next_followup: form.next_followup ? format(form.next_followup, 'yyyy-MM-dd') : null,
      followup_notes: form.followup_notes || null,
      estimated_value: parseFloat(form.estimated_value) || 0,
      documents: form.documents || null,
      context: form.context || null,
      lost_reason: form.lost_reason || null,
    });
  };

  const handleAddAction = () => {
    if (!newAction.trim() || !lead?.id) return;
    upsertLeadAction.mutate({ lead_id: lead.id, task: newAction });
    setNewAction('');
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{form.id ? 'Ficha do Lead' : 'Nova Lead'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-4">
            {/* Core fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name || ''} onChange={e => set({ name: e.target.value })} />
              </div>
              <div>
                <Label>Adicionado</Label>
                <Input value={form.added_at || ''} disabled className="text-muted-foreground" />
              </div>
              <div>
                <Label>Fonte da Lead</Label>
                <Select value={form.source || ''} onValueChange={v => set({ source: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{CRM_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Status</Label>
                <Select value={form.status || 'lead'} onValueChange={handleStatusChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CRM_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input value={form.email || ''} onChange={e => set({ email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={e => set({ phone: e.target.value })} /></div>
              <div>
                <Label>Produto Potencial</Label>
                <Select value={form.potential_product || ''} onValueChange={v => set({ potential_product: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Produto Fechado</Label>
                <Select value={form.closed_product || ''} onValueChange={v => set({ closed_product: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Próximo Follow-up</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.next_followup && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.next_followup ? format(form.next_followup, 'dd/MM/yyyy') : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.next_followup} onSelect={d => set({ next_followup: d })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Valor Estimado (€)</Label>
                <Input type="number" step="0.01" value={form.estimated_value || ''} onChange={e => set({ estimated_value: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Notas FU</Label>
                <Input value={form.followup_notes || ''} onChange={e => set({ followup_notes: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Documentos (link)</Label>
                <Input value={form.documents || ''} onChange={e => set({ documents: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <Separator />

            {/* Context */}
            <div>
              <Label className="text-sm font-semibold">Contexto</Label>
              <Textarea className="mt-1" rows={3} value={form.context || ''} onChange={e => set({ context: e.target.value })} placeholder="Notas gerais sobre este lead..." />
            </div>

            {form.lost_reason && (
              <div>
                <Label className="text-sm font-semibold text-destructive">Motivo de Perda</Label>
                <p className="text-sm mt-1">{form.lost_reason}</p>
              </div>
            )}

            <Button className="w-full" onClick={handleSave}>Guardar</Button>

            {/* Interactions - only for saved leads */}
            {lead?.id && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Histórico de Interações</h3>
                    <Button variant="outline" size="sm" onClick={() => setInteractionDialog(true)}><Plus className="h-3 w-3 mr-1" />Nova</Button>
                  </div>
                  {(interactions.data || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem interações registadas.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="w-[90px]">Data</TableHead>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {(interactions.data || []).map((i: any) => (
                          <TableRow key={i.id}>
                            <TableCell className="text-xs">{i.interaction_date ? format(new Date(i.interaction_date), 'dd/MM/yy') : ''}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{INTERACTION_TYPES.find(t => t.value === i.interaction_type)?.label || i.interaction_type}</Badge></TableCell>
                            <TableCell className="text-xs">{i.notes || '—'}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteInteraction.mutate(i.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Actions checklist */}
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Lista de Ações</h3>
                  <div className="space-y-2">
                    {(actions.data || []).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={a.completed}
                          onCheckedChange={checked => upsertLeadAction.mutate({ id: a.id, lead_id: a.lead_id, completed: !!checked })}
                        />
                        <span className={cn("text-sm flex-1", a.completed && "line-through text-muted-foreground")}>{a.task}</span>
                        {a.deadline && <span className="text-xs text-muted-foreground">{format(new Date(a.deadline), 'dd/MM')}</span>}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLeadAction.mutate(a.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Nova ação..." value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAction()} />
                    <Button size="sm" variant="outline" onClick={handleAddAction}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              </>
            )}

            {/* Delete */}
            {lead?.id && onDelete && (
              <>
                <Separator />
                <Button variant="destructive" size="sm" className="w-full" onClick={() => { onDelete(lead.id); onOpenChange(false); }}>
                  Eliminar Lead
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* New Interaction Dialog */}
      <InteractionDialog
        open={interactionDialog}
        onOpenChange={setInteractionDialog}
        leadId={lead?.id}
        onSave={rec => { upsertInteraction.mutate(rec); setInteractionDialog(false); }}
      />

      {/* Lost Reason Dialog */}
      <Dialog open={lostReasonDialog} onOpenChange={v => { if (!v) { setLostReasonDialog(false); setPendingStatus(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Motivo de Perda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (opcional)</Label>
            <Textarea value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Ex: Orçamento insuficiente, timing..." />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setLostReasonDialog(false); setPendingStatus(null); }}>Cancelar</Button>
              <Button className="flex-1" onClick={handleLostReasonConfirm}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Interaction Dialog ─── */
function InteractionDialog({ open, onOpenChange, leadId, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; leadId?: string; onSave: (r: any) => void }) {
  const [form, setForm] = useState({ interaction_date: new Date(), interaction_type: 'outro', notes: '', files: '' });

  useEffect(() => {
    if (open) setForm({ interaction_date: new Date(), interaction_type: 'outro', notes: '', files: '' });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova Interação</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(form.interaction_date, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.interaction_date} onSelect={d => d && setForm(f => ({ ...f, interaction_date: d }))} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.interaction_type} onValueChange={v => setForm(f => ({ ...f, interaction_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div><Label>Ficheiros (link)</Label><Input value={form.files} onChange={e => setForm(f => ({ ...f, files: e.target.value }))} placeholder="https://..." /></div>
          <Button className="w-full" onClick={() => onSave({
            lead_id: leadId,
            interaction_date: format(form.interaction_date, 'yyyy-MM-dd'),
            interaction_type: form.interaction_type,
            notes: form.notes || null,
            files: form.files || null,
          })}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
