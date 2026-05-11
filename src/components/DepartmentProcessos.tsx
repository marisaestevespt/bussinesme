import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlanningRoutines, generateTasksForRoutine } from '@/hooks/usePlanningRoutines';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, FileText, RotateCw, MessageSquare, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { SOP_STATUSES, getSopStatusInfo as getStatusInfo } from '@/lib/sopStatus';
import { RoutineFormFields } from '@/components/routines/RoutineFormFields';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { SOP_TEMPLATES, type SopTemplate } from '@/components/sop/SOP_TEMPLATES';
import { ProcessCover } from '@/components/processes/ProcessCover';
import { getDept } from '@/lib/departments';

interface DepartmentProcessosProps {
  department: string;
}

export function DepartmentProcessos({ department }: DepartmentProcessosProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const planningRoutines = usePlanningRoutines();

  // SOP dialog state
  const [showNewSop, setShowNewSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');
  const [newSopTemplate, setNewSopTemplate] = useState<SopTemplate | null>(null);
  const [newSopObjetivo, setNewSopObjetivo] = useState('');
  const [sopPickerOpen, setSopPickerOpen] = useState(false);


  // Routine dialog state
  const [showNewRoutine, setShowNewRoutine] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prRoleFunction, setPrRoleFunction] = useState('');
  const [prRoleCustom, setPrRoleCustom] = useState('');
  const [prRoleOpen, setPrRoleOpen] = useState(false);
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);
  const [prHour, setPrHour] = useState('09:00');

  // Queries
  const { data: sops = [] } = useQuery({
    queryKey: ['sops', department],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').contains('departments', [department]).order('sop_id');
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, role_title, profile_id, photo_url').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });

  const existingRoles = [...new Set(teamMembers.map(m => m.role_title).filter(Boolean))] as string[];


  const routinesData = (planningRoutines.routines.data || []).filter((r: any) => r.department === department);

  // Mutations
  const createSop = useMutation({
    mutationFn: async () => {
      const { data: sopData, error } = await supabase.from('sops').insert({
        name: newSopName,
        department,
        departments: [department],
        status: newSopStatus,
        sop_type: newSopTemplate?.defaultSopType || 'operacional',
        objetivo: newSopObjetivo.trim() || null,
        created_by: user?.id,
      } as any).select('id').single();
      if (error) throw error;
      if (newSopTemplate && newSopTemplate.defaultSteps.length > 0 && sopData?.id) {
        const stepRows = newSopTemplate.defaultSteps.map((description, idx) => ({
          sop_id: sopData.id,
          description,
          sort_order: idx,
        }));
        await (supabase.from as any)('sop_steps').insert(stepRows);
      }
      return sopData;
    },
    onSuccess: (sopData: any) => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      setShowNewSop(false);
      setNewSopName('');
      setNewSopStatus('para_criar');
      setNewSopObjetivo('');
      setNewSopTemplate(null);
      toast.success('Processo criado');
      if (sopData?.id) navigate(`/hub/processos/${sopData.id}`);
    },
    onError: () => toast.error('Erro ao criar processo'),
  });

  function resetRoutineDialog() {
    setPrTitle(''); setPrRoleFunction(''); setPrRoleCustom(''); setPrRecurrence('semanal');
    setPrWeekday('1'); setPrMonthDay('1'); setPrAdjustBiz(true); setPrHour('09:00');
  }

  async function handleCreateRoutine() {
    const routineData: any = {
      title: prTitle,
      responsible: null,
      role_function: prRoleFunction || null,
      recurrence_type: prRecurrence,
      weekday: prRecurrence === 'semanal' ? Number(prWeekday) : null,
      month_day: prRecurrence === 'mensal' ? Number(prMonthDay) : null,
      adjust_to_business_day: prRecurrence === 'mensal' ? prAdjustBiz : true,
      hour_time: prHour || '09:00',
      created_by: user?.id,
      department: department,
    };

    const { data: routineResult, error: routineError } = await supabase
      .from('planning_routines')
      .insert(routineData)
      .select('*')
      .single();

    if (routineError || !routineResult) {
      toast.error('Erro ao criar rotina: ' + (routineError?.message || ''));
      return;
    }

    await generateTasksForRoutine(routineResult as any, new Date().getFullYear());

    // Create linked SOP
    const { data: sopData } = await supabase.from('sops').insert({
      name: prTitle,
      department,
      departments: [department],
      status: 'ativo',
      created_by: user?.id,
      routine_id: routineResult.id,
    } as any).select('id').single();

    qc.invalidateQueries({ queryKey: ['sops'] });
    qc.invalidateQueries({ queryKey: ['planning-routines'] });
    qc.invalidateQueries({ queryKey: ['my-tasks'] });

    setShowNewRoutine(false);
    resetRoutineDialog();
    toast.success('Rotina criada e tarefas geradas');

    if (sopData?.id) {
      navigate(`/hub/processos/${sopData.id}`);
    }
  }

  return (
    <>
      <div className="space-y-8">
        {/* WhatsApp department link */}
        <DeptWhatsAppCard department={department} />

        {/* SOPs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Processos (SOPs)</h3>
            <Popover open={sopPickerOpen} onOpenChange={setSopPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Processo</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-1.5">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Escolher template</p>
                </div>
                <div className="space-y-0.5">
                  {SOP_TEMPLATES.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        onClick={() => {
                          setNewSopTemplate(t);
                          setNewSopObjetivo(t.defaultObjetivo || '');
                          setSopPickerOpen(false);
                          setShowNewSop(true);
                        }}
                        className="w-full flex items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {sops.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem processos neste departamento</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sops.map((s: any) => {
                const st = getStatusInfo(s.status);
                const deptInfo = getDept(department);
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/hub/processos/${s.id}`)}
                    className="group text-left rounded-xl overflow-hidden border border-border bg-card hover:shadow-md hq-transition focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <ProcessCover
                      className="h-28"
                      imageUrl={s.cover_url}
                      onUpload={async (url) => {
                        await supabase.from('sops').update({ cover_url: url }).eq('id', s.id);
                        qc.invalidateQueries({ queryKey: ['sops'] });
                      }}
                      fallback={
                        <span className="text-2xl opacity-40 group-hover:opacity-60 transition-opacity">
                          {deptInfo?.icon || '📄'}
                        </span>
                      }
                    />
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] text-muted-foreground">{s.sop_id}</p>
                          <h4 className="text-sm font-semibold text-foreground line-clamp-2">{s.name}</h4>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', st.color)}>{st.label}</Badge>
                      </div>
                      {s.product_name && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">📦 {s.product_name}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Separator />

        {/* Rotinas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-primary" /> Rotinas
            </h3>
            <Button size="sm" variant="outline" onClick={() => setShowNewRoutine(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Rotina
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routinesData.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem rotinas neste departamento</TableCell></TableRow>
                )}
                {routinesData.map((pr: any) => {
                  const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                  const recLabel = pr.recurrence_type === 'semanal'
                    ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                    : `Mensal — dia ${pr.month_day}${hourLabel}`;
                  // Find linked SOP
                  const linkedSop = sops.find((s: any) => s.routine_id === pr.id);
                  return (
                    <TableRow
 key={pr.id}
 className={cn("cursor-pointer", linkedSop &&"hover:bg-muted/50")}
 onClick={() => { if (linkedSop) navigate(`/hub/processos/${linkedSop.id}`); }}
                    >
                      <TableCell className="font-medium">{pr.title}</TableCell>
                      <TableCell>{recLabel}</TableCell>
                      <TableCell>
                        {pr.role_function ? (
                          <Badge variant="outline" className="text-xs">{pr.role_function}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px]">
                          {pr.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Switch
                            checked={pr.active}
                            onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                            className="scale-75"
                          />
                          <Button variant="ghost" aria-label="Eliminar" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>

      {/* Dialog: Novo Processo */}
      <Dialog open={showNewSop} onOpenChange={v => { if (!v) { setShowNewSop(false); setNewSopName(''); setNewSopObjetivo(''); setNewSopTemplate(null); } else setShowNewSop(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Processo (SOP)</DialogTitle>
            {newSopTemplate && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <FileText className="h-3 w-3" /> Template: <span className="font-medium text-foreground">{newSopTemplate.label}</span>
                {newSopTemplate.defaultSteps.length > 0 && (
                  <span>· {newSopTemplate.defaultSteps.length} passos pré-preenchidos</span>
                )}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do processo *</Label>
              <Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Onboarding de cliente" />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={newSopObjetivo} onChange={e => setNewSopObjetivo(e.target.value)} placeholder="O que se pretende alcançar?" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newSopName.trim() || createSop.isPending} onClick={() => createSop.mutate()}>
              {createSop.isPending ? 'A criar...' : 'Criar Processo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Rotina */}
      <Dialog open={showNewRoutine} onOpenChange={v => { if (!v) { setShowNewRoutine(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <RoutineFormFields
              title={prTitle} onTitleChange={setPrTitle}
              roleFunction={prRoleFunction} onRoleFunctionChange={setPrRoleFunction}
              roleCustom={prRoleCustom} onRoleCustomChange={setPrRoleCustom}
              roleOpen={prRoleOpen} onRoleOpenChange={setPrRoleOpen}
              existingRoles={existingRoles}
              recurrence={prRecurrence} onRecurrenceChange={setPrRecurrence}
              weekday={prWeekday} onWeekdayChange={setPrWeekday}
              monthDay={prMonthDay} onMonthDayChange={setPrMonthDay}
              hour={prHour} onHourChange={setPrHour}
              adjustBiz={prAdjustBiz} onAdjustBizChange={setPrAdjustBiz}
            />

            <Separator />

            <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm text-muted-foreground">
              <p>Será criado automaticamente um processo (SOP) vinculado a esta rotina.</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Nome: <strong className="text-foreground">{prTitle || '(título da rotina)'}</strong></li>
                <li>Frequência: <strong className="text-foreground">{prRecurrence === 'semanal' ? 'Semanal' : 'Mensal'}</strong></li>
              </ul>
            </div>

            <Button
              className="w-full"
              disabled={!prTitle.trim()}
              onClick={handleCreateRoutine}
            >
              Criar Rotina
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}

// ─── Dept WhatsApp Card ──────────────────────────────────────────
function DeptWhatsAppCard({ department }: { department: string }) {
  const { isOwner } = useAuth();
  const { canAccess } = usePermissions();
  const isAdmin = isOwner || canAccess('admin' as any);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: linkRow } = useQuery({
    queryKey: ['dept-whatsapp', department],
    queryFn: async () => {
      const { data } = await supabase.from('department_whatsapp_links').select('*').eq('department', department).maybeSingle();
      return data;
    },
  });

  const url = (linkRow as any)?.whatsapp_url || '';

  const saveMut = useMutation({
    mutationFn: async (newUrl: string) => {
      if (linkRow) {
        await supabase.from('department_whatsapp_links').update({ whatsapp_url: newUrl, updated_at: new Date().toISOString() } as any).eq('id', (linkRow as any).id);
      } else {
        await supabase.from('department_whatsapp_links').insert({ department, whatsapp_url: newUrl } as any);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dept-whatsapp', department] }); toast.success('Link guardado'); setEditing(false); },
    onError: () => toast.error('Não consegui guardar a processo. Tenta novamente.'),
  });

  if (!url && !isAdmin) return null;

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="h-7 text-xs flex-1 max-w-sm" autoFocus />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveMut.mutate(draft.trim())} disabled={saveMut.isPending}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-typewriter text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary/80 flex items-center gap-2 transition-colors">
          <MessageSquare className="h-3 w-3" /> Grupo de WhatsApp do Departamento <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : (
        <span className="font-typewriter text-[11px] text-muted-foreground italic flex items-center gap-2">
          <MessageSquare className="h-3 w-3" /> sem link de grupo
        </span>
      )}
      {isAdmin && (
        <button className="text-muted-foreground/60 hover:text-primary transition-colors" onClick={() => { setDraft(url); setEditing(true); }}>
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
