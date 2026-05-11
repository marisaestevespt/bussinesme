import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useConfirm, usePrompt } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Pencil, Trash2, Clock, PlayCircle, CalendarDays, BookOpen, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolveProductId } from '@/lib/productResolver';
import { useCommercialData } from '@/hooks/useCommercialData';
import { RichTextEditor } from '@/components/RichTextEditor';

const STATUS_OPTIONS = [
  { value: 'por_comecar', label: 'Por Começar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_curso', label: 'Em Curso', color: 'bg-info/10 text-info' },
  { value: 'concluida', label: 'Concluída', color: 'bg-success/10 text-success' },
  { value: 'pausada', label: 'Pausada', color: 'bg-warning/10 text-warning' },
  { value: 'cancelada', label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
];

const DEFAULT_TYPE_OPTIONS = [
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'relancamento', label: 'Relançamento' },
  { value: 'campanha', label: 'Campanha' },
  { value: 'promocao', label: 'Promoção' },
  { value: 'sequencia_email', label: 'Sequência de Email' },
  { value: 'outro', label: 'Outro' },
];

const ACTIVE_STATUSES = ['por_comecar', 'em_curso'];
const HISTORY_STATUSES = ['concluida', 'pausada', 'cancelada'];

function statusLabel(val: string) {
  return STATUS_OPTIONS.find(o => o.value === val)?.label || val;
}
function statusColor(val: string) {
  return STATUS_OPTIONS.find(o => o.value === val)?.color || '';
}
function typeLabel(val: string) {
  return DEFAULT_TYPE_OPTIONS.find(o => o.value === val)?.label || val;
}

export function CommercialAcoes() {
  const qc = useQueryClient();
  const { productGoals } = useCommercialData();
  const products = (productGoals.data || []).map(p => p.product_name);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailAction, setDetailAction] = useState<any>(null);

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['commercial', 'sales-actions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales_actions')
        .select('*')
        .order('start_date', { ascending: true });
      return data || [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (record: any) => {
      // Resolve product_id from current product name to keep relational link.
      record.product_id = await resolveProductId(record.product);
      if (record.id) {
        const { error } = await supabase.from('commercial_sales_actions').update(record).eq('id', record.id);
        if (error) throw error;
      } else {
        delete record.id;
        const { error } = await supabase.from('commercial_sales_actions').insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial', 'sales-actions'] });
      toast.success('Ação guardada');
      setDialogOpen(false);
      setEditing(null);
    },
    onError: () => toast.error('Erro ao guardar ação'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commercial_sales_actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commercial', 'sales-actions'] });
      toast.success('Ação eliminada');
    },
  });

  const activeActions = useMemo(
    () => actions.filter((a: any) => ACTIVE_STATUSES.includes(a.status)).sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || '')),
    [actions]
  );
  const historyActions = useMemo(
    () => actions.filter((a: any) => HISTORY_STATUSES.includes(a.status)).sort((a: any, b: any) => (b.end_date || '').localeCompare(a.end_date || '')),
    [actions]
  );

  const countPorComecar = activeActions.filter((a: any) => a.status === 'por_comecar').length;
  const countEmCurso = activeActions.filter((a: any) => a.status === 'em_curso').length;
  const nextStartDate = activeActions.find((a: any) => a.start_date && new Date(a.start_date) >= new Date())?.start_date;

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setDialogOpen(true); };
  const openDetail = (a: any) => { setDetailAction(a); };

  return (
    <div className="space-y-8">
      {/* Summary + New button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Por Começar:</span>
            <span className="font-semibold">{countPorComecar}</span>
          </div>
          <div className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-info" />
            <span className="text-muted-foreground">Em Curso:</span>
            <span className="font-semibold">{countEmCurso}</span>
          </div>
          {nextStartDate && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Próximo início:</span>
              <span className="font-semibold">{format(new Date(nextStartDate), 'dd/MM/yyyy')}</span>
            </div>
          )}
        </div>
        <Button variant="soft" size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Ação</Button>
      </div>

      {/* Ações Ativas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ações Ativas</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead className="w-[110px]">Início</TableHead>
                  <TableHead className="w-[110px]">Fim</TableHead>
                  <TableHead className="w-[130px]">Produto</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeActions.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem ações ativas</TableCell></TableRow>
                )}
                {activeActions.map((a: any) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(a)}>
                    <TableCell><Badge variant="secondary" className={cn('text-xs', statusColor(a.status))}>{statusLabel(a.status)}</Badge></TableCell>
                    <TableCell className="font-medium">{a.action_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{typeLabel(a.action_type)}</TableCell>
                    <TableCell className="text-sm">{a.start_date ? format(new Date(a.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{a.end_date ? format(new Date(a.end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{a.product || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(a); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); remove.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Histórico */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Histórico</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="w-[140px]">Tipo</TableHead>
                  <TableHead className="w-[110px]">Fim</TableHead>
                  <TableHead className="w-[130px]">Produto</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyActions.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem histórico</TableCell></TableRow>
                )}
                {historyActions.map((a: any) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(a)}>
                    <TableCell><Badge variant="secondary" className={cn('text-xs', statusColor(a.status))}>{statusLabel(a.status)}</Badge></TableCell>
                    <TableCell className="font-medium">{a.action_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{typeLabel(a.action_type)}</TableCell>
                    <TableCell className="text-sm">{a.end_date ? format(new Date(a.end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{a.product || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{a.result || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(a); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); remove.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Form Dialog */}
      <ActionFormDialog
        open={dialogOpen}
        onOpenChange={v => { setDialogOpen(v); if (!v) setEditing(null); }}
        products={products}
        initialData={editing}
        onSave={record => upsert.mutate(record)}
      />

      {/* Detail Sheet */}
      <ActionDetailSheet
        action={detailAction}
        onClose={() => setDetailAction(null)}
        onEdit={(a) => { setDetailAction(null); openEdit(a); }}
      />
    </div>
  );
}

/* ─── Detail Sheet ─── */
function ActionDetailSheet({ action, onClose, onEdit }: {
  action: any;
  onClose: () => void;
  onEdit: (a: any) => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (action) {
      setNotes(action.notes || '');
    }
  }, [action]);

  const saveNotes = useCallback(async (content: string) => {
    if (!action?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('commercial_sales_actions')
        .update({ notes: content } as any)
        .eq('id', action.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['commercial', 'sales-actions'] });
    } catch {
      toast.error('Erro ao guardar notas');
    } finally {
      setSaving(false);
    }
  }, [action?.id, qc]);

  const handleNotesChange = (content: string) => {
    setNotes(content);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNotes(content), 1500);
  };

  const handleSaveToLibrary = async () => {
    if (!action) return;
    setSavingToLib(true);
    try {
      const { error } = await supabase.from('commercial_library_entries').insert({
        title: action.action_name,
        entry_type: action.action_type || 'outro',
        product: action.product || null,
        start_date: action.start_date || null,
        end_date: action.end_date || null,
        result: action.result || '',
        notes: notes || null,
        summary: action.objective || null,
      } as any);
      if (error) throw error;
      toast.success('Ação guardada na Biblioteca Comercial');
      qc.invalidateQueries({ queryKey: ['commercial-library'] });
    } catch {
      toast.error('Erro ao guardar na biblioteca');
    } finally {
      setSavingToLib(false);
    }
  };

  if (!action) return null;

  return (
    <Sheet open={!!action} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{action.action_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Meta info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={cn('text-xs', statusColor(action.status))}>
              {statusLabel(action.status)}
            </Badge>
            <Badge variant="outline" className="text-xs">{typeLabel(action.action_type)}</Badge>
            {action.product && <Badge variant="outline" className="text-xs">{action.product}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Início:</span>{' '}
              <span className="font-medium">{action.start_date ? format(new Date(action.start_date), 'dd/MM/yyyy') : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Fim:</span>{' '}
              <span className="font-medium">{action.end_date ? format(new Date(action.end_date), 'dd/MM/yyyy') : '—'}</span>
            </div>
          </div>

          {action.enrollment_open_date && (
            <div className="text-sm">
              <span className="text-muted-foreground">🚪 Abertura de vagas/vendas:</span>{' '}
              <span className="font-medium">{format(new Date(action.enrollment_open_date), 'dd/MM/yyyy')}</span>
            </div>
          )}

          {action.objective && (
            <div className="text-sm">
              <span className="text-muted-foreground">Objetivo:</span>{' '}
              <span>{action.objective}</span>
            </div>
          )}

          {action.result && (
            <div className="text-sm">
              <span className="text-muted-foreground">Resultado:</span>{' '}
              <span>{action.result}</span>
            </div>
          )}

          <Separator />

          {/* Notes with rich text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Notas</Label>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {!saving && notes !== (action.notes || '') && (
                <span className="text-xs text-muted-foreground animate-pulse">A guardar...</span>
              )}
            </div>
            <div className="min-h-[200px] border rounded-md">
              <RichTextEditor
                content={notes}
                onChange={handleNotesChange}
                editable={true}
              />
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="gap-2 w-full"
              onClick={handleSaveToLibrary}
              disabled={savingToLib}
            >
              {savingToLib ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              Guardar na Biblioteca
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => onEdit(action)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar campos
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Form Dialog ─── */
function ActionFormDialog({ open, onOpenChange, products, initialData, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: string[];
  initialData?: any;
  onSave: (r: any) => void;
}) {
  const [form, setForm] = useState(empty());
  const [showProject, setShowProject] = useState(false);
  const askText = usePrompt();

  const { data: existingTypes = [] } = useQuery({
    queryKey: ['commercial', 'sales-action-types'],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions').select('action_type');
      const unique = [...new Set((data || []).map(r => r.action_type).filter(Boolean))];
      return unique;
    },
  });

  const typeOptions = useMemo(() => {
    const defaultValues = DEFAULT_TYPE_OPTIONS.map(o => o.value);
    const custom = existingTypes.filter(t => !defaultValues.includes(t));
    return [
      ...DEFAULT_TYPE_OPTIONS,
      ...custom.map(t => ({ value: t, label: t })),
    ];
  }, [existingTypes]);

  function empty() {
    return { id: '', status: 'por_comecar', action_name: '', action_type: 'outro', start_date: undefined as Date | undefined, end_date: undefined as Date | undefined, enrollment_open_date: undefined as Date | undefined, product: '', objective: '', result: '', project_id: '' };
  }

  const hasProject = showProject || !!form.project_id;

  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects-list-names'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name').is('archived_at', null);
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        id: initialData.id,
        status: initialData.status || 'por_comecar',
        action_name: initialData.action_name || '',
        action_type: initialData.action_type || 'outro',
        start_date: initialData.start_date ? new Date(initialData.start_date) : undefined,
        end_date: initialData.end_date ? new Date(initialData.end_date) : undefined,
        enrollment_open_date: initialData.enrollment_open_date ? new Date(initialData.enrollment_open_date) : undefined,
        product: initialData.product || '',
        objective: initialData.objective || '',
        result: initialData.result || '',
        project_id: initialData.project_id || '',
      });
      setShowProject(!!initialData.project_id);
    } else {
      setForm(empty());
      setShowProject(false);
    }
  }, [open, initialData]);

  const handleSave = () => {
    if (!form.action_name.trim()) { toast.error('Nome da ação é obrigatório'); return; }
    onSave({
      ...(form.id ? { id: form.id } : {}),
      status: form.status,
      action_name: form.action_name,
      action_type: form.action_type,
      start_date: form.start_date ? format(form.start_date, 'yyyy-MM-dd') : null,
      end_date: form.end_date ? format(form.end_date, 'yyyy-MM-dd') : null,
      enrollment_open_date: form.enrollment_open_date ? format(form.enrollment_open_date, 'yyyy-MM-dd') : null,
      product: form.product || null,
      objective: form.objective || null,
      result: form.result || null,
      project_id: form.project_id || null,
    });
  };

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Editar Ação' : 'Nova Ação'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Ação *</Label>
            <Input value={form.action_name} onChange={e => set({ action_name: e.target.value })} placeholder="Ex: Relançamento Produto A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.action_type} onValueChange={v => {
                if (v === '__custom_type__') {
                  askText({
                    title: 'Novo tipo de ação',
                    label: 'Nome do tipo',
                    placeholder: 'Ex: Webinar, Sessão estratégica...',
                    confirmText: 'Adicionar',
                  }).then((custom) => {
                    if (custom) set({ action_type: custom });
                  });
                  return;
                }
                set({ action_type: v });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  <SelectItem value="__custom_type__">+ Adicionar outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.start_date ? format(form.start_date, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.start_date} onSelect={d => set({ start_date: d })} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.end_date ? format(form.end_date, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.end_date} onSelect={d => set({ end_date: d })} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div>
            <Label>🚪 Abertura de vagas/vendas <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.enrollment_open_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.enrollment_open_date ? format(form.enrollment_open_date, 'dd/MM/yyyy') : 'Selecionar data de abertura'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.enrollment_open_date} onSelect={d => set({ enrollment_open_date: d })} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">Aparece como evento próprio na agenda, com a cor do produto.</p>
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={form.product} onValueChange={v => set({ product: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                {products.length === 0 && <SelectItem value="_none" disabled>Sem produtos definidos</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Objetivo</Label>
            <Input value={form.objective} onChange={e => set({ objective: e.target.value })} placeholder="O que se pretende atingir" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="has-project"
              checked={hasProject}
              onCheckedChange={(checked) => {
                setShowProject(!!checked);
                if (!checked) set({ project_id: '' });
              }}
            />
            <Label htmlFor="has-project" className="cursor-pointer">Há projeto associado?</Label>
          </div>
          {hasProject && (
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => set({ project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  {projectsList.length === 0 && <SelectItem value="_none" disabled>Sem projetos</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Resultado</Label>
            <Input value={form.result} onChange={e => set({ result: e.target.value })} placeholder="Resultado após conclusão" />
          </div>
          <Button variant="soft" className="w-full" onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
