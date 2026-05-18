import React, { useState, useMemo, useEffect, useRef, useDeferredValue, lazy, Suspense } from 'react';
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
import type { DetailField } from '@/components/executive/WeeklyAlignDetailSheet';
// Lazy: detail sheets/dialogs only mount when first opened (saves ~30-50KB on initial bundle)
const ObjectiveDetailSheet = lazy(() => import('./ObjectiveDetailSheet').then(m => ({ default: m.ObjectiveDetailSheet })));
const ObjectiveDialog = lazy(() => import('./ObjectiveDialog').then(m => ({ default: m.ObjectiveDialog })));
const WeeklyAlignDetailSheet = lazy(() => import('@/components/executive/WeeklyAlignDetailSheet').then(m => ({ default: m.WeeklyAlignDetailSheet })));
const LeadDetailSheet = lazy(() => import('@/components/commercial/crm/LeadDetailSheet').then(m => ({ default: m.LeadDetailSheet })));
import { BackNavigation } from '@/components/BackNavigation';
import { CLIENT_STATUS_OPTIONS } from '@/hooks/useClients';
import { useCrmData, CRM_STATUSES } from '@/hooks/useCrmData';
import { sumRevenue } from '@/lib/salesCalculations';
import { isTaskDone, isTaskOpen } from '@/lib/taskStatus';
import { monthlyCapacity } from '@/lib/memberCapacity';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { getClientStatusInfo, getClientStatusColor, CLIENT_STATUSES } from '@/lib/clientStatus';
import { getSaleStatusInfo, getEffectiveSaleStatus } from '@/lib/saleStatus';
import { MonthDetailTasksCard } from './MonthDetailTasksCard';
import { Search } from 'lucide-react';

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

  // Inline detail sheet (events / content / sales) — keep user on this page
  const [inlineDetail, setInlineDetail] = useState<{
    title: string;
    kind: 'event' | 'meeting' | 'content' | 'sale' | 'client';
    id: string;
    fields: { label: string; value: React.ReactNode }[];
    openHref?: string;
  } | null>(null);

  // CRM list/board view toggle
  const [crmView, setCrmView] = useState<'board' | 'list'>('board');
  const [crmSearch, setCrmSearch] = useState('');

  // ── Data queries ──
  // Performance: cache for 5 min and avoid refetch on focus to make month/quarter navigation instant.
  const QOPTS = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false } as const;

  const salesQ = useQuery({ ...QOPTS, queryKey: ['md-sales', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_sales').select('*').eq('sale_year', year).eq('sale_month', monthNum); return data || []; }});
  const salesActionsQ = useQuery({ ...QOPTS, queryKey: ['md-sales-actions', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_sales_actions').select('*'); return (data || []).filter((a) => { if (!a.start_date) return false; const d = parseISO(a.start_date); return d >= range.start && d <= range.end; }); }});
  const leadsQ = useQuery({ ...QOPTS, queryKey: ['md-leads', year, monthNum], queryFn: async () => { const { data } = await supabase.from('crm_leads').select('*'); return data || []; }});
  const clientsQ = useQuery({ ...QOPTS, queryKey: ['md-clients'], queryFn: async () => { const { data } = await supabase.from('clients').select('*'); return data || []; }});
  const eventsQ = useQuery({ ...QOPTS, queryKey: ['md-events', year, monthNum], queryFn: async () => { const { data } = await supabase.from('events').select('*'); return data || []; }});
  const meetingsQ = useQuery({ ...QOPTS, queryKey: ['md-meetings', year, monthNum], queryFn: async () => { const mStart = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd'); const mEnd = format(endOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd'); const { data } = await supabase.from('meetings').select('id, title, date_time, status, meeting_url').gte('date_time', mStart + 'T00:00:00').lte('date_time', mEnd + 'T23:59:59'); return data || []; }});
  const contentQ = useQuery({ ...QOPTS, queryKey: ['md-content', year, monthNum], queryFn: async () => { const { data } = await supabase.from('content_items').select('*, content_channels(channel_id)'); return data || []; }});
  const channelsQ = useQuery({ ...QOPTS, queryKey: ['md-channels'], queryFn: async () => { const { data } = await supabase.from('marketing_channels').select('*').eq('is_active', true).order('sort_order'); return data || []; }});
  const productsQ = useQuery({ ...QOPTS, queryKey: ['md-products'], queryFn: async () => { const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client, ticket, status'); return data || []; }});
  const timeEntriesQ = useQuery({ ...QOPTS, queryKey: ['md-time', year, monthNum], queryFn: async () => { const { data } = await supabase.from('time_entries').select('*').eq('entry_year', year).eq('entry_month', monthNum); return data || []; }});
  const commMonthGoalQ = useQuery({ ...QOPTS, queryKey: ['md-comm-goal', year, monthNum], queryFn: async () => { const { data } = await supabase.from('commercial_monthly_goals').select('*').eq('year', year).eq('month', monthNum).maybeSingle(); return data; }});
  const commQuarterGoalQ = useQuery({ ...QOPTS, queryKey: ['md-comm-q-goal', year, Math.ceil(monthNum/3)], queryFn: async () => { const { data } = await supabase.from('commercial_quarterly_goals').select('*').eq('year', year).eq('quarter', Math.ceil(monthNum/3)).maybeSingle(); return data; }});
  const yearSalesQ = useQuery({ ...QOPTS, queryKey: ['md-year-sales', year], queryFn: async () => { const { data } = await supabase.from('commercial_sales').select('product, sale_month, invoice_total, base_value, status').eq('sale_year', year); return data || []; }});
  const commProdGoalQ = useQuery({ ...QOPTS, queryKey: ['md-comm-prod-goals', year], queryFn: async () => { const { data } = await supabase.from('commercial_product_goals').select('*').eq('year', year).order('sort_order'); return data || []; }});
  const npsQ = useQuery({ ...QOPTS, queryKey: ['md-nps', year, monthNum], queryFn: async () => { const { data } = await supabase.from('client_nps_records').select('*'); return data || []; }});
  const teamQ = useQuery({ ...QOPTS, queryKey: ['md-team'], queryFn: async () => { const { data } = await supabase.from('team_members').select('*').eq('status', 'ativo'); return data || []; }});
  const tasksQ = useQuery({ ...QOPTS, queryKey: ['md-tasks', year, monthNum], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; }});
  const reportQ = useQuery({ ...QOPTS, queryKey: ['md-report', year, monthNum], queryFn: async () => { const { data } = await supabase.from('monthly_reports').select('*').eq('year', year).eq('month', monthNum).eq('status', 'completed').maybeSingle(); return data; }});

  // Routine tasks for this month
  const routineTasksQ = useQuery({
    ...QOPTS,
    queryKey: ['md-routine-tasks', year, monthNum],
    queryFn: async () => {
      const mStart = format(new Date(year, monthIdx, 1), 'yyyy-MM-dd');
      const mEnd = format(endOfMonth(new Date(year, monthIdx, 1)), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('tasks')
        .select('*, planning_routines:routine_id(title, role_function, recurrence_type), profiles:assigned_to(full_name)')
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['md-comm-goal', year, monthNum] });
      qc.invalidateQueries({ queryKey: ['planning'] });
      qc.invalidateQueries({ queryKey: ['commercial'] });
      setGoalEditOpen(false);
      toast.success('Meta atualizada');
    },
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
      qc.invalidateQueries({ queryKey: ['crm'] });
      qc.invalidateQueries({ queryKey: ['crm_leads'] });
      qc.invalidateQueries({ queryKey: ['commercial'] });
      qc.invalidateQueries({ queryKey: ['planning'] });
      setConvertLead(null);
      toast.success('Cliente criado com sucesso!');
      navigate(`/hub/clientes/${data.id}`);
    },
    onError: () => toast.error('Erro ao criar cliente'),
  });

  // ── Derived data ──
  const goals = planning.allGoals || [];
  const objectives = planning.allObjectives || [];
  const monthGoals = goals.filter((g) => g.period === monthName);
  const progress = planning.getPeriodProgress([monthName]).pct;

  // Objectives linked to this month's goals
  const linkedObjIds = [...new Set(monthGoals.map((g) => g.objective_id).filter(Boolean))];
  const linkedObjectives = objectives.filter((o) => linkedObjIds.includes(o.id));

  const sales = salesQ.data || [];
  const totalInvoiced = sumRevenue(sales);
  const salesActions = salesActionsQ.data || [];
  const commGoal = commMonthGoalQ.data;
  const commProdGoals = commProdGoalQ.data || [];
  const products = productsQ.data || [];

  const allLeads = leadsQ.data || [];
  const monthLeads = useMemo(() => allLeads.filter((l) => {
    const added = l.added_at ? parseISO(l.added_at) : null;
    const updated = l.updated_at ? parseISO(l.updated_at) : null;
    return (added && added >= range.start && added <= range.end) || (updated && updated >= range.start && updated <= range.end);
  }), [allLeads, range.start, range.end]);

  // Defer search input so typing stays smooth even with hundreds of leads
  const deferredCrmSearch = useDeferredValue(crmSearch);
  const filteredLeads = useMemo(() => {
    if (!deferredCrmSearch) return monthLeads;
    const q = deferredCrmSearch.toLowerCase();
    return monthLeads.filter(l =>
      (l.name || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q)
    );
  }, [monthLeads, deferredCrmSearch]);

  // Pre-bucket leads per CRM column to avoid N filter passes on every render
  const leadsByStatus = useMemo(() => {
    const map: Record<string, typeof monthLeads> = {};
    for (const l of monthLeads) {
      (map[l.status] ||= []).push(l);
    }
    return map;
  }, [monthLeads]);

  const CRM_COLUMNS = CRM_STATUSES.map(s => s.value);
  const CRM_LABELS: Record<string, string> = Object.fromEntries(CRM_STATUSES.map(s => [s.value, s.label]));
  const CRM_COLORS: Record<string, string> = Object.fromEntries(CRM_STATUSES.map(s => [s.value, s.color]));

  const allClients = clientsQ.data || [];
  const activeClients = allClients.filter((c) => c.status === 'ativo' || c.status === 'em_onboarding');
  const pausedClients = allClients.filter((c) => c.status === 'pausado');
  const endingClients = allClients.filter((c) => {
    const isTerminado = c.status === 'terminado';
    const endsCycle = c.end_of_cycle ? (() => { const d = parseISO(c.end_of_cycle); return d >= range.start && d <= range.end; })() : false;
    return isTerminado || endsCycle;
  });

  const allEvents = useMemo(() => {
    const events = (eventsQ.data || []).filter((e) => { if (!e.start_date) return false; const d = parseISO(e.start_date); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); }).map((e) => ({ ...e, _type: 'event' }));
    const meetings = (meetingsQ.data || []).filter((m) => { if (!m.date_time) return false; const d = parseISO(m.date_time); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); }).map((m) => ({ ...m, start_date: m.date_time, _type: 'meeting' }));
    return [...events, ...meetings];
  }, [eventsQ.data, meetingsQ.data, calMonth]);

  const allContent = useMemo(
    () => (contentQ.data || []).filter((c) => { if (!c.scheduled_at) return false; const d = parseISO(c.scheduled_at); return d >= range.start && d <= range.end; }),
    [contentQ.data, range.start, range.end]
  );
  const channels = channelsQ.data || [];

  const monthTasks = useMemo(
    () => (tasksQ.data || []).filter((t) => { if (!t.deadline) return false; const d = parseISO(t.deadline); return d >= range.start && d <= range.end; }),
    [tasksQ.data, range.start, range.end]
  );

  const timeEntries = timeEntriesQ.data || [];
  const team = teamQ.data || [];

  // Product review with per-client breakdown
  const productReview = useMemo(() => {
    return products.map((p) => {
      const clientsWithProduct = activeClients.filter((c) =>
        c.current_product_id ? c.current_product_id === p.id : c.current_product === p.name
      );
      const hoursPerClient = p.monthly_hours_per_client || 0;
      const estimatedHours = hoursPerClient * clientsWithProduct.length;

      // Per-client breakdown with real hours from time_entries
      const clientBreakdown = clientsWithProduct.map((c) => {
        const clientTimeEntries = timeEntries.filter((te) => te.client_id === c.id);
        const realHours = Math.round(clientTimeEntries.reduce((s: number, te: any) => s + Number(te.duration || 0), 0) * 10) / 10;
        const deviation = Math.round((realHours - hoursPerClient) * 10) / 10;
        return { clientId: c.id, clientName: c.full_name, clientCode: c.client_id, estimated: hoursPerClient, realHours, deviation };
      });

      const totalRealHours = Math.round(clientBreakdown.reduce((s: number, cb: any) => s + cb.realHours, 0) * 10) / 10;
      const totalDeviation = Math.round((totalRealHours - estimatedHours) * 10) / 10;

      return { id: p.id, name: p.name, clientCount: clientsWithProduct.length, estimatedHours, realHours: totalRealHours, deviation: totalDeviation, clientBreakdown };
    }).filter((p) => p.clientCount > 0);
  }, [products, activeClients, timeEntries]);

  // Team capacity
  const teamCapacity = useMemo(() => {
    return team.map((m) => {
      const monthlyAvailable = monthlyCapacity(m);
      const memberTasks = monthTasks.filter((t) => t.assigned_to === m.profile_id);
      const committed = memberTasks.reduce((s: number, t: any) => s + Number(t.estimated_minutes || 0) / 60, 0);
      return { name: m.full_name, available: Math.round(monthlyAvailable), committed: Math.round(committed), over: committed > monthlyAvailable };
    }).filter(m => m.committed > 0);
  }, [team, monthTasks]);


  // Product sales breakdown for "goal" tab — always show all active products
  const prodSalesData = useMemo(() => {
    const activeProducts = products.filter((p) => p.status !== 'off');
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const yearSales = yearSalesQ.data || [];
    return activeProducts.map((prod) => {
      const prodName = normalize(prod.name);
      const prodSales = sales.filter((s) => {
        const saleName = normalize(s.product || '');
        if (!saleName) return false;
        return saleName === prodName
          || saleName.includes(prodName)
          || prodName.includes(saleName)
          || saleName.replace(/\s*\[.*?\]\s*/g, '') === prodName.replace(/\s*\[.*?\]\s*/g, '');
      });
      const totalFat = sumRevenue(prodSales);
      const pg = commProdGoals.find((g) => {
        const goalName = normalize(g.product_name);
        return goalName === prodName || goalName.includes(prodName) || prodName.includes(goalName);
      });
      const goalAmt = Number(pg?.goal_amount || 0);
      const pct = goalAmt > 0 ? Math.round((totalFat / goalAmt) * 100) : 0;
      const ticketValue = prod.ticket ? parseFloat(prod.ticket.replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0;
      // Mini sparkline data: revenue per month (1..12) for this product
      const monthlySeries = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return sumRevenue(yearSales.filter((s: any) => {
          const sn = normalize(s.product || '');
          return s.sale_month === m && (sn === prodName || sn.includes(prodName) || prodName.includes(sn));
        }));
      });
      return {
        product: prod.name,
        numVendas: prodSales.length,
        price: ticketValue,
        goalAmount: goalAmt,
        totalFat,
        pct,
        monthlySeries,
      };
    });
  }, [commProdGoals, sales, products, yearSalesQ.data]);

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
                  {monthGoals.map((g) => {
                    const obj = objectives.find((o) => o.id === g.objective_id);
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
                        <TableCell className="">{obj ? planAreaLabel(obj.area) : '—'}</TableCell>
                        <TableCell className="text-sm">{obj?.title || '—'}</TableCell>
                        <TableCell className="text-right font-medium">{targetVal > 0 ? `${targetVal.toLocaleString('pt-PT')}${unit}` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{computedActual > 0 ? `${computedActual.toLocaleString('pt-PT', { minimumFractionDigits: unit === '€' ? 2 : 0 })}${unit}` : '0'}</TableCell>
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
            linkedObjectives.length === 0 ? <EmptyHint>Sem objetivos anuais ligados a este mês.</EmptyHint> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Status</TableHead><TableHead>Área</TableHead><TableHead>Objetivo</TableHead><TableHead>Tipo</TableHead><TableHead>Prazo</TableHead><TableHead>Progresso</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linkedObjectives.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setSelectedObjective(o)}>
                      <TableCell><Badge variant={o.status === 'atingido' ? 'default' : 'secondary'} className="text-xs">{planStatusLabel(o.status)}</Badge></TableCell>
                      <TableCell className="">{planAreaLabel(o.area)}</TableCell>
                      <TableCell className="text-sm font-medium">{o.title}</TableCell>
                      <TableCell className="">{o.objective_type === 'quantitativo' ? 'Quantitativo' : 'Qualitativo'}</TableCell>
                      <TableCell className="">{o.deadline || '—'}</TableCell>
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
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => setInlineDetail({
              title: 'Novo Evento',
              kind: 'event',
              id: 'new',
              fields: [{ label: 'Acção', value: 'Para criar um evento, abre a página da Agenda.' }],
              openHref: '/hub/agenda',
            })}><Plus className="h-3 w-3" /> Novo Evento</Button>
          </div>
        </CardHeader>
        <CardContent>
          {renderCalendarGrid(
            allEvents,
            (e: any) => e.start_date ? parseISO(e.start_date) : null,
            (e: any) => <div key={e.id} className={cn("text-[9px] rounded px-1 py-0.5 truncate cursor-pointer", e._type === 'meeting' ? 'bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/20' : 'bg-primary/10 text-primary hover:bg-primary/20')} onClick={() => setInlineDetail({
              title: e.title || 'Sem título',
              kind: e._type === 'meeting' ? 'meeting' : 'event',
              id: e.id,
              fields: [
                { label: 'Data', value: e.start_date ? format(parseISO(e.start_date), "dd/MM/yyyy 'às' HH:mm") : '—' },
                ...(e.status ? [{ label: 'Status', value: <Badge variant="secondary" className="text-[10px]">{e.status}</Badge> }] : []),
                ...(e.location ? [{ label: 'Local', value: e.location }] : []),
                ...(e.meeting_url ? [{ label: 'Link', value: <a href={e.meeting_url} target="_blank" rel="noreferrer" className="text-primary underline">Abrir reunião</a> }] : []),
                ...(e.description ? [{ label: 'Descrição', value: <span className="text-xs whitespace-pre-wrap">{e.description}</span> }] : []),
              ],
              openHref: e._type === 'meeting' ? `/hub/reunioes/${e.id}` : '/hub/agenda',
            })}>{e.title}</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 3: Produtos & Vendas ═══ */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Produtos & Vendas</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Meta estabelecida */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Metas — Trimestre & Mês</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Período</TableHead><TableHead>Intervalo</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">Atual</TableHead><TableHead className="w-40">Progresso</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const qGoal = Number(commQuarterGoalQ.data?.goal_amount || 0);
                    const ys = yearSalesQ.data || [];
                    const qStart = (quarter - 1) * 3 + 1;
                    const qEnd = qStart + 2;
                    const qActual = sumRevenue(ys.filter((s: any) => s.sale_month >= qStart && s.sale_month <= qEnd));
                    const qPct = qGoal > 0 ? Math.round((qActual / qGoal) * 100) : 0;
                    return (
                      <TableRow>
                        <TableCell className="font-medium">T{quarter}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{MONTHS[(quarter-1)*3]} → {MONTHS[(quarter-1)*3+2]}</TableCell>
                        <TableCell className="text-right font-medium">{qGoal > 0 ? `${qGoal.toLocaleString('pt-PT')}€` : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{qActual.toLocaleString('pt-PT')}€</TableCell>
                        <TableCell><div className="flex items-center gap-2"><Progress value={Math.min(qPct, 100)} className="h-1.5 flex-1" /><span className="text-[10px] text-muted-foreground w-9 text-right">{qPct}%</span></div></TableCell>
                      </TableRow>
                    );
                  })()}
                  <TableRow className="cursor-pointer hover:bg-muted/60" onClick={() => { setGoalEditValue(commGoal ? String(commGoal.goal_amount) : ''); setGoalEditOpen(true); }}>
                    <TableCell className="font-medium">{monthName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{range.label}</TableCell>
                    <TableCell className="text-right font-medium">{commGoal ? `${Number(commGoal.goal_amount).toLocaleString('pt-PT')}€` : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{totalInvoiced.toLocaleString('pt-PT')}€</TableCell>
                    <TableCell>
                      {commGoal ? (() => {
                        const p = Math.round((totalInvoiced / Number(commGoal.goal_amount)) * 100);
                        return <div className="flex items-center gap-2"><Progress value={Math.min(p, 100)} className="h-1.5 flex-1" /><span className="text-[10px] text-muted-foreground w-9 text-right">{p}%</span></div>;
                      })() : <span className="text-[10px] text-muted-foreground">Clica para definir</span>}
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
                  <TableHead>Produto</TableHead><TableHead className="text-right">Nº</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">Real</TableHead><TableHead className="w-40">Progresso</TableHead><TableHead>Tendência (ano)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {prodSalesData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-4">Sem produtos ativos.</TableCell></TableRow>
                  ) : prodSalesData.map(p => {
                    const max = Math.max(...p.monthlySeries, 1);
                    return (
                      <TableRow key={p.product}>
                        <TableCell className="text-sm font-medium">{p.product}</TableCell>
                        <TableCell className="text-right">{p.numVendas}</TableCell>
                        <TableCell className="text-right">{p.goalAmount.toLocaleString('pt-PT')}€</TableCell>
                        <TableCell className="text-right font-medium">{p.totalFat.toLocaleString('pt-PT')}€</TableCell>
                        <TableCell>
                          {p.goalAmount > 0 ? (
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(p.pct, 100)} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground w-9 text-right">{p.pct}%</span>
                            </div>
                          ) : <span className="text-[10px] text-muted-foreground">Sem meta</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-end gap-[2px] h-7" title="Vendas mensais (1-12)">
                            {p.monthlySeries.map((v, i) => {
                              const h = Math.max(2, Math.round((v / max) * 28));
                              const isCur = i + 1 === monthNum;
                              return <div key={i} className={cn('w-1.5 rounded-sm', isCur ? 'bg-primary' : v > 0 ? 'bg-primary/40' : 'bg-muted')} style={{ height: h }} />;
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                  ) : sales.map((sl) => {
                    const eff = getEffectiveSaleStatus(sl.status, sl.payment_date);
                    const info = getSaleStatusInfo(eff);
                    return (
                      <TableRow key={sl.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setInlineDetail({
                        title: `${sl.sale_id} — ${sl.client || ''}`,
                        kind: 'sale', id: sl.id,
                        fields: [
                          { label: 'Cliente', value: sl.client || '—' },
                          { label: 'Produto', value: sl.product || '—' },
                          { label: 'Valor', value: `${Number(sl.invoice_total || 0).toLocaleString('pt-PT')}€` },
                          { label: 'Data pagamento', value: sl.payment_date ? format(parseISO(sl.payment_date), 'dd/MM/yyyy') : '—' },
                          { label: 'Status', value: <Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge> },
                        ],
                        openHref: `/hub/comercial/vendas/${sl.id}`,
                      })}>
                        <TableCell>{sl.sale_id}</TableCell>
                        <TableCell className="text-sm">{sl.client || '—'}</TableCell>
                        <TableCell className="text-sm">{sl.product || '—'}</TableCell>
                        <TableCell className="text-sm text-right">{Number(sl.invoice_total || 0).toLocaleString('pt-PT')}€</TableCell>
                        <TableCell><Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
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
                  {salesActions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                      <TableCell className="text-sm">{a.action_name}</TableCell>
                      <TableCell className="">{a.start_date ? format(parseISO(a.start_date), 'dd/MM') : '—'}{a.end_date ? ` → ${format(parseISO(a.end_date), 'dd/MM')}` : ''}</TableCell>
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
              qc.invalidateQueries({ queryKey: ['content_items'] });
              qc.invalidateQueries({ queryKey: ['marketing'] });
              qc.invalidateQueries({ queryKey: ['agenda'] });
              navigate(`/hub/marketing/conteudos/${data.id}`);
            }}><Plus className="h-3 w-3" /> Novo Conteúdo</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel tabs */}
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant={contentTab === 'calendario' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setContentTab('calendario')}>Calendário</Button>
            {channels.map((ch) => (
              <Button key={ch.id} size="sm" variant={contentTab === ch.id ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setContentTab(ch.id)}>{ch.name}</Button>
            ))}
          </div>

          {renderCalendarGrid(
            contentTab === 'calendario' ? allContent : allContent.filter((c) => c.content_channels?.some((cc) => cc.channel_id === contentTab)),
            (c: any) => c.scheduled_at ? parseISO(c.scheduled_at) : null,
            (c: any) => <div key={c.id} className="text-[9px] bg-accent/50 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-accent" onClick={() => setInlineDetail({
              title: c.title || 'Sem título',
              kind: 'content', id: c.id,
              fields: [
                { label: 'Agendado', value: c.scheduled_at ? format(parseISO(c.scheduled_at), 'dd/MM/yyyy HH:mm') : '—' },
                ...(c.content_type ? [{ label: 'Tipo', value: c.content_type }] : []),
                ...(c.status ? [{ label: 'Status', value: <Badge variant="secondary" className="text-[10px]">{c.status}</Badge> }] : []),
                ...(c.product_name ? [{ label: 'Produto', value: c.product_name }] : []),
                ...(c.notes ? [{ label: 'Notas', value: <span className="text-xs whitespace-pre-wrap">{c.notes}</span> }] : []),
              ],
              openHref: `/hub/marketing/conteudos/${c.id}`,
            })}>{c.title}</div>
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 5: CRM ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">CRM</CardTitle>
            <div className="flex gap-1 ml-auto items-center">
              <div className="flex gap-1">
                <Button size="sm" variant={crmView === 'board' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setCrmView('board')}>Board</Button>
                <Button size="sm" variant={crmView === 'list' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setCrmView('list')}>Lista</Button>
              </div>
              {crmView === 'list' && (
                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={crmSearch} onChange={e => setCrmSearch(e.target.value)} placeholder="Pesquisar..." className="h-6 text-[10px] pl-6 w-40" />
                </div>
              )}
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => { setSelectedLead({ id: null, status: 'novo', name: '' } as any); setLeadSheetOpen(true); }}><Plus className="h-3 w-3" /> Nova Lead</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {crmView === 'list' ? (
            (() => {
              const filtered = filteredLeads;
              return filtered.length === 0 ? (
                <EmptyHint>Sem leads correspondentes.</EmptyHint>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Próximo follow-up</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map(l => (
                      <TableRow key={l.id} className="cursor-pointer hover:bg-muted/60" onClick={() => { setSelectedLead(l); setLeadSheetOpen(true); }}>
                        <TableCell className="text-sm font-medium">{l.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.email || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={cn('text-[10px]', CRM_COLORS[l.status])}>{CRM_LABELS[l.status] || l.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.next_followup ? format(parseISO(l.next_followup), 'dd/MM/yyyy') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()
          ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2" style={{ minWidth: CRM_COLUMNS.length * 180 }}>
              {CRM_COLUMNS.map(col => {
                const colLeads = leadsByStatus[col] || [];
                return (
                  <div key={col} className="w-44 shrink-0">
                    <div className={cn('text-[10px] font-medium mb-1.5 px-2 py-1 rounded-md', CRM_COLORS[col] || 'text-muted-foreground')}>{CRM_LABELS[col]} <Badge variant="outline" className="text-[9px] ml-1">{colLeads.length}</Badge></div>
                    <div className="space-y-2">
                      {colLeads.map((l) => {
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
          )}
        </CardContent>
      </Card>

      {/* ═══ SECTION 6: Clientes Ativos & Renovações ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-sm">Clientes Ativos & Renovações</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => setInlineDetail({ title: 'Novo Cliente', kind: 'client', id: 'new', fields: [{ label: 'Acção', value: 'Para criar um cliente, abre a página Clientes.' }], openHref: '/hub/clientes' })}><Plus className="h-3 w-3" /> Novo Cliente</Button>
            <div className="flex gap-1 ml-auto">
              <Button size="sm" variant={clientTab === 'ativos' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('ativos')}>Clientes Ativos ({activeClients.length})</Button>
              <Button size="sm" variant={clientTab === 'pausados' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('pausados')}>Em Pausa ({pausedClients.length})</Button>
              <Button size="sm" variant={clientTab === 'terminar' ? 'default' : 'outline'} className="h-6 text-[10px] px-2" onClick={() => setClientTab('terminar')}>A terminar este mês ({endingClients.length})</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const list = clientTab === 'ativos' ? activeClients : clientTab === 'pausados' ? pausedClients : endingClients;
            const showEnd = clientTab === 'terminar';
            const emptyMsg = clientTab === 'ativos' ? 'Sem clientes ativos.' : clientTab === 'pausados' ? 'Sem clientes em pausa.' : 'Sem clientes a terminar este mês.';
            return (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>Data Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Whatsapp</TableHead>{showEnd && <TableHead>Fim de Ciclo</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={showEnd ? 7 : 6} className="text-center text-sm text-muted-foreground py-4">{emptyMsg}</TableCell></TableRow>
                  ) : list.map((c) => {
                    const info = getClientStatusInfo(c.status);
                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setInlineDetail({
                        title: c.full_name,
                        kind: 'client', id: c.id,
                        fields: [
                          { label: 'ID', value: c.client_id },
                          { label: 'Status', value: <Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge> },
                          { label: 'Email', value: c.email || '—' },
                          { label: 'Whatsapp', value: c.whatsapp || '—' },
                          { label: 'Produto atual', value: c.current_product || '—' },
                          { label: 'Início', value: c.start_date || '—' },
                          ...(c.end_of_cycle ? [{ label: 'Fim de Ciclo', value: c.end_of_cycle }] : []),
                        ],
                        openHref: `/hub/clientes/${c.id}`,
                      })}>
                        <TableCell>{c.client_id}</TableCell>
                        <TableCell>{c.start_date || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge></TableCell>
                        <TableCell className="text-sm font-medium">{c.full_name}</TableCell>
                        <TableCell>{c.email || '—'}</TableCell>
                        <TableCell>{c.whatsapp || '—'}</TableCell>
                        {showEnd && <TableCell><Badge variant="outline" className="text-[10px] border-warning/40 text-warning">{c.end_of_cycle || '—'}</Badge></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>

      {/* ═══ SECTION 7: Pagamentos ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Pagamentos de Clientes</CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => setInlineDetail({ title: 'Nova Venda', kind: 'sale', id: 'new', fields: [{ label: 'Acção', value: 'Para registar uma venda, abre o módulo Comercial.' }], openHref: '/hub/comercial/vendas' })}><Plus className="h-3 w-3" /> Nova Venda</Button>
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
              ) : sales.map((sl) => {
                const eff = getEffectiveSaleStatus(sl.status, sl.payment_date);
                const info = getSaleStatusInfo(eff);
                return (
                  <TableRow key={sl.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setInlineDetail({
                    title: `${sl.sale_id} — ${sl.client || ''}`,
                    kind: 'sale', id: sl.id,
                    fields: [
                      { label: 'Cliente', value: sl.client || '—' },
                      { label: 'Produto', value: sl.product || '—' },
                      { label: 'Valor base', value: `${Number(sl.base_value || 0).toLocaleString('pt-PT')}€` },
                      { label: 'Total c/IVA', value: `${Number(sl.invoice_total || 0).toLocaleString('pt-PT')}€` },
                      { label: 'Data pagamento', value: sl.payment_date ? format(parseISO(sl.payment_date), 'dd/MM/yyyy') : '—' },
                      { label: 'Descrição', value: sl.description || '—' },
                      { label: 'Status', value: <Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge> },
                    ],
                    openHref: `/hub/comercial/vendas/${sl.id}`,
                  })}>
                    <TableCell>{sl.sale_id}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-[10px]', info.color)}>{info.label}</Badge></TableCell>
                    <TableCell>{sl.payment_date ? format(parseISO(sl.payment_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>{sl.description || '—'}</TableCell>
                    <TableCell className="text-right">{Number(sl.base_value || 0).toLocaleString('pt-PT')}€</TableCell>
                    <TableCell>{sl.product || '—'}</TableCell>
                    <TableCell>{sl.client || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ═══ SECTION 7B: Visão de Tarefas ═══ */}
      <MonthDetailTasksCard year={year} monthNum={monthNum} tasks={monthTasks} team={team} />

      {/* ═══ SECTION 8: Revisão Operacional ═══ */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revisão Operacional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {productReview.length === 0 ? (
            <EmptyHint>Sem produtos com clientes ativos para análise.</EmptyHint>
          ) : (
            <>
              {productReview.map((p) => (
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
                        {p.clientBreakdown.map((cb) => {
                          const isOver = cb.deviation > 2;
                          const isUnder = cb.deviation < -2;
                          return (
                            <TableRow key={cb.clientId} className={cn('cursor-pointer hover:bg-muted/60', isOver && 'bg-destructive/5')} onClick={() => setExpandedClient({ ...cb, productName: p.name })}>
                              <TableCell className="">{cb.clientName} <span className="text-muted-foreground">({cb.clientCode})</span></TableCell>
                              <TableCell className="text-right">{cb.estimated}h</TableCell>
                              <TableCell className="text-right">{cb.realHours}h</TableCell>
                              <TableCell className="text-right">
                                {isOver ? <span className="text-destructive font-medium">+{cb.deviation}h</span> : isUnder ? <span className="text-info font-medium">{cb.deviation}h</span> : <span>{cb.deviation > 0 ? '+' : ''}{cb.deviation}h</span>}
                              </TableCell>
                              <TableCell>
                                {isOver ? <Badge variant="destructive" className="text-[9px]">Acima</Badge> : isUnder ? <Badge  variant="info" className="text-[9px]">Abaixo</Badge> : <Badge variant="secondary" className="text-[9px]">OK</Badge>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {Math.abs(p.deviation) >= 5 && (
                    <div className="rounded-md border border-warning bg-warning/15 dark:bg-warning/20 dark:border-warning p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-xs text-warning dark:text-warning flex-1">
                        O produto <strong>{p.name}</strong> demorou <strong>{Math.abs(p.deviation)}h</strong> {p.deviation > 0 ? 'a mais' : 'a menos'} do que o estimado.
                        {p.clientBreakdown.filter((cb) => cb.deviation > 2).length > 0 && (
                          <> Os clientes fora do normal: <strong>{p.clientBreakdown.filter((cb) => cb.deviation > 2).map((cb) => cb.clientName).join(', ')}</strong>.</>
                        )}
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => navigate(`/hub/produtos/${p.id}`)}><ExternalLink className="h-3 w-3" /> Ver produto</Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {teamCapacity.filter(m => m.over).map(m => (
            <div key={m.name} className="rounded-md border border-warning bg-warning/15 dark:bg-warning/20 dark:border-warning p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning dark:text-warning">Este mês <strong>{m.name}</strong> teve <strong>{m.committed}h</strong> comprometidas com <strong>{m.available}h</strong> disponíveis. Considera redistribuir clientes.</p>
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
              const done = tasks.filter((t) => isTaskDone(t)).length;
              const total = tasks.length;
              if (total === 0) return null;
              const pct = Math.round((done / total) * 100);
              return <Badge variant="outline" className="text-[10px] ml-auto">{done}/{total} ({pct}%)</Badge>;
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(routineTasksQ.data || []).length === 0 ? (
            <EmptyHint>Sem rotinas configuradas para este mês.</EmptyHint>
          ) : (
            <div className="space-y-2">
              {(routineTasksQ.data || []).map((t) => {
                const isDone = isTaskDone(t);
                const deadlineDate = t.deadline ? parseISO(t.deadline) : null;
                const completedAt = (t as any).completed_at ? parseISO((t as any).completed_at) : null;
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
                        <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning dark:bg-warning/20 dark:text-warning">Atrasada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success dark:bg-success/20 dark:text-success">No prazo</Badge>
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
          <Suspense fallback={null}>
            <WeeklyAlignDetailSheet
              open={!!selectedRoutineTask}
              onOpenChange={(o) => !o && setSelectedRoutineTask(null)}
              title={t.name}
              subtitle="Tarefa de rotina"
              fields={fields}
            />
          </Suspense>
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
          const esc = (value: unknown) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          const f = fmtV;
          const fin = rd.financial || {};
          const com = rd.commercial || {};
          const cli = rd.clients || {};
          const ops = rd.operations || {};
          const tm = rd.team || {};
          const crm = rd.crm || {};
          const safeLabel = esc(label);
          const topHtml = (com.topProducts || []).map(([n, v]: [string, number]) => `<tr><td>${esc(n)}</td><td style="text-align:right;font-weight:600">€${f(v)}</td></tr>`).join('');

          const pw = window.open('', '_blank', 'width=900,height=700');
          if (!pw) { toast.error('Popup bloqueado'); return; }
          pw.document.write(`<!DOCTYPE html><html><head><title>Relatório ${safeLabel}</title>
<style>@page{size:A4;margin:18mm 15mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;color:#1a1a1a;line-height:1.5}.header{border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}.header h1{font-size:18px;font-weight:700}.header .date{font-size:10px;color:#6b7280}h2{font-size:13px;font-weight:700;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.5px;color:#374151}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.kpi{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}.kpi .label{font-size:9px;text-transform:uppercase;color:#6b7280;letter-spacing:.3px}.kpi .value{font-size:16px;font-weight:700;margin-top:2px}.kpi .sub{font-size:9px;color:#6b7280;margin-top:1px}.section-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.card{border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}.card h3{font-size:11px;font-weight:600;margin-bottom:6px}.row{display:flex;justify-content:space-between;font-size:10px;padding:3px 0}.row .lbl{color:#6b7280}.row .val{font-weight:600}.green{color:#059669}.red{color:#dc2626}.progress-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin:4px 0}.progress-fill{height:100%;background:#3b82f6;border-radius:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-weight:600;background:#f9fafb}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header"><h1>Relatório Mensal — ${safeLabel}</h1><span class="date">Gerado em ${new Date(rd.generatedAt || Date.now()).toLocaleDateString('pt-PT')}</span></div>
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
              <div className="flex items-center gap-2">
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
              <EmptyHint>Nenhum relatório gerado para este mês. Clica em "Gerar Relatório" para compilar os dados.</EmptyHint>
            )}
          </div>
        );
      })()}

      {/* ═══ DETAIL SHEETS ═══ */}
      <Suspense fallback={null}>
        {selectedObjective && (
          <ObjectiveDetailSheet
            open={!!selectedObjective}
            onClose={() => setSelectedObjective(null)}
            objective={selectedObjective}
            planning={planning}
          />
        )}
        {objDialogOpen && (
          <ObjectiveDialog
            open={objDialogOpen}
            onClose={() => setObjDialogOpen(false)}
            initial={null}
            onSave={(data: any) => { planning.upsertObjective.mutate(data); setObjDialogOpen(false); }}
          />
        )}
      </Suspense>

      {/* Client time entries dialog */}
      <Dialog open={!!expandedClient} onOpenChange={(open) => { if (!open) setExpandedClient(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {expandedClient && (() => {
            const clientEntries = timeEntries.filter((te) => te.client_id === expandedClient.clientId);
            const totalHours = Math.round(clientEntries.reduce((s: number, te: any) => s + Number(te.duration || 0), 0) * 10) / 10;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-base">{expandedClient.clientName} <span className="text-muted-foreground font-normal text-sm">({expandedClient.clientCode})</span> — {expandedClient.productName}</DialogTitle>
                  <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                    <span>Estimado: <strong className="text-foreground">{expandedClient.estimated}h</strong></span>
                    <span>Real: <strong className="text-foreground">{expandedClient.realHours}h</strong></span>
                    <span>Desvio: <strong className={cn(expandedClient.deviation > 2 ? 'text-destructive' : expandedClient.deviation < -2 ? 'text-info' : 'text-foreground')}>{expandedClient.deviation > 0 ? '+' : ''}{expandedClient.deviation}h</strong></span>
                  </div>
                </DialogHeader>
                {clientEntries.length === 0 ? (
                  <EmptyHint>Sem registos de tempo para este cliente neste mês.</EmptyHint>
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
                      {clientEntries.sort((a, b) => (a.entry_date || '').localeCompare(b.entry_date || '')).map((te) => {
                        const memberName = team.find((m) => m.id === te.member_id)?.full_name || '—';
                        return (
                          <TableRow key={te.id}>
                            <TableCell className="">{te.entry_date}</TableCell>
                            <TableCell className="">{te.description || '—'}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{te.category || '—'}</Badge></TableCell>
                            <TableCell className="">{memberName}</TableCell>
                            <TableCell className="text-right font-medium">{te.duration}h</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={4} className="text-right">Total</TableCell>
                        <TableCell className="text-right font-bold">{totalHours}h</TableCell>
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
      {leadSheetOpen && (
        <Suspense fallback={null}>
          <LeadDetailSheet
            open={leadSheetOpen}
            onOpenChange={v => { setLeadSheetOpen(v); if (!v) setSelectedLead(null); }}
            lead={selectedLead}
            products={(commProdGoalQ.data || []).map((p) => p.product_name)}
            profiles={[]}
            onSave={(lead) => {
              upsertLead.mutate(lead, {
                onSuccess: () => {
                  setLeadSheetOpen(false);
                  setSelectedLead(null);
                  qc.invalidateQueries({ queryKey: ['md-leads'] });
                  qc.invalidateQueries({ queryKey: ['crm'] });
                  qc.invalidateQueries({ queryKey: ['crm_leads'] });
                  qc.invalidateQueries({ queryKey: ['commercial'] });
                },
              });
            }}
            onDelete={(id) => {
              deleteLead.mutate(id, {
                onSuccess: () => {
                  setLeadSheetOpen(false);
                  setSelectedLead(null);
                  qc.invalidateQueries({ queryKey: ['md-leads'] });
                  qc.invalidateQueries({ queryKey: ['crm'] });
                  qc.invalidateQueries({ queryKey: ['crm_leads'] });
                  qc.invalidateQueries({ queryKey: ['commercial'] });
                },
              });
            }}
          />
        </Suspense>
      )}

      {/* ═══ Inline Detail Sheet (events / content / sales / clients) ═══ */}
      <Sheet open={!!inlineDetail} onOpenChange={v => { if (!v) setInlineDetail(null); }}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          {inlineDetail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{inlineDetail.title}</SheetTitle>
                <SheetDescription className="text-[10px] uppercase tracking-wider">{inlineDetail.kind}</SheetDescription>
              </SheetHeader>
              <Separator className="my-4" />
              <div className="space-y-3">
                {inlineDetail.fields.map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <span className="text-sm text-right font-medium">{f.value}</span>
                  </div>
                ))}
                {inlineDetail.openHref && (
                  <Button variant="outline" size="sm" className="w-full mt-4 gap-2" onClick={() => navigate(inlineDetail.openHref!)}>
                    <ExternalLink className="h-3 w-3" /> Abrir página completa
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
