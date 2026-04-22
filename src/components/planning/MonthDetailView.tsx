import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, ArrowLeft, Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, FileBarChart, Play, Plus, Trash2, UserPlus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { planStatusLabel, planAreaLabel } from '@/hooks/usePlanningData';
import { format, parseISO, endOfMonth, startOfMonth, getDay, getDaysInMonth, addMonths, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ObjectiveDetailSheet } from './ObjectiveDetailSheet';
import { ObjectiveDialog } from './ObjectiveDialog';
import { WeeklyAlignDetailSheet, type DetailField } from '@/components/executive/WeeklyAlignDetailSheet';
import { BackNavigation } from '@/components/BackNavigation';
import { CLIENT_STATUS_OPTIONS } from '@/hooks/useClients';
import { LeadDetailSheet } from '@/components/commercial/crm/LeadDetailSheet';
import { useCrmData, CRM_STATUSES } from '@/hooks/useCrmData';
import { sumRevenue } from '@/lib/salesCalculations';
import { isTaskDone, isTaskOpen } from '@/lib/taskStatus';
import { monthlyCapacity } from '@/lib/memberCapacity';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function monthRange(monthIdx: number, year: number) {
  const start = new Date(year, monthIdx, 1);
  const end = endOfMonth(start);
  return { start, end, label: `01/${String(monthIdx+1).padStart(2,'0')}/${year} → ${format(end,'dd/MM/yyyy')}` };
}


interface Props {
  monthIdx: number;
  year: number;
  planning: any;
  onBack: () => void;
}

export function MonthDetailView({ monthIdx, year, planning, onBack }: Props) {
  const qc = useQueryClient();
  const monthName = MONTHS[monthIdx];
  const monthNum = monthIdx + 1;
  const range = monthRange(monthIdx, year);

  // ── Active tab states ──
  const [objTab, setObjTab] = useState<'metas'|'objetivos'>('metas');
  const [vendasTab, setVendasTab] = useState<'goal'|'real'>('goal');
  const [clientTab, setClientTab] = useState<'ativos'|'pausados'|'terminar'>('ativos');
  const [contentTab, setContentTab] = useState('calendario');
  const [calMonth, setCalMonth] = useState(new Date(year, monthIdx, 1));
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [objDialogOpen, setObjDialogOpen] = useState(false);
  const [selectedRoutineTask, setSelectedRoutineTask] = useState<any>(null);
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalEditValue, setGoalEditValue] = useState('');
  const navigate = useNavigate();
  const [expandedClient, setExpandedClient] = useState<{ clientId: string; clientName: string; clientCode: string; estimated: number; realHours: number; deviation: number; productName: string } | null>(null);
  const [convertLead, setConvertLead] = useState<any>(null);
  const [convertForm, setConvertForm] = useState<Record<string, string>>({});
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const { upsertLead, deleteLead } = useCrmData();

  // ── Data queries ──
  const salesQ = useQuery({ queryKey: ['md-sales', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).eq('sale_month', monthNum); return data || []; }});
  const salesActionsQ = useQuery({ queryKey: ['md-sales-actions', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_sales_actions').select('*'); return (data || []).filter((a: any) => { if (!a.start_date) return false; const d = parseISO(a.start_date); return d >= range.start && d <= range.end; }); }});
  const leadsQ = useQuery({ queryKey: ['md-leads', year, monthNum], queryFn: async () => { const { data } = await supabase.from('crm_leads').select('*'); return data || []; }});
  const clientsQ = useQuery({ queryKey: ['md-clients'], queryFn: async () => { const { data } = await supabase.from('clients').select('*'); return data || []; }});
  const eventsQ = useQuery({ queryKey: ['md-events', year, monthNum], queryFn: async () => { const { data } = await supabase.from('events').select('*'); return data || []; }});
  const meetingsQ = useQuery({ queryKey: ['md-meetings', year, monthNum], queryFn: async () => { const mStart = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd'); const mEnd = format(endOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd'); const { data } = await supabase.from('meetings').select('id, title, date_time, status, meeting_url').gte('date_time', mStart + 'T00:00:00').lte('date_time', mEnd + 'T23:59:59'); return data || []; }});
  const contentQ = useQuery({ queryKey: ['md-content', year, monthNum], queryFn: async () => { const { data } = await supabase.from('content_items').select('*, content_channels(channel_id)'); return data || []; }});
  const channelsQ = useQuery({ queryKey: ['md-channels'], queryFn: async () => { const { data } = await supabase.from('marketing_channels').select('*').eq('is_active', true).order('sort_order'); return data || []; }});
  const productsQ = useQuery({ queryKey: ['md-products'], queryFn: async () => { const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client, ticket, status'); return data || []; }});
  const timeEntriesQ = useQuery({ queryKey: ['md-time', year, monthNum], queryFn: async () => { const { data } = await supabase.from('time_entries').select('*').eq('entry_year', year).eq('entry_month', monthNum); return data || []; }});
  const commMonthGoalQ = useQuery({ queryKey: ['md-comm-goal', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('year', year).eq('month', monthNum).maybeSingle(); return data; }});
  const commProdGoalQ = useQuery({ queryKey: ['md-comm-prod-goals', year], queryFn: async () => { const { data } = await supabase.from('commercial_product_goals').select('*').eq('year', year).order('sort_order'); return data || []; }});
  const npsQ = useQuery({ queryKey: ['md-nps', year, monthNum], queryFn: async () => { const { data } = await supabase.from('client_nps_records').select('*'); return data || []; }});
  const teamQ = useQuery({ queryKey: ['md-team'], queryFn: async () => { const { data } = await supabase.from('team_members').select('*').eq('status', 'ativo'); return data || []; }});
  const tasksQ = useQuery({ queryKey: ['md-tasks', year, monthNum], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; }});
  const reportQ = useQuery({ queryKey: ['md-report', year, monthNum], queryFn: async () => { const { data } = await supabase.from('monthly_reports').select('*').eq('year', year).eq('month', monthNum).eq('status', 'completed').maybeSingle(); return data; }});

  // Routine tasks for this month
  const routineTasksQ = useQuery({
    queryKey: ['md-routine-tasks', year, monthNum],
    queryFn: async () => {
      const mStart = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd');
      const mEnd = format(endOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('tasks')
        .select('*, planning_routines:routine_id(title, role_function, recurrence_type)')
        .eq('tag', 'Rotina')
        .gte('deadline', mStart)
        .lte('deadline', mEnd)
        .order('deadline');
      return data || [];
    },
  });


  const upsertGoal = useMutation({
    mutationFn: async (amount: number) => {
      if (commMonthGoalQ.data?.id) {
        const { error } = await supabase.from('commercial_monthly_goals').update({ goal_amount: amount }).eq('id', commMonthGoalQ.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('commercial_monthly_goals').insert({ year, month: monthNum, goal_amount: amount });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['md-comm-goal', year, monthNum] }); setGoalEditOpen(false); toast.success('Meta atualizada'); },
    onError: () => toast.error('Erro ao guardar meta'),
  });

  const createClientFromLead = useMutation({
    mutationFn: async (form: Record<string, string>) => {
      const { resolveProductId } = await import('@/lib/productResolver');
      const currentProductId = await resolveProductId(form.current_product);
      const { data, error } = await (supabase.from('clients' as any) as any).insert({
        full_name: form.full_name,
        email: form.email || null,
        whatsapp: form.whatsapp || null,
        current_product: form.current_product || null,
        current_product_id: currentProductId,
        status: 'em_onboarding',
        start_date: form.start_date || new Date().toISOString().slice(0, 10),
        nif: form.nif || null,
        fiscal_address: form.fiscal_address || null,
        birthday: form.birthday || null,
        observations: form.observations || null,
        payment_method: form.payment_method || null,
        dp: form.dp || null,
      }).select('id').single();
      if (error) throw error;
      // Update lead status to ganho if not already
      if (form._lead_id) {
        await supabase.from('crm_leads').update({ status: 'ganho' } as any).eq('id', form._lead_id);
      }
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['md-clients'] });
      qc.invalidateQueries({ queryKey: ['md-leads'] });
      setConvertLead(null);
      toast.success('Cliente criado com sucesso!');
      navigate(`/clientes/${data.id}`);
    },
    onError: () => toast.error('Erro ao criar cliente'),
  });

  // ── Derived data ──
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const monthGoals = goals.filter((g: any) => g.period === monthName);
  const progress = monthGoals.length > 0 ? Math.round(monthGoals.filter((g: any) => g.status === 'atingido').length / monthGoals.length * 100) : 0;

  // Objectives linked to this month's goals
  const linkedObjIds = [...new Set(monthGoals.map((g: any) => g.objective_id).filter(Boolean))];
  const linkedObjectives = objectives.filter((o: any) => linkedObjIds.includes(o.id));

  const sales = salesQ.data || [];
  const totalInvoiced = sumRevenue(sales);
  const salesActions = salesActionsQ.data || [];
  const commGoal = commMonthGoalQ.data;
  const commProdGoals = commProdGoalQ.data || [];
  const products = productsQ.data || [];

  const allLeads = leadsQ.data || [];
  const monthLeads = allLeads.filter((l: any) => {
    const added = l.added_at ? parseISO(l.added_at) : null;
    const updated = l.updated_at ? parseISO(l.updated_at) : null;
    return (added && added >= range.start && added <= range.end) || (updated && updated >= range.start && updated <= range.end);
  });

  const CRM_COLUMNS = CRM_STATUSES.map(s => s.value);
  const CRM_LABELS: Record<string, string> = Object.fromEntries(CRM_STATUSES.map(s => [s.value, s.label]));
  const CRM_COLORS: Record<string, string> = Object.fromEntries(CRM_STATUSES.map(s => [s.value, s.color]));

  const allClients = clientsQ.data || [];
  const activeClients = allClients.filter((c: any) => c.status === 'ativo' || c.status === 'em_onboarding');
  const pausedClients = allClients.filter((c: any) => c.status === 'pausado');
  const endingClients = allClients.filter((c: any) => {
    const isTerminado = c.status === 'terminado';
    const endsCycle = c.end_of_cycle ? (() => { const d = parseISO(c.end_of_cycle); return d >= range.start && d <= range.end; })() : false;
    return isTerminado || endsCycle;
  });

  const allEvents = useMemo(() => {
    const events = (eventsQ.data || []).filter((e: any) => { if (!e.start_date) return false; const d = parseISO(e.start_date); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); }).map((e: any) => ({ ...e, _type: 'event' }));
    const meetings = (meetingsQ.data || []).filter((m: any) => { if (!m.date_time) return false; const d = parseISO(m.date_time); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); }).map((m: any) => ({ ...m, start_date: m.date_time, _type: 'meeting' }));
    return [...events, ...meetings];
  }, [eventsQ.data, meetingsQ.data, calMonth]);

  const allContent = (contentQ.data || []).filter((c: any) => { if (!c.scheduled_at) return false; const d = parseISO(c.scheduled_at); return d >= range.start && d <= range.end; });
  const channels = channelsQ.data || [];

  const monthTasks = (tasksQ.data || []).filter((t: any) => { if (!t.deadline) return false; const d = parseISO(t.deadline); return d >= range.start && d <= range.end; });

  const timeEntries = timeEntriesQ.data || [];
  const team = teamQ.data || [];

  // Product review with per-client breakdown
  const productReview = useMemo(() => {
    return products.map((p: any) => {
      const clientsWithProduct = activeClients.filter((c: any) =>
        c.current_product_id ? c.current_product_id === p.id : c.current_product === p.name
      );
      const hoursPerClient = p.monthly_hours_per_client || 0;
      const estimatedHours = hoursPerClient * clientsWithProduct.length;

      // Per-client breakdown with real hours from time_entries
      const clientBreakdown = clientsWithProduct.map((c: any) => {
        const clientTimeEntries = timeEntries.filter((te: any) => te.client_id === c.id);
        const realHours = Math.round(clientTimeEntries.reduce((s: number, te: any) => s + Number(te.duration || 0), 0) * 10) / 10;
        const deviation = Math.round((realHours - hoursPerClient) * 10) / 10;
        return { clientId: c.id, clientName: c.full_name, clientCode: c.client_id, estimated: hoursPerClient, realHours, deviation };
      });

      const totalRealHours = Math.round(clientBreakdown.reduce((s: number, cb: any) => s + cb.realHours, 0) * 10) / 10;
      const totalDeviation = Math.round((totalRealHours - estimatedHours) * 10) / 10;

      return { id: p.id, name: p.name, clientCount: clientsWithProduct.length, estimatedHours, realHours: totalRealHours, deviation: totalDeviation, clientBreakdown };
    }).filter((p: any) => p.clientCount > 0);
  }, [products, activeClients, timeEntries]);

  // Team capacity
  const teamCapacity = useMemo(() => {
    return team.map((m: any) => {
      const monthlyAvailable = monthlyCapacity(m);
      const memberTasks = monthTasks.filter((t: any) => t.assigned_to === m.profile_id);
      const committed = memberTasks.reduce((s: number, t: any) => s + Number(t.estimated_time || 0), 0);
      return { name: m.full_name, available: Math.round(monthlyAvailable), committed: Math.round(committed), over: committed > monthlyAvailable };
    }).filter(m => m.committed > 0);
  }, [team, monthTasks]);


  // Product sales breakdown for "goal" tab — always show all active products
  const prodSalesData = useMemo(() => {
    const activeProducts = products.filter((p: any) => p.status !== 'off');
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    return activeProducts.map((prod: any) => {
      const prodName = normalize(prod.name);
      const prodSales = sales.filter((s: any) => {
        const saleName = normalize(s.product || '');
        if (!saleName) return false;
        return saleName === prodName
          || saleName.includes(prodName)
          || prodName.includes(saleName)
          || saleName.replace(/\s*\[.*?\]\s*/g, '') === prodName.replace(/\s*\[.*?\]\s*/g, '');
      });
      const totalFat = sumRevenue(prodSales);
      const pg = commProdGoals.find((g: any) => {
        const goalName = normalize(g.product_name);
        return goalName === prodName || goalName.includes(prodName) || prodName.includes(goalName);
      });
      const goalAmt = Number(pg?.goal_amount || 0);
      const pct = goalAmt > 0 ? Math.round((totalFat / goalAmt) * 100) : 0;
      const ticketValue = prod.ticket ? parseFloat(prod.ticket.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0;
      return {
        product: prod.name,
        numVendas: prodSales.length,
        price: ticketValue,
        goalAmount: goalAmt,
        totalFat,
        pct,
      };
    });
  }, [commProdGoals, sales, products]);

  // ── Calendar helper ──
  function renderCalendarGrid(items: any[], getDate: (item: any) => Date | null, renderItem: (item: any) => React.ReactNode) {
    const daysInMonth = getDaysInMonth(calMonth);
    const firstDay = (getDay(startOfMonth(calMonth)) + 6) % 7; // Monday start
    const dayNames = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dayItems = items.filter(item => { const dt = getDate(item); return dt && dt.getDate() === d; });
      const isToday = d === new Date().getDate() && calMonth.getMonth() === new Date().getMonth() && calMonth.getFullYear() === new Date().getFullYear();
      cells.push(
        <div key={d} className={cn('min-h-[60px] border border-border/30 rounded p-1', isToday && 'bg-primary/5 ring-1 ring-primary')}>
          <span className="text-[10px] font-medium text-muted-foreground">{d}</span>
          <div className="space-y-0.5 mt-0.5">{dayItems.map(renderItem)}</div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <span className="text-xs font-medium">{format(calMonth, 'MMMM yyyy', { locale: pt })}</span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {dayNames.map(dn => <div key={dn} className="text-center text-[10px] font-medium text-muted-foreground py-1">{dn}</div>)}
          {cells}
        </div>
      </div>
    );
  }

  // Quarter for this month
  const quarter = Math.ceil(monthNum / 3);

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <BackNavigation parentRoute="/executive/planeamento" parentLabel="Planeamento" onBack={onBack} />
          <div>
            <h2 className="text-xl font-bold">{monthName} {year}</h2>
            <p className="text-xs text-muted-foreground">Período Mensal — {range.label}</p>
          </div>
        </div>

        {/* Goals summary */}
        {monthGoals.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Progresso: {progress}%</span>
              <Progress value={progress} className="h-2 flex-1" />
            </div>
          </div>
        )}
      </div>

      {/* ═══ SECTION 1: Objetivos ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Objetivos</CardTitle>
            <div className="flex gap-1 ml-auto">
              <Button size="sm" variant={objTab === 'metas' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setObjTab('metas')}>Metas do mês</Button>
              <Button size="sm" variant={objTab === 'objetivos' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setObjTab('objetivos')}>Objetivos anuais</Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => setObjDialogOpen(true)}><Plus className="h-3 w-3" /> Novo objetivo</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {objTab === 'metas' ? (
            monthGoals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sem metas para {monthName}.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Área</TableHead><TableHead>Meta</TableHead><TableHead className="text-right">Alvo</TableHead><TableHead className="text-right">Atual</TableHead><TableHead>Progresso</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {monthGoals.map((g: any) => {
                    const obj = objectives.find((o: any) => o.id === g.objective_id);
                    const targetVal = Number(g.target_value || 0);
                    const actualVal = Number(g.actual_value || 0);
                    // For commercial objectives, calculate actual from sales
                    const isCommercial = obj?.value_source === 'commercial' || obj?.area === 'comercial';
                    const computedActual = isCommercial ? totalInvoiced : actualVal;
                    const pct = targetVal > 0 ? Math.min(Math.round((computedActual / targetVal) * 100), 100) : 0;
                    const unit = obj?.target_unit || '';
                    return (
                      <TableRow key={g.id} className="cursor-pointer hover:bg-muted/60" onClick={() => obj && setSelectedObjective(obj)}>
                        <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">{planStatusLabel(g.status)}</Badge></TableCell>
                        <TableCell className="text-xs">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                        <TableCell className="text-sm">{obj?.title || '—'}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{targetVal > 0 ? `${targetVal.toLocaleString('pt-PT')}${unit}` : '—'}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{computedActual > 0 ? `${computedActual.toLocaleString('pt-PT', { minimumFractionDigits: unit === '€' ? 2 : 0 })}${unit}` : '0'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 w-16" />
                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          ) : (
            linkedObjectives.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Sem objetivos anuais ligados a este mês.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Área</TableHead><TableHead>Objetivo</TableHead><TableHead>Tipo</TableHead><TableHead>Prazo</TableHead><TableHead>Progresso</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linkedObjectives.map((o: any) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setSelectedObjective(o)}>
                      <TableCell><Badge variant={o.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">{planStatusLabel(o.status)}</Badge></TableCell>
                      <TableCell className="text-xs">{planAreaLabel(o.area)}</TableCell>
                      <TableCell className="text-sm font-medium">{o.title}</TableCell>
                      <TableCell className="text-xs">{o.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}</TableCell>
                      <TableCell className="text-xs">{o.deadline || '—'}</TableCell>
                      <TableCell><Progress value={planning.objectiveProgress(o)} className="h-1.5 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 2: Agenda ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Agenda ME & Calendários</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/agenda')}><Plus className="h-3 w-3" /> Novo Evento</Button>
          </div>
        </CardHeader>
        <CardContent>
          {renderCalendarGrid(
            allEvents,
            (e: any) => e.start_date ? parseISO(e.start_date) : null,
            (e: any) => <div key={e.id} className={cn("text-[9px] rounded px-1 py-0.5 truncate cursor-pointer", e._type === 'meeting' ? 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20')} onClick={() => navigate(e._type === 'meeting' ? `/hub/reunioes/${e.id}` : `/reunioes/${e.id}`)}>{e.title}</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 3: Produtos & Vendas ═══ */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Produtos & Vendas</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Meta estabelecida */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Meta estabelecida</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Trimestre</TableHead><TableHead>Mês</TableHead><TableHead>Intervalo</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">Até agora</TableHead><TableHead>Análise</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  <TableRow className="cursor-pointer hover:bg-muted/60" onClick={() => { setGoalEditValue(commGoal ? String(commGoal.goal_amount) : ''); setGoalEditOpen(true); }}>
                    <TableCell className="text-xs">T{quarter}</TableCell>
                    <TableCell className="text-xs">{monthName}</TableCell>
                    <TableCell className="text-xs">{range.label}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{commGoal ? `${Number(commGoal.goal_amount).toLocaleString('pt-PT')}€` : '—'}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{totalInvoiced.toLocaleString('pt-PT')}€</TableCell>
                    <TableCell className="text-xs">
                      {commGoal ? (
                        <span className="text-muted-foreground">
                          Progresso: {Math.round((totalInvoiced / Number(commGoal.goal_amount)) * 100)}% — Faturado: {totalInvoiced.toLocaleString('pt-PT')}€ de {Number(commGoal.goal_amount).toLocaleString('pt-PT')}€
                        </span>
                      ) : <span className="text-muted-foreground">Sem meta definida — clica para adicionar</span>}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Goal edit dialog */}
            <Dialog open={goalEditOpen} onOpenChange={setGoalEditOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Editar Meta Mensal</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Valor da meta (€)</label>
                    <Input type="number" value={goalEditValue} onChange={e => setGoalEditValue(e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  <Button className="w-full" onClick={() => { const v = parseFloat(goalEditValue); if (isNaN(v) || v < 0) { toast.error('Valor inválido'); return; } upsertGoal.mutate(v); }} disabled={upsertGoal.isPending}>
                    {upsertGoal.isPending ? 'A guardar...' : 'Guardar'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Product distribution tabs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-medium text-muted-foreground">Distribuição por produto & vendas</p>
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant={vendasTab === 'goal' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setVendasTab('goal')}>Goal</Button>
                <Button size="sm" variant={vendasTab === 'real' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setVendasTab('real')}>Como está a correr</Button>
              </div>
            </div>
            {vendasTab === 'goal' ? (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead><TableHead className="text-right">Nº Vendas</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Faturação prevista</TableHead><TableHead className="text-right">Faturação total</TableHead><TableHead>Análise</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {prodSalesData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">Sem produtos ativos.</TableCell></TableRow>
                  ) : prodSalesData.map(p => (
                    <TableRow key={p.product}>
                      <TableCell className="text-sm font-medium">{p.product}</TableCell>
                      <TableCell className="text-xs text-right">{p.numVendas}</TableCell>
                      <TableCell className="text-xs text-right">{Number(p.price).toLocaleString('pt-PT')}€</TableCell>
                      <TableCell className="text-xs text-right">{p.goalAmount.toLocaleString('pt-PT')}€</TableCell>
                      <TableCell className="text-xs text-right">{p.totalFat.toLocaleString('pt-PT')}€</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.goalAmount > 0 ? `Em progresso (${p.pct}%)` : 'Sem previsão definida'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ref</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">Sem vendas registadas.</TableCell></TableRow>
                  ) : sales.map((sl: any) => (
                    <TableRow key={sl.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/comercial/vendas/${sl.id}`)}>
                      <TableCell className="text-xs">{sl.sale_id}</TableCell>
                      <TableCell className="text-sm">{sl.client || '—'}</TableCell>
                      <TableCell className="text-sm">{sl.product || '—'}</TableCell>
                      <TableCell className="text-sm text-right">{Number(sl.invoice_total || 0).toLocaleString('pt-PT')}€</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{sl.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Sales actions */}
          {salesActions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ações de Vendas</p>
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Ação</TableHead><TableHead>Data/Período</TableHead><TableHead>Produto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salesActions.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                      <TableCell className="text-sm">{a.action_name}</TableCell>
                      <TableCell className="text-xs">{a.start_date ? format(parseISO(a.start_date), 'dd/MM') : '—'}{a.end_date ? ` → ${format(parseISO(a.end_date), 'dd/MM')}` : ''}</TableCell>
                      <TableCell className="text-sm">{a.product || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 4: Marketing & Conteúdo ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Marketing & Conteúdo</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={async () => {
              const { data, error } = await supabase.from('content_items').insert({ title: 'Novo Conteúdo' } as any).select('id').single() as any;
              if (error || !data) { toast.error('Erro ao criar conteúdo'); return; }
              qc.invalidateQueries({ queryKey: ['md-content'] });
              navigate(`/hub/marketing/conteudos/${data.id}`);
            }}><Plus className="h-3 w-3" /> Novo Conteúdo</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel tabs */}
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant={contentTab === 'calendario' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setContentTab('calendario')}>Calendário</Button>
            {channels.map((ch: any) => (
              <Button key={ch.id} size="sm" variant={contentTab === ch.id ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setContentTab(ch.id)}>{ch.name}</Button>
            ))}
          </div>

          {renderCalendarGrid(
            contentTab === 'calendario' ? allContent : allContent.filter((c: any) => c.content_channels?.some((cc: any) => cc.channel_id === contentTab)),
            (c: any) => c.scheduled_at ? parseISO(c.scheduled_at) : null,
            (c: any) => <div key={c.id} className="text-[9px] bg-accent/50 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-accent" onClick={() => navigate(`/hub/marketing/conteudos/${c.id}`)}>{c.title}</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 5: CRM ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">CRM</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/comercial/crm')}><Plus className="h-3 w-3" /> Nova Lead</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2" style={{ minWidth: CRM_COLUMNS.length * 180 }}>
              {CRM_COLUMNS.map(col => {
                const colLeads = monthLeads.filter((l: any) => l.status === col);
                return (
                  <div key={col} className="w-44 shrink-0">
                    <div className={cn('text-[10px] font-medium mb-1.5 px-2 py-1 rounded-md', CRM_COLORS[col] || 'text-muted-foreground')}>{CRM_LABELS[col]} <Badge variant="outline" className="text-[9px] ml-1">{colLeads.length}</Badge></div>
                    <div className="space-y-1.5">
                      {colLeads.map((l: any) => {
                        const overdue = l.next_followup && parseISO(l.next_followup) < new Date();
                        const borderColor = CRM_COLORS[col]?.match(/border-\S+/)?.[0] || 'border-border/50';
                        return (
                          <div key={l.id} className={cn('border-l-2 border rounded-lg p-2 bg-background text-xs space-y-1 cursor-pointer hover:bg-muted/40', borderColor, overdue && 'border-destructive/50')} onClick={() => { setSelectedLead(l); setLeadSheetOpen(true); }}>
                            <p className="font-medium truncate">{l.name}</p>
                            {l.email && <p className="text-muted-foreground truncate">{l.email}</p>}
                            {l.phone && <p className="text-muted-foreground">{l.phone}</p>}
                            {l.next_followup && (
                              <div className={cn('text-[10px]', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                Follow-up: {format(parseISO(l.next_followup), 'dd/MM')}{overdue && ' ⚠️'}
                              </div>
                            )}
                            {l.status === 'ganho' && (
                              <Button variant="outline" size="sm" className="h-5 text-[9px] w-full mt-1 gap-1" onClick={(e) => {
                                e.stopPropagation();
                                const form: Record<string, string> = {
                                  full_name: l.name || '',
                                  email: l.email || '',
                                  whatsapp: l.phone || '',
                                  current_product: l.closed_product || '',
                                  start_date: new Date().toISOString().slice(0, 10),
                                  _lead_id: l.id,
                                  nif: '', fiscal_address: '', birthday: '', observations: '', payment_method: '', dp: '',
                                };
                                setConvertForm(form);
                                setConvertLead(l);
                              }}><UserPlus className="h-3 w-3" /> Tornar Cliente</Button>
                            )}
                          </div>
                        );
                      })}
                      {colLeads.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-3">—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SECTION 6: Clientes Ativos & Renovações ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm">Clientes Ativos & Renovações</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/clientes')}><Plus className="h-3 w-3" /> Novo Cliente</Button>
            <div className="flex gap-1 ml-auto">
              <Button size="sm" variant={clientTab === 'ativos' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('ativos')}>Clientes Ativos ({activeClients.length})</Button>
              <Button size="sm" variant={clientTab === 'pausados' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('pausados')}>Em Pausa ({pausedClients.length})</Button>
              <Button size="sm" variant={clientTab === 'terminar' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('terminar')}>A terminar este mês ({endingClients.length})</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientTab === 'ativos' ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Data Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {activeClients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">Sem clientes ativos.</TableCell></TableRow>
                ) : activeClients.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="text-xs">{c.client_id}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell><Badge variant="default" className="text-xs">{c.status === 'em_onboarding' ? 'Em onboarding' : 'Ativo'}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-xs">{c.email || '—'}</TableCell>
                    <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : clientTab === 'pausados' ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Data Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pausedClients.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">Sem clientes em pausa.</TableCell></TableRow>
                ) : pausedClients.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="text-xs">{c.client_id}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">Pausado</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-xs">{c.email || '—'}</TableCell>
                    <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Data Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead><TableHead>Fim de Ciclo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {endingClients.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">Sem clientes a terminar este mês.</TableCell></TableRow>
                ) : endingClients.map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="text-xs">{c.client_id}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.status}</Badge></TableCell>
                    <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                    <TableCell className="text-xs">{c.email || '—'}</TableCell>
                    <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
                    <TableCell><Badge variant="destructive" className="text-xs">{c.end_of_cycle}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 7: Pagamentos ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Pagamentos de Clientes</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/comercial/vendas')}><Plus className="h-3 w-3" /> Nova Venda</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[10px] text-muted-foreground mb-2">Recebimentos este mês</p>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nº Venda</TableHead><TableHead>Status</TableHead><TableHead>Data transação</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor Base</TableHead><TableHead>Produto</TableHead><TableHead>Cliente</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">Sem recebimentos registados.</TableCell></TableRow>
              ) : sales.map((sl: any) => (
                <TableRow key={sl.id} className="cursor-pointer hover:bg-muted/60" onClick={() => navigate(`/comercial/vendas/${sl.id}`)}>
                  <TableCell className="text-xs">{sl.sale_id}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{sl.status}</Badge></TableCell>
                  <TableCell className="text-xs">{sl.payment_date ? format(parseISO(sl.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-xs">{sl.description || '—'}</TableCell>
                  <TableCell className="text-xs text-right">{Number(sl.base_value || 0).toLocaleString('pt-PT')}€</TableCell>
                  <TableCell className="text-xs">{sl.product || '—'}</TableCell>
                  <TableCell className="text-xs">{sl.client || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ═══ SECTION 7B: Visão de Tarefas ═══ */}
      {(() => {
        const allTasks = (tasksQ.data || []) as any[];
        const monthStart = `${year}-${String(monthNum).padStart(2,'0')}-01`;
        const nextM = monthNum === 12 ? 1 : monthNum + 1;
        const nextY = monthNum === 12 ? year + 1 : year;
        const monthEnd = `${nextY}-${String(nextM).padStart(2,'0')}-01`;

        const noDate = allTasks.filter(t => !t.deadline && isTaskOpen(t));
        const thisMonth = allTasks.filter(t => t.deadline && t.deadline >= monthStart && t.deadline < monthEnd);
        const pendingPrev = allTasks.filter(t => t.deadline && t.deadline < monthStart && isTaskOpen(t));

        const renderList = (items: any[], emptyMsg: string) => items.length === 0
          ? <p className="text-xs text-muted-foreground py-2">{emptyMsg}</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tarefa</TableHead><TableHead>Prioridade</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant={t.priority === 'alta' ? 'destructive' : 'secondary'} className="text-[10px]">{t.priority}</Badge></TableCell>
                    <TableCell><Badge variant={isTaskDone(t) ? 'default' : 'outline'} className="text-[10px]">{t.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.deadline || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          );

        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tarefas</CardTitle>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => navigate('/hub/tarefas')}><Plus className="h-3 w-3" /> Nova Tarefa</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="month" className="w-full">
                <TabsList className="mb-2">
                  <TabsTrigger value="no-date">Sem Data ({noDate.length})</TabsTrigger>
                  <TabsTrigger value="month">Do Mês ({thisMonth.length})</TabsTrigger>
                  <TabsTrigger value="pending">Pendentes Anterior ({pendingPrev.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="no-date">{renderList(noDate, 'Nenhuma tarefa sem data.')}</TabsContent>
                <TabsContent value="month">{renderList(thisMonth, 'Nenhuma tarefa para este mês.')}</TabsContent>
                <TabsContent value="pending">{renderList(pendingPrev, 'Sem tarefas pendentes de meses anteriores.')}</TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══ SECTION 8: Revisão Operacional ═══ */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revisão Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {productReview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem produtos com clientes ativos para análise.</p>
          ) : (
            <>
              {productReview.map((p: any) => (
                <div key={p.id} className="space-y-1">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Produto</TableHead><TableHead className="text-right">Horas estimadas</TableHead><TableHead className="text-right">Horas reais</TableHead><TableHead className="text-right">Desvio</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      <TableRow className="font-medium bg-muted/30">
                        <TableCell className="text-sm font-semibold">{p.name} <span className="text-muted-foreground font-normal">({p.clientCount} clientes)</span></TableCell>
                        <TableCell className="text-sm text-right">{p.estimatedHours}h</TableCell>
                        <TableCell className="text-sm text-right">{p.realHours}h</TableCell>
                        <TableCell className="text-right">
                          {Math.abs(p.deviation) >= 5 ? <Badge variant="destructive" className="text-xs">{p.deviation > 0 ? '+' : ''}{p.deviation}h</Badge> : <span className="text-sm">{p.deviation > 0 ? '+' : ''}{p.deviation}h</span>}
                        </TableCell>
                        <TableCell>{Math.abs(p.deviation) >= 5 ? <Badge variant="destructive" className="text-[10px]">Desvio</Badge> : <Badge variant="secondary" className="text-[10px]">OK</Badge>}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                   <div className="ml-4 border-l-2 border-border/50 pl-3">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-[10px]">Cliente</TableHead><TableHead className="text-[10px] text-right">Estimado</TableHead><TableHead className="text-[10px] text-right">Real</TableHead><TableHead className="text-[10px] text-right">Desvio</TableHead><TableHead className="text-[10px]">Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {p.clientBreakdown.map((cb: any) => {
                          const isOver = cb.deviation > 2;
                          const isUnder = cb.deviation < -2;
                          return (
                            <TableRow key={cb.clientId} className={cn('cursor-pointer hover:bg-muted/60', isOver && 'bg-destructive/5')} onClick={() => setExpandedClient({ ...cb, productName: p.name })}>
                              <TableCell className="text-xs">{cb.clientName} <span className="text-muted-foreground">({cb.clientCode})</span></TableCell>
                              <TableCell className="text-xs text-right">{cb.estimated}h</TableCell>
                              <TableCell className="text-xs text-right">{cb.realHours}h</TableCell>
                              <TableCell className="text-xs text-right">
                                {isOver ? <span className="text-destructive font-medium">+{cb.deviation}h</span> : isUnder ? <span className="text-blue-600 font-medium">{cb.deviation}h</span> : <span>{cb.deviation > 0 ? '+' : ''}{cb.deviation}h</span>}
                              </TableCell>
                              <TableCell>
                                {isOver ? <Badge variant="destructive" className="text-[9px]">Acima</Badge> : isUnder ? <Badge className="text-[9px] bg-blue-100 text-blue-700">Abaixo</Badge> : <Badge variant="secondary" className="text-[9px]">OK</Badge>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {Math.abs(p.deviation) >= 5 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 flex-1">
                        O produto <strong>{p.name}</strong> demorou <strong>{Math.abs(p.deviation)}h</strong> {p.deviation > 0 ? 'a mais' : 'a menos'} do que o estimado.
                        {p.clientBreakdown.filter((cb: any) => cb.deviation > 2).length > 0 && (
                          <> Os clientes fora do normal: <strong>{p.clientBreakdown.filter((cb: any) => cb.deviation > 2).map((cb: any) => cb.clientName).join(', ')}</strong>.</>
                        )}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => navigate(`/produtos/${p.id}`)}><ExternalLink className="h-3 w-3" /> Ver produto</Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {teamCapacity.filter(m => m.over).map(m => (
            <div key={m.name} className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300">Este mês <strong>{m.name}</strong> teve <strong>{m.committed}h</strong> comprometidas com <strong>{m.available}h</strong> disponíveis. Considera redistribuir clientes.</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ═══ SECTION 8.5: Rotinas Semanais e Mensais ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Rotinas Semanais e Mensais
            {(() => {
              const tasks = routineTasksQ.data || [];
              const done = tasks.filter((t: any) => isTaskDone(t)).length;
              const total = tasks.length;
              if (total === 0) return null;
              const pct = Math.round((done / total) * 100);
              return <Badge variant="outline" className="text-[10px] ml-auto">{done}/{total} ({pct}%)</Badge>;
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(routineTasksQ.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem rotinas configuradas para este mês.</p>
          ) : (
            <div className="space-y-1.5">
              {(routineTasksQ.data || []).map((t: any) => {
                const isDone = isTaskDone(t);
                const deadlineDate = t.deadline ? parseISO(t.deadline) : null;
                const completedAt = t.completed_at ? parseISO(t.completed_at) : null;
                const isLate = !isDone && deadlineDate && deadlineDate < new Date();
                const completedLate = isDone && completedAt && deadlineDate && completedAt > deadlineDate;
                const routineInfo = t.planning_routines as any;
                const roleFn = routineInfo?.role_function;

                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:shadow-sm transition-shadow',
                      isLate && 'border-destructive/50 bg-destructive/5',
                    )}
                    onClick={() => setSelectedRoutineTask(t)}
                  >
                    {isDone ? (
                      completedLate ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300">Atrasada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300">No prazo</Badge>
                      )
                    ) : isLate ? (
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">Em falta</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Por fazer</Badge>
                    )}
                    <span className={cn('text-sm flex-1 truncate', isDone && 'line-through text-muted-foreground')}>{t.name}</span>
                    {roleFn && <Badge variant="secondary" className="text-[9px] shrink-0">{roleFn}</Badge>}
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.deadline ? format(parseISO(t.deadline), 'd MMM', { locale: pt }) : ''}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{(t.profiles as any)?.full_name || ''}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>


      {/* ═══ ROUTINE TASK DETAIL ═══ */}
      {selectedRoutineTask && (() => {
        const t = selectedRoutineTask;
        const isDone = isTaskDone(t);
        const routineInfo = t.planning_routines as any;
        const fields: DetailField[] = [
          { label: 'Estado', value: isDone ? 'Concluída' : 'Por fazer', badge: true, badgeVariant: isDone ? 'default' : 'destructive' },
          { label: 'Data limite', value: t.deadline ? format(parseISO(t.deadline), "d 'de' MMMM yyyy", { locale: pt }) : '—' },
          { label: 'Responsável', value: (t.profiles as any)?.full_name || '—' },
          { label: 'Função', value: routineInfo?.role_function || '—' },
          { label: 'Departamento', value: routineInfo?.department || '—' },
          { label: 'Recorrência', value: routineInfo?.recurrence_type || '—' },
          ...(t.completed_at ? [{ label: 'Concluída em', value: format(parseISO(t.completed_at), "d MMM yyyy 'às' HH:mm", { locale: pt }) }] : []),
        ];
        return (
          <WeeklyAlignDetailSheet
            open={!!selectedRoutineTask}
            onOpenChange={(o) => !o && setSelectedRoutineTask(null)}
            title={t.name}
            subtitle="Tarefa de rotina"
            fields={fields}
          />
        );
      })()}

      {/* ═══ MONTHLY REPORT BANNER ═══ */}
      {(() => {
        const report = reportQ.data;
        const rd = report?.report_data as any;
        const fmtV = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const handleGenerateReport = async () => {
          setGeneratingReport(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada');
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-monthly-report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ year, month: monthNum }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Erro');
            toast.success(`Relatório de ${monthName} gerado`);
            qc.invalidateQueries({ queryKey: ['md-report', year, monthNum] });
            qc.invalidateQueries({ queryKey: ['monthly-reports'] });
          } catch (err: any) { toast.error(err.message || 'Erro ao gerar'); }
          finally { setGeneratingReport(false); }
        };

        const handleDownloadPdf = () => {
          if (!rd) return;
          const label = rd.period?.label || `${monthName} ${year}`;
          const f = fmtV;
          const fin = rd.financial || {};
          const com = rd.commercial || {};
          const cli = rd.clients || {};
          const ops = rd.operations || {};
          const tm = rd.team || {};
          const crm = rd.crm || {};
          const topHtml = (com.topProducts || []).map(([n, v]: [string, number]) => `<tr><td>${n}</td><td style="text-align:right;font-weight:600">€${f(v)}</td></tr>`).join('');

          const pw = window.open('', '_blank', 'width=900,height=700');
          if (!pw) { toast.error('Popup bloqueado'); return; }
          pw.document.write(`<!DOCTYPE html><html><head><title>Relatório ${label}</title>
<style>@page{size:A4;margin:18mm 15mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#1a1a1a;line-height:1.5}.header{border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.header h1{font-size:18px;font-weight:700}.header .date{font-size:10px;color:#6b7280}h2{font-size:13px;font-weight:700;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#374151}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.kpi{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}.kpi .label{font-size:9px;text-transform:uppercase;color:#6b7280;letter-spacing:.3px}.kpi .value{font-size:16px;font-weight:700;margin-top:2px}.kpi .sub{font-size:9px;color:#6b7280;margin-top:1px}.section-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.card{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}.card h3{font-size:11px;font-weight:600;margin-bottom:6px}.row{display:flex;justify-content:space-between;font-size:10px;padding:3px 0}.row .lbl{color:#6b7280}.row .val{font-weight:600}.green{color:#059669}.red{color:#dc2626}.progress-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin:4px 0}.progress-fill{height:100%;background:#3b82f6;border-radius:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-weight:600;background:#f9fafb}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header"><h1>Relatório Mensal — ${label}</h1><span class="date">Gerado em ${new Date(rd.generatedAt || Date.now()).toLocaleDateString('pt-PT')}</span></div>
<h2>Financeiro</h2><div class="kpi-grid"><div class="kpi"><div class="label">Receita</div><div class="value">€${f(fin.revenue||0)}</div></div><div class="kpi"><div class="label">Despesas</div><div class="value">€${f(fin.expenses||0)}</div></div><div class="kpi"><div class="label">Margem</div><div class="value">€${f(fin.margin||0)}</div><div class="sub">${(fin.marginPct||0).toFixed(1)}%</div></div></div>
<h2>Comercial</h2><div class="kpi-grid"><div class="kpi"><div class="label">Vendas</div><div class="value">${com.salesCount||0}</div><div class="sub">€${f(com.totalSales||0)}</div></div><div class="kpi"><div class="label">Total YTD</div><div class="value">€${f(com.totalYtd||0)}</div></div><div class="kpi"><div class="label">Meta Anual</div><div class="value">${(com.progressPct||0).toFixed(1)}%</div><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(com.progressPct||0,100)}%"></div></div><div class="sub">€${f(com.totalYtd||0)} / €${f(com.annualGoal||0)}</div></div></div>
${topHtml?`<h2>Top Produtos</h2><table><thead><tr><th>Produto</th><th style="text-align:right">Valor</th></tr></thead><tbody>${topHtml}</tbody></table>`:''}
<h2>Clientes & CRM</h2><div class="section-grid"><div class="card"><h3>Clientes</h3><div class="row"><span class="lbl">Ativos</span><span class="val">${cli.activeCount||0}</span></div><div class="row"><span class="lbl">Novos</span><span class="val">${cli.newCount||0}</span></div>${cli.avgNps!=null?`<div class="row"><span class="lbl">NPS</span><span class="val">${cli.avgNps.toFixed(1)}</span></div>`:''}</div><div class="card"><h3>CRM</h3><div class="row"><span class="lbl">Convertidas</span><span class="val green">${crm.leadsConverted||0}</span></div><div class="row"><span class="lbl">Perdidas</span><span class="val red">${crm.leadsLost||0}</span></div></div><div class="card"><h3>Equipa</h3><div class="row"><span class="lbl">Horas</span><span class="val">${tm.totalHours||0}h</span></div><div class="row"><span class="lbl">Membros</span><span class="val">${tm.activeMembers||0}</span></div><div class="row"><span class="lbl">Média</span><span class="val">${tm.avgHoursPerMember||0}h</span></div></div></div>
<h2>Operações</h2><div class="kpi-grid"><div class="kpi"><div class="label">Tarefas Concluídas</div><div class="value">${ops.tasksCompleted||0}</div><div class="sub">${ops.tasksPending||0} pendentes</div></div><div class="kpi"><div class="label">Reuniões</div><div class="value">${ops.meetingsHeld||0}</div></div><div class="kpi"><div class="label">Entregáveis</div><div class="value">${ops.deliverablesCompleted||0}</div></div></div>
</body></html>`);
          pw.document.close();
          setTimeout(() => { pw.print(); pw.onafterprint = () => pw.close(); setTimeout(() => { try { pw.close(); } catch {} }, 5000); }, 400);
        };

        return (
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-primary/15 p-2">
                  <FileBarChart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Relatório Mensal</h3>
                  <p className="text-xs text-muted-foreground">Snapshot operacional consolidado de {monthName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rd && (
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="h-8">
                    <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                  </Button>
                )}
                <Button size="sm" onClick={handleGenerateReport} disabled={generatingReport} className="h-8">
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {generatingReport ? 'A gerar...' : report ? 'Regerar' : 'Gerar Relatório'}
                </Button>
              </div>
            </div>

            {rd && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: 'Receita', value: `€${fmtV(rd.financial?.revenue || 0)}` },
                  { label: 'Margem', value: `€${fmtV(rd.financial?.margin || 0)}`, sub: `${(rd.financial?.marginPct || 0).toFixed(1)}%` },
                  { label: 'Vendas', value: `${rd.commercial?.salesCount || 0}`, sub: `€${fmtV(rd.commercial?.totalSales || 0)}` },
                  { label: 'Clientes', value: `${rd.clients?.activeCount || 0}`, sub: `+${rd.clients?.newCount || 0} novos` },
                  { label: 'Tarefas', value: `${rd.operations?.tasksCompleted || 0}`, sub: `${rd.operations?.tasksPending || 0} pend.` },
                  { label: 'Horas', value: `${rd.team?.totalHours || 0}h`, sub: `${rd.team?.activeMembers || 0} membros` },
                ].map(k => (
                  <div key={k.label} className="bg-background/80 rounded-lg p-2.5 border border-border/50">
                    <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{k.label}</p>
                    <p className="text-sm font-bold mt-0.5">{k.value}</p>
                    {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
                  </div>
                ))}
              </div>
            )}

            {!rd && !reportQ.isLoading && (
              <p className="text-xs text-muted-foreground">Nenhum relatório gerado para este mês. Clica em "Gerar Relatório" para compilar os dados.</p>
            )}
          </div>
        );
      })()}

      {/* ═══ DETAIL SHEETS ═══ */}
      <ObjectiveDetailSheet
        open={!!selectedObjective}
        onClose={() => setSelectedObjective(null)}
        objective={selectedObjective}
        planning={planning}
      />
      <ObjectiveDialog
        open={objDialogOpen}
        onClose={() => setObjDialogOpen(false)}
        initial={null}
        onSave={(data: any) => { planning.upsertObjective.mutate(data); setObjDialogOpen(false); }}
      />

      {/* Client time entries dialog */}
      <Dialog open={!!expandedClient} onOpenChange={(open) => { if (!open) setExpandedClient(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {expandedClient && (() => {
            const clientEntries = timeEntries.filter((te: any) => te.client_id === expandedClient.clientId);
            const totalHours = Math.round(clientEntries.reduce((s: number, te: any) => s + Number(te.duration || 0), 0) * 10) / 10;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{expandedClient.clientName} <span className="text-muted-foreground font-normal text-sm">({expandedClient.clientCode})</span> — {expandedClient.productName}</DialogTitle>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span>Estimado: <strong className="text-foreground">{expandedClient.estimated}h</strong></span>
                    <span>Real: <strong className="text-foreground">{expandedClient.realHours}h</strong></span>
                    <span>Desvio: <strong className={cn(expandedClient.deviation > 2 ? 'text-destructive' : expandedClient.deviation < -2 ? 'text-blue-600' : 'text-foreground')}>{expandedClient.deviation > 0 ? '+' : ''}{expandedClient.deviation}h</strong></span>
                  </div>
                </DialogHeader>
                {clientEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem registos de tempo para este cliente neste mês.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Tempo</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {clientEntries.sort((a: any, b: any) => (a.entry_date || '').localeCompare(b.entry_date || '')).map((te: any) => {
                        const memberName = team.find((m: any) => m.id === te.member_id)?.full_name || '—';
                        return (
                          <TableRow key={te.id}>
                            <TableCell className="text-xs">{te.entry_date}</TableCell>
                            <TableCell className="text-xs">{te.description || '—'}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{te.category || '—'}</Badge></TableCell>
                            <TableCell className="text-xs">{memberName}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{te.duration}h</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={4} className="text-xs text-right">Total</TableCell>
                        <TableCell className="text-xs text-right font-bold">{totalHours}h</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══ Convert Lead to Client Sheet ═══ */}
      <Sheet open={!!convertLead} onOpenChange={(v) => { if (!v) setConvertLead(null); }}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tornar Cliente</SheetTitle>
            <SheetDescription>Preenche os dados em falta para criar a ficha de cliente.</SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          <div className="space-y-4">
            {[
              { key: 'full_name', label: 'Nome completo' },
              { key: 'email', label: 'Email' },
              { key: 'whatsapp', label: 'Whatsapp / Telefone' },
              { key: 'current_product', label: 'Produto' },
              { key: 'start_date', label: 'Data de início', type: 'date' },
              { key: 'nif', label: 'NIF' },
              { key: 'fiscal_address', label: 'Morada fiscal' },
              { key: 'birthday', label: 'Data de nascimento', type: 'date' },
              { key: 'payment_method', label: 'Método de pagamento' },
              { key: 'dp', label: 'Data de pagamento' },
              { key: 'observations', label: 'Observações' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                <Input
                  type={f.type || 'text'}
                  value={convertForm[f.key] || ''}
                  onChange={e => setConvertForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ))}
            <Button
              className="w-full"
              onClick={() => {
                if (!convertForm.full_name?.trim()) { toast.error('Nome obrigatório'); return; }
                createClientFromLead.mutate(convertForm);
              }}
              disabled={createClientFromLead.isPending}
            >
              {createClientFromLead.isPending ? 'A criar...' : 'Criar Cliente'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        open={leadSheetOpen}
        onOpenChange={v => { setLeadSheetOpen(v); if (!v) setSelectedLead(null); }}
        lead={selectedLead}
        products={(commProdGoalQ.data || []).map((p: any) => p.product_name)}
        profiles={[]}
        onSave={(lead) => {
          upsertLead.mutate(lead, {
            onSuccess: () => {
              setLeadSheetOpen(false);
              setSelectedLead(null);
              qc.invalidateQueries({ queryKey: ['md-leads'] });
            },
          });
        }}
        onDelete={(id) => {
          deleteLead.mutate(id, {
            onSuccess: () => {
              setLeadSheetOpen(false);
              setSelectedLead(null);
              qc.invalidateQueries({ queryKey: ['md-leads'] });
            },
          });
        }}
      />
    </div>
  );
}
