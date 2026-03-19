import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Plus, Target, ListChecks, CalendarDays, BarChart3, Trash2, X } from 'lucide-react';
import { useExecutiveData, OBJECTIVE_AREAS, OBJECTIVE_STATUSES, GOAL_STATUSES, areaLabel, statusLabel, getMonthName, getQuarterMonths } from '@/hooks/useExecutiveData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const currentYear = new Date().getFullYear();

// ─── Objective Form Dialog ──────────────────
const DEFAULT_OBJECTIVE = { title: '', description: '', area: 'outro', deadline: '', status: 'por_iniciar' };
function ObjectiveDialog({ open, onClose, initial, onSave }: any) {
  const [form, setForm] = useState({ ...DEFAULT_OBJECTIVE, ...(initial || {}) });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  useEffect(() => { setForm({ ...DEFAULT_OBJECTIVE, ...(initial || {}) }); }, [initial]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial?.id ? 'Editar Objetivo' : 'Novo Objetivo'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={form.title} onChange={e => set('title', e.target.value)} />
          <Textarea placeholder="Descrição" value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
          <Select value={form.area} onValueChange={v => set('area', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OBJECTIVE_AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OBJECTIVE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={form.deadline || ''} onChange={e => set('deadline', e.target.value)} />
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...form }); onClose(false); }} disabled={!form.title.trim()}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Goal Form Dialog ──────────────────
const DEFAULT_GOAL = { meta: '', area: 'outro', status: 'por_iniciar', target_date: '', achieved_date: '', objective_id: '' };
function GoalDialog({ open, onClose, initial, onSave, objectives }: any) {
  const [form, setForm] = useState({ ...DEFAULT_GOAL, ...(initial || {}) });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  useEffect(() => { setForm({ ...DEFAULT_GOAL, ...(initial || {}) }); }, [initial]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial?.id ? 'Editar Meta' : 'Nova Meta'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Meta" value={form.meta} onChange={e => set('meta', e.target.value)} />
          <Select value={form.area} onValueChange={v => set('area', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{OBJECTIVE_AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GOAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Data meta</label><Input type="date" value={form.target_date || ''} onChange={e => set('target_date', e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Data atingida</label><Input type="date" value={form.achieved_date || ''} onChange={e => set('achieved_date', e.target.value)} /></div>
          </div>
          <Select value={form.objective_id || '_none'} onValueChange={v => set('objective_id', v === '_none' ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Objetivo anual" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sem objetivo</SelectItem>
              {objectives.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...form }); onClose(false); }} disabled={!form.meta.trim()}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Month Detail Sheet ──────────────────
function MonthDetailSheet({ open, onClose, month, year, exec }: any) {
  const goals = exec.goalsForMonth(month);
  const prog = exec.monthProgress(month);
  const checklists = (exec.monthlyChecklists.data || []).filter((c: any) => c.month === month);
  const [newCheck, setNewCheck] = useState('');

  // Fetch related data
  const events = useQuery({
    queryKey: ['events-month', month, year],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
      const { data } = await supabase.from('events').select('*').gte('start_date', start).lte('start_date', end + 'T23:59:59').order('start_date');
      return data || [];
    }, enabled: open,
  });

  const sales = useQuery({
    queryKey: ['sales-month', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_month', month).eq('sale_year', year);
      return data || [];
    }, enabled: open,
  });

  const leads = useQuery({
    queryKey: ['leads-active'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*').not('status', 'in', '("ganho","perdido")');
      return data || [];
    }, enabled: open,
  });

  const clients = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('status', 'ativo');
      return data || [];
    }, enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{getMonthName(month)} {year}</SheetTitle></SheetHeader>
        <div className="space-y-6 mt-4">
          {/* Progress */}
          <div><div className="flex justify-between text-sm mb-1"><span>Progresso</span><span>{prog}%</span></div><Progress value={prog} className="h-2" /></div>
          <Separator />

          {/* Metas */}
          <div><h3 className="text-sm font-semibold mb-2">Em detalhe — Metas do mês</h3>
            {goals.length === 0 ? <p className="text-xs text-muted-foreground">Sem metas</p> :
              goals.map((g: any) => (
                <div key={g.id} className="flex items-center gap-2 py-1">
                  <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{statusLabel(g.status)}</Badge>
                  <span className="text-sm">{g.meta}</span>
                </div>
              ))
            }
          </div>
          <Separator />

          {/* Objetivos */}
          <div><h3 className="text-sm font-semibold mb-2">Objetivos associados</h3>
            {exec.allObjectives.filter((o: any) => goals.some((g: any) => g.objective_id === o.id)).map((o: any) => (
              <div key={o.id} className="text-sm py-1">• {o.title}</div>
            ))}
            {exec.allObjectives.filter((o: any) => goals.some((g: any) => g.objective_id === o.id)).length === 0 && <p className="text-xs text-muted-foreground">Nenhum</p>}
          </div>
          <Separator />

          {/* Agenda */}
          <div><h3 className="text-sm font-semibold mb-2">Agenda</h3>
            {(events.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos</p> :
              (events.data || []).slice(0, 10).map((e: any) => (
                <div key={e.id} className="text-sm py-1 flex justify-between">
                  <span>{e.title}</span><span className="text-xs text-muted-foreground">{e.start_date?.slice(0, 10)}</span>
                </div>
              ))
            }
          </div>
          <Separator />

          {/* Vendas */}
          <div><h3 className="text-sm font-semibold mb-2">Produtos & Vendas</h3>
            <p className="text-sm">{(sales.data || []).length} vendas — Total: €{(sales.data || []).reduce((s: number, v: any) => s + Number(v.invoice_total || 0), 0).toLocaleString()}</p>
          </div>
          <Separator />

          {/* CRM */}
          <div><h3 className="text-sm font-semibold mb-2">CRM — Leads ativos</h3>
            <p className="text-sm">{(leads.data || []).length} leads em aberto</p>
          </div>
          <Separator />

          {/* Clientes */}
          <div><h3 className="text-sm font-semibold mb-2">Clientes Ativos</h3>
            <p className="text-sm">{(clients.data || []).length} clientes ativos</p>
          </div>
          <Separator />

          {/* Checklists */}
          <div><h3 className="text-sm font-semibold mb-2">Checklists</h3>
            <div className="flex gap-2 mb-2">
              <Input placeholder="Nova tarefa..." value={newCheck} onChange={e => setNewCheck(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCheck.trim()) { exec.addMonthlyCheckItem.mutate({ month, task: newCheck.trim() }); setNewCheck(''); }}} className="h-8 text-sm" />
              <Button size="sm" variant="ghost" className="h-8" onClick={() => { if (newCheck.trim()) { exec.addMonthlyCheckItem.mutate({ month, task: newCheck.trim() }); setNewCheck(''); }}}><Plus className="h-4 w-4" /></Button>
            </div>
            {checklists.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 group py-0.5">
                <Checkbox checked={c.completed} onCheckedChange={v => exec.toggleMonthlyCheckItem.mutate({ id: c.id, completed: !!v })} />
                <span className={`text-sm flex-1 ${c.completed ? 'line-through text-muted-foreground' : ''}`}>{c.task}</span>
                <button onClick={() => exec.deleteMonthlyCheckItem.mutate(c.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Quarter Detail Sheet ──────────────────
function QuarterDetailSheet({ open, onClose, quarter, year, exec }: any) {
  const months = getQuarterMonths(quarter);
  const qGoals = exec.goalsForQuarter(quarter);
  const prog = exec.quarterProgress(quarter);
  const analysis = (exec.quarterlyAnalysis.data || []).find((a: any) => a.quarter === quarter) || {};
  const [form, setForm] = useState({ went_well: analysis.went_well || '', went_wrong: analysis.went_wrong || '', lessons: analysis.lessons || '', adjustments: analysis.adjustments || '' });

  const events = useQuery({
    queryKey: ['events-quarter', quarter, year],
    queryFn: async () => {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const end = `${year}-${String(endMonth).padStart(2, '0')}-${new Date(year, endMonth, 0).getDate()}`;
      const { data } = await supabase.from('events').select('*').gte('start_date', start).lte('start_date', end + 'T23:59:59').order('start_date');
      return data || [];
    }, enabled: open,
  });

  const saveAnalysis = () => {
    exec.upsertQuarterlyAnalysis.mutate({ quarter, ...form });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>T{quarter} — {year}</SheetTitle></SheetHeader>
        <div className="space-y-6 mt-4">
          <div><div className="flex justify-between text-sm mb-1"><span>Progresso</span><span>{prog}%</span></div><Progress value={prog} className="h-2" /></div>
          <Separator />

          {/* 1 Objetivos */}
          <div><h3 className="text-sm font-semibold mb-2">1 // Objetivos</h3>
            {exec.allObjectives.filter((o: any) => qGoals.some((g: any) => g.objective_id === o.id)).map((o: any) => (
              <div key={o.id} className="text-sm py-1 flex items-center gap-2"><Target className="h-3 w-3 text-muted-foreground" />{o.title}</div>
            ))}
          </div>
          <Separator />

          {/* 2 Agenda */}
          <div><h3 className="text-sm font-semibold mb-2">2 // Agenda ME & Calendários</h3>
            {(events.data || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos</p> :
              (events.data || []).slice(0, 15).map((e: any) => (
                <div key={e.id} className="text-sm py-1 flex justify-between"><span>{e.title}</span><span className="text-xs text-muted-foreground">{e.start_date?.slice(0, 10)}</span></div>
              ))
            }
          </div>
          <Separator />

          {/* 3 Meses */}
          <div><h3 className="text-sm font-semibold mb-2">3 // Meses do Negócio</h3>
            <div className="grid gap-3">
              {months.map(m => (
                <div key={m} className="rounded-lg border p-3">
                  <div className="flex justify-between items-center mb-1"><span className="text-sm font-medium">{getMonthName(m)}</span><span className="text-xs text-muted-foreground">{exec.monthProgress(m)}%</span></div>
                  <Progress value={exec.monthProgress(m)} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{exec.goalsForMonth(m).length} metas</p>
                </div>
              ))}
            </div>
          </div>
          <Separator />

          {/* 4 Análise Final */}
          <div><h3 className="text-sm font-semibold mb-2">4 // Análise Final</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-medium">O que correu bem</label><Textarea value={form.went_well} onChange={e => setForm(p => ({ ...p, went_well: e.target.value }))} rows={2} /></div>
              <div><label className="text-xs font-medium">O que não correu</label><Textarea value={form.went_wrong} onChange={e => setForm(p => ({ ...p, went_wrong: e.target.value }))} rows={2} /></div>
              <div><label className="text-xs font-medium">O que aprender</label><Textarea value={form.lessons} onChange={e => setForm(p => ({ ...p, lessons: e.target.value }))} rows={2} /></div>
              <div><label className="text-xs font-medium">O que ajustar</label><Textarea value={form.adjustments} onChange={e => setForm(p => ({ ...p, adjustments: e.target.value }))} rows={2} /></div>
              <Button onClick={saveAnalysis} size="sm">Guardar Análise</Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Objective Detail Sheet ──────────────────
function ObjectiveDetailSheet({ open, onClose, objective, exec }: any) {
  if (!objective) return null;
  const goals = exec.goalsForObjective(objective.id);
  const prog = exec.objectiveProgress(objective.id);

  const monthlyGoals = goals.filter((g: any) => g.month);
  const quarterlyGoals = goals.filter((g: any) => g.quarter);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{objective.title}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Badge variant="outline">{areaLabel(objective.area)}</Badge>
            <Badge variant={objective.status === 'atingido' ? 'default' : 'secondary'}>{statusLabel(objective.status)}</Badge>
          </div>
          {objective.description && <p className="text-sm text-muted-foreground">{objective.description}</p>}
          <div><div className="flex justify-between text-sm mb-1"><span>Progresso</span><span>{prog}%</span></div><Progress value={prog} className="h-2" /></div>
          <Separator />
          <h3 className="text-sm font-semibold">Setup — Metas associadas</h3>
          {goals.length === 0 ? <p className="text-xs text-muted-foreground">Sem metas associadas</p> :
            <div className="space-y-2">
              {goals.map((g: any) => (
                <div key={g.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{statusLabel(g.status)}</Badge>
                  <span className="flex-1">{g.meta}</span>
                  {g.month && <span className="text-xs text-muted-foreground">{getMonthName(g.month)}</span>}
                </div>
              ))}
            </div>
          }
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ──────────────────────────────
export default function ExecutivePlaneamento() {
  const exec = useExecutiveData(currentYear);
  const [objDialog, setObjDialog] = useState<any>(null);
  const [goalDialog, setGoalDialog] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedObj, setSelectedObj] = useState<any>(null);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Planeamento Anual</h1>
          <p className="text-sm text-muted-foreground mt-1">{currentYear}</p>
        </div>

        {/* Navigation */}
        <Card id="nav">
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3">/ Gestão</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => scrollTo('objetivos')}><Target className="h-4 w-4 mr-1" /> Objetivos ME</Button>
              <Button variant="outline" size="sm" onClick={() => scrollTo('metas')}><ListChecks className="h-4 w-4 mr-1" /> Metas</Button>
              <Button variant="outline" size="sm" onClick={() => scrollTo('mensal')}><CalendarDays className="h-4 w-4 mr-1" /> Planeamento Mensal</Button>
              <Button variant="outline" size="sm" onClick={() => scrollTo('trimestral')}><BarChart3 className="h-4 w-4 mr-1" /> Planeamento Trimestral</Button>
            </div>
          </CardContent>
        </Card>

        {/* Objetivos ME */}
        <div id="objetivos" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">/ Objetivos ME</h2>
            <Button size="sm" onClick={() => setObjDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Objetivo</Button>
          </div>
          {exec.allObjectives.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem objetivos. Cria o primeiro!</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exec.allObjectives.map(obj => {
                const prog = exec.objectiveProgress(obj.id);
                return (
                  <Card key={obj.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedObj(obj)}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm">{obj.title}</h3>
                        <Badge variant={obj.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px] shrink-0">{statusLabel(obj.status)}</Badge>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{areaLabel(obj.area)}</Badge>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{prog}%</span>{obj.deadline && <span>Até {obj.deadline}</span>}</div>
                        <Progress value={prog} className="h-2" />
                      </div>
                      {obj.description && <p className="text-xs text-muted-foreground line-clamp-2">{obj.description}</p>}
                      <div className="flex gap-1 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setObjDialog(obj); }}>Editar</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={e => { e.stopPropagation(); exec.deleteObjective.mutate(obj.id); }}>Apagar</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Metas */}
        <div id="metas" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">/ Metas</h2>
            <Button size="sm" onClick={() => setGoalDialog({})}><Plus className="h-4 w-4 mr-1" /> Nova Meta</Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Data meta</TableHead>
                    <TableHead>Data atingida</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead>Trim.</TableHead>
                    <TableHead>Objetivo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exec.allGoals.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-8">Sem metas</TableCell></TableRow>
                  ) : exec.allGoals.map(g => (
                    <TableRow key={g.id}>
                      <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{statusLabel(g.status)}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{g.meta}</TableCell>
                      <TableCell className="text-xs">{areaLabel(g.area)}</TableCell>
                      <TableCell className="text-xs">{g.target_date || '—'}</TableCell>
                      <TableCell className="text-xs">{g.achieved_date || '—'}</TableCell>
                      <TableCell className="text-xs">{g.month ? getMonthName(g.month) : '—'}</TableCell>
                      <TableCell className="text-xs">{g.quarter ? `T${g.quarter}` : '—'}</TableCell>
                      <TableCell className="text-xs">{exec.allObjectives.find((o: any) => o.id === g.objective_id)?.title || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setGoalDialog(g)}>Editar</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => exec.deleteGoal.mutate(g.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <Separator />

        {/* Planeamento Mensal */}
        <div id="mensal" className="space-y-4">
          <h2 className="text-lg font-semibold">/ Planeamento Mensal</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const prog = exec.monthProgress(m);
              const lastDay = new Date(currentYear, m, 0).getDate();
              return (
                <Card key={m} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedMonth(m)}>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium text-sm">{getMonthName(m)}</h3>
                    <p className="text-xs text-muted-foreground">1 — {lastDay} {getMonthName(m)}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Progresso</span><span>{prog}%</span></div>
                      <Progress value={prog} className="h-2" />
                    </div>
                    <p className="text-xs text-muted-foreground">{exec.goalsForMonth(m).length} metas</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Planeamento Trimestral */}
        <div id="trimestral" className="space-y-4">
          <h2 className="text-lg font-semibold">/ Planeamento Trimestral</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(q => {
              const prog = exec.quarterProgress(q);
              const months = getQuarterMonths(q);
              return (
                <Card key={q} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedQuarter(q)}>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-medium text-sm">T{q}</h3>
                    <p className="text-xs text-muted-foreground">{getMonthName(months[0])} — {getMonthName(months[2])}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Progresso</span><span>{prog}%</span></div>
                      <Progress value={prog} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {objDialog !== null && (
        <ObjectiveDialog open={true} onClose={() => setObjDialog(null)} initial={objDialog} onSave={(o: any) => exec.upsertObjective.mutate(o)} />
      )}
      {goalDialog !== null && (
        <GoalDialog open={true} onClose={() => setGoalDialog(null)} initial={goalDialog} onSave={(g: any) => exec.upsertGoal.mutate(g)} objectives={exec.allObjectives} />
      )}
      {selectedMonth !== null && (
        <MonthDetailSheet open={true} onClose={() => setSelectedMonth(null)} month={selectedMonth} year={currentYear} exec={exec} />
      )}
      {selectedQuarter !== null && (
        <QuarterDetailSheet open={true} onClose={() => setSelectedQuarter(null)} quarter={selectedQuarter} year={currentYear} exec={exec} />
      )}
      {selectedObj && (
        <ObjectiveDetailSheet open={true} onClose={() => setSelectedObj(null)} objective={selectedObj} exec={exec} />
      )}
    </AppLayout>
  );
}
