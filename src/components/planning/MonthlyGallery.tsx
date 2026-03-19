import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, Calendar, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel, planAreaLabel } from '@/hooks/usePlanningData';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function monthRange(monthIdx: number, year: number) {
  const start = new Date(year, monthIdx, 1);
  const end = endOfMonth(start);
  return { start, end, label: `01/${String(monthIdx + 1).padStart(2, '0')} → ${format(end, 'dd/MM')}` };
}

interface Props {
  planning: any;
  year: number;
}

export function MonthlyGallery({ planning, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const goals = planning.allGoals || [];

  // Progress per month: goals with period = month name
  const monthProgress = useMemo(() => {
    return MONTHS.map((name, idx) => {
      const monthGoals = goals.filter((g: any) => g.period === name);
      if (monthGoals.length === 0) return 0;
      const achieved = monthGoals.filter((g: any) => g.status === 'atingido').length;
      return Math.round((achieved / monthGoals.length) * 100);
    });
  }, [goals]);

  if (selectedMonth !== null) {
    return (
      <MonthDetail
        monthIdx={selectedMonth}
        year={year}
        planning={planning}
        onBack={() => setSelectedMonth(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {MONTHS.map((name, idx) => {
        const range = monthRange(idx, year);
        const progress = monthProgress[idx];
        const isCurrent = new Date().getMonth() === idx && new Date().getFullYear() === year;
        const goalCount = goals.filter((g: any) => g.period === name).length;

        return (
          <Card
            key={idx}
            className={cn(
              'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group',
              isCurrent && 'ring-2 ring-primary'
            )}
            onClick={() => setSelectedMonth(idx)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-muted-foreground">{range.label}</p>
              {goalCount > 0 ? (
                <div className="space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{progress}% das metas atingidas</p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">Sem metas definidas</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── MONTH DETAIL ─── */

function MonthDetail({ monthIdx, year, planning, onBack }: { monthIdx: number; year: number; planning: any; onBack: () => void }) {
  const qc = useQueryClient();
  const monthName = MONTHS[monthIdx];
  const monthNum = monthIdx + 1;
  const range = monthRange(monthIdx, year);

  // ─── Data queries ─────────────────────────────────────────
  const salesQ = useQuery({
    queryKey: ['month-sales', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).eq('sale_month', monthNum);
      return data || [];
    },
  });

  const salesActionsQ = useQuery({
    queryKey: ['month-sales-actions', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('commercial_sales_actions').select('*');
      return (data || []).filter((a: any) => {
        if (!a.start_date) return false;
        const d = parseISO(a.start_date);
        return d >= range.start && d <= range.end;
      });
    },
  });

  const leadsQ = useQuery({
    queryKey: ['month-leads', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('crm_leads').select('*');
      return data || [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ['month-clients', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*');
      return data || [];
    },
  });

  const npsQ = useQuery({
    queryKey: ['month-nps', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('client_nps_records').select('*');
      return data || [];
    },
  });

  const projectsQ = useQuery({
    queryKey: ['month-projects', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return data || [];
    },
  });

  const tasksQ = useQuery({
    queryKey: ['month-tasks', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*');
      return data || [];
    },
  });

  const eventsQ = useQuery({
    queryKey: ['month-events', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*');
      return data || [];
    },
  });

  const contentQ = useQuery({
    queryKey: ['month-content', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('content_items').select('*');
      return data || [];
    },
  });

  const productsQ = useQuery({
    queryKey: ['month-products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client');
      return data || [];
    },
  });

  const timeEntriesQ = useQuery({
    queryKey: ['month-time-entries', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('entry_year', year).eq('entry_month', monthNum);
      return data || [];
    },
  });

  const checklistQ = useQuery({
    queryKey: ['month-checklist', year, monthNum],
    queryFn: async () => {
      const { data } = await supabase.from('executive_monthly_checklists').select('*').eq('year', year).eq('month', monthNum).order('created_at');
      return data || [];
    },
  });

  const addChecklist = useMutation({
    mutationFn: async (task: string) => {
      const { error } = await supabase.from('executive_monthly_checklists').insert({ year, month: monthNum, task, completed: false });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['month-checklist', year, monthNum] }),
  });

  const toggleChecklist = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('executive_monthly_checklists').update({ completed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['month-checklist', year, monthNum] }),
  });

  const deleteChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('executive_monthly_checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['month-checklist', year, monthNum] }),
  });

  const [newCheckItem, setNewCheckItem] = useState('');

  // ─── Filtered data ────────────────────────────────────────
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const monthGoals = goals.filter((g: any) => g.period === monthName);

  const sales = salesQ.data || [];
  const totalInvoiced = sales.reduce((s: number, v: any) => s + Number(v.invoice_total || 0), 0);
  const salesActions = salesActionsQ.data || [];

  const allLeads = leadsQ.data || [];
  const leadsThisMonth = allLeads.filter((l: any) => {
    if (!l.added_at) return false;
    const d = parseISO(l.added_at);
    return d >= range.start && d <= range.end;
  });
  const leadsWon = allLeads.filter((l: any) => {
    if (l.status !== 'ganho') return false;
    const d = parseISO(l.updated_at || l.created_at);
    return d >= range.start && d <= range.end;
  });
  const overdueFollowups = allLeads.filter((l: any) => {
    if (!l.next_followup || l.status === 'ganho' || l.status === 'perdido') return false;
    const d = parseISO(l.next_followup);
    return d <= range.end && d >= range.start;
  });

  const allClients = clientsQ.data || [];
  const onboardingClients = allClients.filter((c: any) => {
    if (!c.start_date) return false;
    const d = parseISO(c.start_date);
    return d >= range.start && d <= range.end;
  });
  const renewalClients = allClients.filter((c: any) => {
    if (!c.end_of_cycle) return false;
    const d = parseISO(c.end_of_cycle);
    return d >= range.start && d <= range.end;
  });
  const npsRecords = (npsQ.data || []).filter((n: any) => {
    if (!n.expected_date) return false;
    const d = parseISO(n.expected_date);
    return d >= range.start && d <= range.end;
  });

  const activeProjects = (projectsQ.data || []).filter((p: any) => {
    if (!p.start_date) return false;
    const pStart = parseISO(p.start_date);
    return pStart <= range.end;
  });

  const monthTasks = (tasksQ.data || []).filter((t: any) => {
    if (!t.deadline) return false;
    const d = parseISO(t.deadline);
    return d >= range.start && d <= range.end;
  });

  const monthEvents = (eventsQ.data || []).filter((e: any) => {
    if (!e.start_date) return false;
    const d = parseISO(e.start_date);
    return d >= range.start && d <= range.end;
  });

  const monthContent = (contentQ.data || []).filter((c: any) => {
    if (!c.scheduled_at) return false;
    const d = parseISO(c.scheduled_at);
    return d >= range.start && d <= range.end;
  });

  // ─── Revisão Operacional ──────────────────────────────────
  const products = productsQ.data || [];
  const timeEntries = timeEntriesQ.data || [];
  const activeClientsForMonth = allClients.filter((c: any) => c.status === 'ativo');

  const productReview = useMemo(() => {
    return products.map((p: any) => {
      const clientsWithProduct = activeClientsForMonth.filter((c: any) => c.current_product === p.name);
      const estimatedHours = (p.monthly_hours_per_client || 0) * clientsWithProduct.length;

      // Real hours: time entries linked to tasks associated to this product (by project/description)
      // Simple approach: sum all time for this month
      const realHours = timeEntries.reduce((s: number, e: any) => s + Number(e.duration || 0), 0);

      const deviation = realHours - estimatedHours;
      return {
        id: p.id,
        name: p.name,
        clientCount: clientsWithProduct.length,
        estimatedHours,
        realHours: 0, // placeholder - no direct link between time_entries and products
        deviation: 0,
      };
    }).filter((p: any) => p.clientCount > 0);
  }, [products, activeClientsForMonth, timeEntries]);

  // Goal target for the month (from monthly goals or commercial_monthly_goals)
  const monthGoalTarget = useMemo(() => {
    const facturacaoGoal = monthGoals.find((g: any) => {
      const obj = objectives.find((o: any) => o.id === g.objective_id);
      return obj?.area === 'financeiro' || obj?.area === 'comercial';
    });
    return facturacaoGoal ? Number(facturacaoGoal.target_value || 0) : 0;
  }, [monthGoals, objectives]);

  const checklist = checklistQ.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div>
          <h2 className="text-xl font-bold">{monthName} {year}</h2>
          <p className="text-xs text-muted-foreground">{range.label}</p>
        </div>
      </div>

      {/* 1 — Metas do Mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Metas do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {monthGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem metas definidas para {monthName}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Valor alvo</TableHead>
                  <TableHead className="text-right">Valor real</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                  <TableHead>Objetivo Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthGoals.map((g: any) => {
                  const obj = objectives.find((o: any) => o.id === g.objective_id);
                  const target = Number(g.target_value || 0);
                  const actual = Number(g.actual_value || 0);
                  const deviation = actual - target;
                  const isNeg = deviation < 0;
                  return (
                    <TableRow key={g.id}>
                      <TableCell><Badge variant="secondary" className="text-xs">{planStatusLabel(g.status)}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{obj?.title || '—'}</TableCell>
                      <TableCell className="text-sm">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                      <TableCell className="text-sm text-right">{target || '—'}</TableCell>
                      <TableCell className="text-sm text-right">{actual || '—'}</TableCell>
                      <TableCell className="text-right">
                        {target > 0 ? (
                          <Badge variant={isNeg ? 'destructive' : 'secondary'} className="text-xs">
                            {isNeg ? '' : '+'}{deviation}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{obj?.title || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 2 — Vendas & Faturação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Vendas & Faturação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Meta do mês</p>
              <p className="text-lg font-bold">{monthGoalTarget > 0 ? `${monthGoalTarget.toLocaleString('pt-PT')}€` : '—'}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Faturado</p>
              <p className="text-lg font-bold">{totalInvoiced.toLocaleString('pt-PT')}€</p>
            </div>
            {monthGoalTarget > 0 && (
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Progresso</p>
                <Progress value={Math.min(100, (totalInvoiced / monthGoalTarget) * 100)} className="h-2 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round((totalInvoiced / monthGoalTarget) * 100)}%</p>
              </div>
            )}
          </div>

          {sales.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.sale_id}</TableCell>
                    <TableCell className="text-sm">{s.client || '—'}</TableCell>
                    <TableCell className="text-sm">{s.product || '—'}</TableCell>
                    <TableCell className="text-sm text-right">{Number(s.invoice_total || 0).toLocaleString('pt-PT')}€</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-muted-foreground text-center py-2">Sem vendas registadas.</p>}

          {salesActions.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Ações de venda do mês</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ação</TableHead><TableHead>Produto</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {salesActions.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{a.action_name}</TableCell>
                      <TableCell className="text-sm">{a.product || '—'}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3 — Leads & Oportunidades */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Leads & Oportunidades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads adicionadas</p>
              <p className="text-xl font-bold">{leadsThisMonth.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Leads ganhas</p>
              <p className="text-xl font-bold">{leadsWon.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Follow-ups</p>
              <p className="text-xl font-bold">{overdueFollowups.length}</p>
            </div>
          </div>
          {leadsThisMonth.length > 0 && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Lead</TableHead><TableHead>Produto</TableHead><TableHead>Fonte</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leadsThisMonth.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm">{l.potential_product || '—'}</TableCell>
                    <TableCell className="text-sm">{l.source || '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 4 — Clientes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Onboarding</p>
              <p className="text-xl font-bold">{onboardingClients.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Renovações</p>
              <p className="text-xl font-bold">{renewalClients.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">NPS recolhas</p>
              <p className="text-xl font-bold">{npsRecords.length}</p>
            </div>
          </div>

          {npsRecords.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">NPS do mês</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">NPS</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {npsRecords.map((n: any) => {
                    const client = allClients.find((c: any) => c.id === n.client_id);
                    const product = products.find((p: any) => p.id === n.product_id);
                    return (
                      <TableRow key={n.id}>
                        <TableCell><Badge variant="secondary" className="text-xs">{n.status}</Badge></TableCell>
                        <TableCell className="text-sm">{client?.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{product?.name || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{n.nps_score ?? '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* 5 — Operação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Projetos ativos</p>
              <p className="text-xl font-bold">{activeProjects.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Tarefas</p>
              <p className="text-xl font-bold">{monthTasks.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Reuniões</p>
              <p className="text-xl font-bold">{monthEvents.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Conteúdos</p>
              <p className="text-xl font-bold">{monthContent.length}</p>
            </div>
          </div>

          {monthTasks.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">Tarefas do mês</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {monthTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                    <span className="truncate flex-1">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{t.status}</Badge>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {t.deadline ? format(parseISO(t.deadline), 'dd/MM') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {monthEvents.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Reuniões do mês</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {monthEvents.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{e.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(parseISO(e.start_date), 'dd/MM HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {monthContent.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground">Conteúdos do mês</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {monthContent.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40 text-sm">
                    <span className="truncate flex-1">{c.title}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{c.status}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 6 — Revisão Operacional */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revisão Operacional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {productReview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem produtos com clientes ativos para análise.</p>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">Horas estimadas</TableHead>
                  <TableHead className="text-right">Horas reais</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {productReview.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-right">{p.clientCount}</TableCell>
                      <TableCell className="text-sm text-right">{p.estimatedHours}h</TableCell>
                      <TableCell className="text-sm text-right">{p.realHours}h</TableCell>
                      <TableCell className="text-right">
                        {Math.abs(p.deviation) >= 10 ? (
                          <Badge variant="destructive" className="text-xs">
                            {p.deviation > 0 ? '+' : ''}{p.deviation}h
                          </Badge>
                        ) : (
                          <span className="text-sm">{p.deviation > 0 ? '+' : ''}{p.deviation}h</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Warnings */}
              {productReview.filter((p: any) => Math.abs(p.deviation) >= 10).map((p: any) => (
                <div key={p.id} className="rounded-md border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-800">
                      O produto <strong>{p.name}</strong> demorou <strong>{Math.abs(p.deviation)}h</strong> {p.deviation > 0 ? 'a mais' : 'a menos'} do que o estimado este mês. Considera rever as horas definidas no produto.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0">
                    <ExternalLink className="h-3 w-3" /> Ver produto
                  </Button>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 7 — Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Checklist do Mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCheckItem}
              onChange={e => setNewCheckItem(e.target.value)}
              placeholder="Adicionar item..."
              className="h-8 text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && newCheckItem.trim()) {
                  addChecklist.mutate(newCheckItem.trim());
                  setNewCheckItem('');
                }
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1"
              disabled={!newCheckItem.trim()}
              onClick={() => { addChecklist.mutate(newCheckItem.trim()); setNewCheckItem(''); }}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>

          {checklist.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item na checklist.</p>
          ) : (
            <div className="space-y-1">
              {checklist.map((item: any) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/40">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(v) => toggleChecklist.mutate({ id: item.id, completed: !!v })}
                  />
                  <span className={cn('text-sm flex-1', item.completed && 'line-through text-muted-foreground')}>{item.task}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteChecklist.mutate(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
