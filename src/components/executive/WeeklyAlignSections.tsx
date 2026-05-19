import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { getMonthName } from '@/hooks/useExecutiveData';
import { planStatusLabel } from '@/hooks/usePlanningData';
import { DeltaBadge } from './WeeklyAlignKpis';
import type { DetailField } from './WeeklyAlignDetailSheet';
import { isTaskDone } from '@/lib/taskStatus';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { getClientStatusInfo } from '@/lib/clientStatus';
import { getProjectStatusInfo } from '@/lib/projectStatus';

const clickableRow = "cursor-pointer hover:bg-muted/70 transition-colors";

const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const formatEur = (n: number | null | undefined) => (n == null || isNaN(Number(n))) ? '—' : eurFormatter.format(Number(n));
const formatNum = (n: number | null | undefined) => (n == null || isNaN(Number(n))) ? '—' : new Intl.NumberFormat('pt-PT').format(Number(n));

// ─── helpers ───
function getNpsRowColor(expectedDate: string, status: string) {
  if (status === 'feito') return 'bg-success/15 border-l-4 border-l-emerald-500';
  const diff = differenceInDays(parseISO(expectedDate), new Date());
  if (diff < 0) return 'bg-destructive/15 border-l-4 border-l-red-500';
  return 'bg-warning/15 border-l-4 border-l-amber-500';
}

function autoNpsStatus(expectedDate: string, currentStatus: string) {
  if (currentStatus === 'feito') return 'feito';
  if (differenceInDays(parseISO(expectedDate), new Date()) < 0) return 'em_atraso';
  return 'por_fazer';
}

// ─── Section 1: Metas ───
interface MetasSectionProps {
  planning: any;
  currentMonth: number;
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function MetasSection({ planning, currentMonth, onOpenDetail }: MetasSectionProps) {
  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const currentMonthName = MONTH_NAMES[currentMonth - 1];
  const monthPlanGoals = planning.allGoals.filter((g: any) => g.period === currentMonthName);
  const overdueMetrics = planning.allMetrics.filter((m: any) => planning.isMetricOverdue(m));

  const CURRENCY_SOURCES = new Set(['commercial', 'bd_vendas', 'bd_despesas']);
  const fmtGoalValue = (obj: any, v: number | null | undefined) =>
    obj && CURRENCY_SOURCES.has(obj.value_source) ? formatEur(v) : formatNum(v);

  const openGoalDetail = (g: any) => {
    const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
    const isCurrency = obj && CURRENCY_SOURCES.has(obj.value_source);
    const fmt = (v: any) => isCurrency ? formatEur(Number(v)) : formatNum(Number(v));
    onOpenDetail(g.period || 'Meta', 'Meta', [
      { label: 'Objetivo Anual', value: obj?.title },
      { label: 'Período', value: g.period },
      { label: 'Status', value: planStatusLabel(g.status), badge: true, badgeVariant: g.status === 'atingido' ? 'default' : 'secondary' },
      { label: 'Valor alvo', value: g.target_value != null ? fmt(g.target_value) : '—' },
      { label: 'Valor real', value: g.actual_value != null ? fmt(g.actual_value) : '—' },
    ]);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">1 // Metas</h2>
      <Tabs defaultValue="metas">
        <TabsList><TabsTrigger value="metas">Metas do mês</TabsTrigger><TabsTrigger value="metricas_atraso">Métricas em atraso</TabsTrigger></TabsList>
        <TabsContent value="metas">
          <Card><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Objetivo Anual</TableHead><TableHead>Período</TableHead><TableHead>Valor alvo</TableHead><TableHead>Valor real</TableHead><TableHead>Desvio</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {monthPlanGoals.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">Sem metas este mês</TableCell></TableRow> :
                  monthPlanGoals.map((g: any) => {
                    const obj = planning.allObjectives.find((o: any) => o.id === g.objective_id);
                    const autoVal = obj ? planning.goalAutoValue(obj, g.period) : null;
                    const actualValueRaw = autoVal != null
                      ? Number(autoVal)
                      : (g.actual_value != null ? Number(g.actual_value) : null);
                    const targetValue = g.target_value != null ? Number(g.target_value) : null;
                    const dev = (actualValueRaw != null && targetValue != null && targetValue > 0)
                      ? actualValueRaw - targetValue
                      : null;
                    return (
                      <TableRow key={g.id} className={clickableRow} onClick={() => openGoalDetail(g)}>
                        <TableCell className="">{obj?.title || '—'}</TableCell>
                        <TableCell className="text-sm">{g.period}</TableCell>
                        <TableCell className="">{fmtGoalValue(obj, targetValue)}</TableCell>
                        <TableCell className="">{fmtGoalValue(obj, actualValueRaw)}</TableCell>
                        <TableCell className={dev != null && dev < 0 ? 'text-destructive font-medium' : dev != null && dev >= 0 ? 'text-success font-medium' : ''}>
                          {dev != null ? `${dev >= 0 ? '+' : ''}${fmtGoalValue(obj, dev)}` : '—'}
                        </TableCell>
                        <TableCell><Badge variant={g.status === 'atingido' ? 'default' : 'secondary'} className="text-[10px]">{planStatusLabel(g.status)}</Badge></TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </div></Card>
        </TabsContent>
        <TabsContent value="metricas_atraso">
          <Card><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Objetivo</TableHead><TableHead>Métrica</TableHead><TableHead>Última atualização</TableHead><TableHead>Dias em atraso</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {overdueMetrics.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">Sem métricas em atraso</TableCell></TableRow> :
                  overdueMetrics.map((m: any) => {
                    const obj = planning.allObjectives.find((o: any) => o.id === m.objective_id);
                    const daysOverdue = m.last_updated_at ? Math.floor((new Date().getTime() - new Date(m.last_updated_at).getTime()) / (1000 * 60 * 60 * 24)) : '—';
                    return (
                      <TableRow key={m.id} className="bg-destructive/15">
                        <TableCell className="">{obj?.title || '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{m.name}</TableCell>
                        <TableCell className="">{m.last_updated_at ? new Date(m.last_updated_at).toLocaleDateString('pt-PT') : 'Nunca'}</TableCell>
                        <TableCell className="text-destructive font-medium">{daysOverdue} dias</TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </div></Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

// ─── Section 2: Agenda do mês ───
interface AgendaSectionProps {
  events: any[];
  meetings?: any[];
  contents?: any[];
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function AgendaSection({ events, meetings = [], contents = [], onOpenDetail }: AgendaSectionProps) {
  const openEventDetail = (e: any) => {
    if (e._kind === 'meeting') {
      onOpenDetail(e.title, 'Reunião', [
        { label: 'Data', value: e.date_time?.slice(0, 16)?.replace('T', ' ') },
        { label: 'Status', value: e.status, badge: true },
      ]);
      return;
    }
    if (e._kind === 'content') {
      onOpenDetail(e.title, 'Conteúdo', [
        { label: 'Data', value: e.scheduled_at?.slice(0, 10) },
        { label: 'Status', value: e.status, badge: true },
      ]);
      return;
    }
    onOpenDetail(e.title, 'Evento', [
      { label: 'Data início', value: e.start_date?.slice(0, 10) },
      { label: 'Data fim', value: e.end_date?.slice(0, 10) },
      { label: 'Departamento', value: e.department },
      { label: 'Cliente', value: e.client_name },
      { label: 'Notas', value: e.notes },
    ]);
  };

  // Unificar eventos + reuniões + conteúdos por data ascendente
  const combined = [
    ...events.map((e) => ({ ...e, _kind: 'event' as const, _date: e.start_date, _label: e.title, _type: 'Evento' })),
    ...meetings.map((m) => ({ ...m, _kind: 'meeting' as const, _date: m.date_time, _label: m.title, _type: 'Reunião' })),
    ...contents.map((c) => ({ ...c, _kind: 'content' as const, _date: c.scheduled_at, _label: c.title, _type: 'Conteúdo' })),
  ]
    .filter((x) => x._date)
    .sort((a, b) => String(a._date).localeCompare(String(b._date)));

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">2 // Agenda da semana</h2>
      <Card><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Título</TableHead></TableRow></TableHeader>
          <TableBody>
            {combined.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-6">Sem eventos</TableCell></TableRow> :
              combined.map((e: any) => (
                <TableRow key={`${e._kind}-${e.id}`} className={clickableRow} onClick={() => openEventDetail(e)}>
                  <TableCell className="">{String(e._date).slice(0, 10)}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{e._type}</Badge></TableCell>
                  <TableCell className="text-sm">{e._label}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div></Card>
    </section>
  );
}

// ─── Section 3: Vendas & Faturação ───
interface VendasSectionProps {
  salesWeek: any[];
  salesActions: any[];
  salesWeekTotal: number;
  prevSalesWeekTotal: number;
  totalBilled: number;
  billingGoal: number;
  currentMonth: number;
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function VendasSection({ salesWeek, salesActions, salesWeekTotal, prevSalesWeekTotal, totalBilled, billingGoal, currentMonth, onOpenDetail }: VendasSectionProps) {
  const navigate = useNavigate();
  const billingPct = billingGoal > 0 ? Math.round((totalBilled / billingGoal) * 100) : 0;

  const openSaleActionDetail = (a: any) => onOpenDetail(a.action_name, 'Ação de venda', [
    { label: 'Status', value: a.status, badge: true },
    { label: 'Tipo', value: a.action_type },
    { label: 'Produto', value: a.product },
    { label: 'Objetivo', value: a.objective },
    { label: 'Data início', value: a.start_date },
    { label: 'Data fim', value: a.end_date },
    { label: 'Resultado', value: a.result },
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">3 // Vendas & Faturação</h2>
          <DeltaBadge current={salesWeekTotal} previous={prevSalesWeekTotal} isCurrency />
        </div>
        <Link to="/hub/comercial/vendas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver vendas <ArrowUpRight className="h-3 w-3" /></Link>
      </div>
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-medium">Status faturação — {getMonthName(currentMonth)}</h3>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${Math.min(billingPct, 100)}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">€{totalBilled.toLocaleString()} faturado</span>
          <span className="font-medium">{billingPct}%</span>
          <span className="text-muted-foreground">Meta: €{billingGoal.toLocaleString()}</span>
        </div>
        {billingGoal > 0 && totalBilled < billingGoal && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-accent">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-sm font-medium">Falta faturar €{(billingGoal - totalBilled).toLocaleString()} para atingir a meta deste mês</span>
          </div>
        )}
        {billingGoal > 0 && totalBilled >= billingGoal && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-success/10 border border-success/30">
            <span className="text-sm font-medium text-success">Meta atingida! 🎉 Faturaste +€{(totalBilled - billingGoal).toLocaleString()} acima da meta</span>
          </div>
        )}
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <h3 className="text-sm font-medium mb-2">Vendas esta semana</h3>
        {salesWeek.length === 0 ? <EmptyHint>Sem vendas esta semana</EmptyHint> :
          <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>{salesWeek.map(s => (
              <TableRow key={s.id} className={clickableRow} onClick={() => navigate(`/hub/comercial/vendas/${s.id}`)}>
                <TableCell className="">{s.sale_id}</TableCell><TableCell className="">{s.client}</TableCell><TableCell className="">{s.product}</TableCell><TableCell className="">€{Number(s.invoice_total).toLocaleString()}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        }
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <h3 className="text-sm font-medium mb-2">Ações de venda</h3>
        {salesActions.length === 0 ? <EmptyHint>Sem ações ativas</EmptyHint> :
          <Table><TableHeader><TableRow><TableHead>Ação</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Produto</TableHead></TableRow></TableHeader>
            <TableBody>{salesActions.map(a => (
              <TableRow key={a.id} className={clickableRow} onClick={() => openSaleActionDetail(a)}>
                <TableCell className="">{a.action_name}</TableCell><TableCell className="">{a.action_type}</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{a.status}</Badge></TableCell><TableCell className="">{a.product}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        }
      </CardContent></Card>
    </section>
  );
}

// ─── Section 4: Leads ───
interface LeadsSectionProps {
  leads: any[];
  followUps: any[];
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function LeadsSection({ leads, followUps, onOpenDetail }: LeadsSectionProps) {
  const openLeadDetail = (l: any) => onOpenDetail(l.name, 'Lead', [
    { label: 'Status', value: l.status, badge: true },
    { label: 'Valor estimado', value: l.estimated_value ? `€${Number(l.estimated_value).toLocaleString()}` : null },
    { label: 'Telefone', value: l.phone },
    { label: 'Email', value: l.email },
    { label: 'Origem', value: l.source },
    { label: 'Produto potencial', value: l.potential_product },
    { label: 'Contexto', value: l.context },
    { label: 'Próximo follow-up', value: l.next_followup },
    { label: 'Notas follow-up', value: l.followup_notes },
  ]);

  const LeadTable = ({ data }: { data: any[] }) => (
    <Card><div className="overflow-x-auto">
      <Table><TableHeader><TableRow>
        <TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead>Próx. FU</TableHead><TableHead>Notas FU</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {data.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem leads</TableCell></TableRow> :
          data.map(l => (
            <TableRow key={l.id} className={clickableRow} onClick={() => openLeadDetail(l)}>
              <TableCell className="text-sm font-medium">{l.name}</TableCell>
              <TableCell><Badge variant="secondary" className="text-[10px]">{l.status}</Badge></TableCell>
              <TableCell className="">{l.estimated_value ? `€${Number(l.estimated_value).toLocaleString()}` : '—'}</TableCell>
              <TableCell className="">{l.phone || '—'}</TableCell>
              <TableCell className="">{l.email || '—'}</TableCell>
              <TableCell className="">{l.next_followup || '—'}</TableCell>
              <TableCell className="max-w-[150px] truncate">{l.followup_notes || '—'}</TableCell>
            </TableRow>
          ))
        }
      </TableBody></Table>
    </div></Card>
  );

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">4 // Leads & Oportunidades</h2>
      <Tabs defaultValue="aberto">
        <TabsList><TabsTrigger value="aberto">Leads em aberto</TabsTrigger><TabsTrigger value="followups">Follow-ups a fazer</TabsTrigger></TabsList>
        <TabsContent value="aberto"><LeadTable data={leads} /></TabsContent>
        <TabsContent value="followups"><LeadTable data={followUps} /></TabsContent>
      </Tabs>
    </section>
  );
}

// ─── Section 5: Clientes ───
interface ClientesSectionProps {
  onboardingClients: any[];
  renewalClients: any[];
}

export function ClientesSection({ onboardingClients, renewalClients }: ClientesSectionProps) {
  const navigate = useNavigate();

  const ClientTable = ({ data }: { data: any[] }) => (
    <Card><div className="overflow-x-auto">
      <Table><TableHeader><TableRow>
        <TableHead>ID</TableHead><TableHead>Início</TableHead><TableHead>Status</TableHead><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Produto</TableHead><TableHead>Fim Ciclo</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {data.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Nenhum</TableCell></TableRow> :
          data.map(c => {
            const st = getClientStatusInfo(c.status);
            return (
              <TableRow key={c.id} className={clickableRow} onClick={() => navigate(`/hub/clientes/${c.id}`)}>
                <TableCell className="">{c.client_id || '—'}</TableCell>
                <TableCell className="">{c.start_date || '—'}</TableCell>
                <TableCell><span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium', st.color)}>{st.label}</span></TableCell>
                <TableCell className="text-sm">{c.full_name}</TableCell>
                <TableCell className="">{c.email || '—'}</TableCell>
                <TableCell className="">{c.current_product || '—'}</TableCell>
                <TableCell className="">{c.end_of_cycle || '—'}</TableCell>
              </TableRow>
            );
          })
        }
      </TableBody></Table>
    </div></Card>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">5 // Clientes</h2>
        <Link to="/hub/clientes" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Ver todos <ArrowUpRight className="h-3 w-3" /></Link>
      </div>
      <Tabs defaultValue="onboarding">
        <TabsList><TabsTrigger value="onboarding">Em onboarding</TabsTrigger><TabsTrigger value="renovacoes">Próximas renovações</TabsTrigger></TabsList>
        <TabsContent value="onboarding"><ClientTable data={onboardingClients} /></TabsContent>
        <TabsContent value="renovacoes"><ClientTable data={renewalClients} /></TabsContent>
      </Tabs>
    </section>
  );
}

// ─── Section 5.1: NPS & Milestones ───
interface NpsSectionProps {
  npsWeek: any[];
  npsOverdue: any[];
  getMemberName: (id: string | null) => string;
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function NpsSection({ npsWeek, npsOverdue, onOpenDetail }: NpsSectionProps) {
  const now = new Date();
  const overdueCount = npsOverdue.length;

  const openNpsDetail = (r: any) => {
    const status = autoNpsStatus(r.expected_date, r.status);
    onOpenDetail(r.clients?.full_name || 'NPS', 'Recolha NPS', [
      { label: 'Cliente', value: r.clients?.full_name },
      { label: 'Produto', value: r.clients?.current_product },
      { label: 'Data prevista', value: format(parseISO(r.expected_date), 'dd/MM/yyyy') },
      { label: 'Status', value: status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer', badge: true, badgeVariant: status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary' },
      { label: 'Score NPS', value: r.nps_score },
      { label: 'Notas', value: r.notes },
    ]);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">5.1 // NPS desta semana</h2>
      <p className="text-xs text-muted-foreground">Acompanhamento de NPS de Customer Success da semana corrente.</p>

      <Card><CardContent className="p-4">
        <h3 className="text-sm font-medium mb-2">Recolhas de NPS previstas esta semana</h3>
        {npsWeek.length === 0 ? <EmptyHint>Sem recolhas previstas esta semana</EmptyHint> :
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Data prevista</TableHead><TableHead>Status</TableHead><TableHead>NPS</TableHead>
            </TableRow></TableHeader>
            <TableBody>{npsWeek.map((r: any) => {
              const status = autoNpsStatus(r.expected_date, r.status);
              return (
                <TableRow key={r.id} className={cn(getNpsRowColor(r.expected_date, status), clickableRow)} onClick={() => openNpsDetail(r)}>
                  <TableCell className="text-sm font-medium">{r.clients?.full_name || '—'}</TableCell>
                  <TableCell className="">{r.clients?.current_product || '—'}</TableCell>
                  <TableCell className="">{format(parseISO(r.expected_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><Badge variant={status === 'feito' ? 'default' : status === 'em_atraso' ? 'destructive' : 'secondary'} className="text-[10px]">{status === 'feito' ? 'Feito' : status === 'em_atraso' ? 'Em atraso' : 'Por fazer'}</Badge></TableCell>
                  <TableCell className="">{r.nps_score != null ? r.nps_score : '—'}</TableCell>
                </TableRow>
              );
            })}</TableBody></Table>
          </div>
        }
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-medium">Recolhas em atraso</h3>
          {overdueCount > 0 && <Badge variant="destructive" className="text-[10px]">{overdueCount}</Badge>}
        </div>
        {overdueCount === 0 ? <EmptyHint>Sem recolhas em atraso</EmptyHint> :
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Data prevista</TableHead><TableHead>Dias em atraso</TableHead>
            </TableRow></TableHeader>
            <TableBody>{npsOverdue.map((r: any) => (
              <TableRow key={r.id} className={cn("bg-destructive/15 border-l-4 border-l-red-500", clickableRow)} onClick={() => openNpsDetail(r)}>
                <TableCell className="text-sm font-medium">{r.clients?.full_name || '—'}</TableCell>
                <TableCell className="">{r.clients?.current_product || '—'}</TableCell>
                <TableCell className="">{format(parseISO(r.expected_date), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="font-medium text-destructive">{differenceInDays(now, parseISO(r.expected_date))} dias</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div>
        }
      </CardContent></Card>

    </section>
  );
}

// ─── Section 5.2: Expiring Contracts ───
interface ContractsSectionProps {
  expiringContractsList: any[];
}

export function ExpiringContractsSection({ expiringContractsList }: ContractsSectionProps) {
  if (expiringContractsList.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">5.2 // Contratos a expirar</h2>
        <Badge variant="destructive" className="text-[10px]">{expiringContractsList.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Contratos de membros da equipa que terminam nos próximos 60 dias.</p>
      <Card><div className="overflow-x-auto">
        <Table><TableHeader><TableRow>
          <TableHead>Membro</TableHead><TableHead>Função</TableHead><TableHead>Departamento</TableHead><TableHead>Fim do contrato</TableHead><TableHead>Dias restantes</TableHead>
        </TableRow></TableHeader>
        <TableBody>{expiringContractsList.map((c: any) => (
          <TableRow key={c.id} className={cn(
 c.daysLeft <= 0 ? 'bg-destructive/15 border-l-4 border-l-red-500' :
 c.daysLeft <= 14 ? 'bg-warning/15 border-l-4 border-l-amber-500' : ''
 )}>
            <TableCell className="text-sm font-medium">{c.team_members?.full_name || '—'}</TableCell>
            <TableCell className="">{c.team_members?.role_title || '—'}</TableCell>
            <TableCell className="">{c.team_members?.department || '—'}</TableCell>
            <TableCell className="">{c.end_date}</TableCell>
            <TableCell>
              <Badge variant={c.daysLeft <= 0 ? 'destructive' : c.daysLeft <= 14 ? 'secondary' : 'outline'} className="text-[10px]">
                {c.daysLeft <= 0 ? `Expirou há ${Math.abs(c.daysLeft)} dias` : `${c.daysLeft} dias`}
              </Badge>
            </TableCell>
          </TableRow>
        ))}</TableBody></Table>
      </div></Card>
    </section>
  );
}

// ─── Section 6: Operação ───
interface OperacaoSectionProps {
  projects: any[];
  tasks: any[];
  meetings: any[];
  contents: any[];
  tasksWeekDone: number;
  tasksWeekCount: number;
  meetingsWeekCount: number;
  contentWeekCount: number;
  onOpenDetail: (title: string, subtitle: string, fields: DetailField[]) => void;
}

export function OperacaoSection({ projects, tasks, meetings, contents, tasksWeekDone, tasksWeekCount, meetingsWeekCount, contentWeekCount, onOpenDetail }: OperacaoSectionProps) {
  const navigate = useNavigate();

  const { data: deptList = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('value, label');
      return (data || []) as { value: string; label: string }[];
    },
  });
  const deptLabel = (v?: string | null) => {
    if (!v) return null;
    return deptList.find((d) => d.value === v)?.label || v;
  };
  const resolveDepartments = (p: any) => {
    const arr = Array.isArray(p?.departments) ? p.departments.filter(Boolean) : [];
    if (arr.length > 0) return arr.map(deptLabel).filter(Boolean).join(', ');
    if (p?.department) return deptLabel(p.department) || '—';
    return '—';
  };

  const openTaskDetail = (t: any) => onOpenDetail(t.name, 'Tarefa', [
    { label: 'Status', value: t.status, badge: true },
    { label: 'Deadline', value: t.deadline },
    { label: 'Departamento', value: t.department },
    { label: 'Prioridade', value: t.priority },
  ]);

  const openMeetingDetail = (m: any) => onOpenDetail(m.title, 'Reunião', [
    { label: 'Data', value: m.date_time?.slice(0, 16)?.replace('T', ' ') },
    { label: 'Status', value: m.status, badge: true },
    { label: 'Departamento', value: m.department },
    { label: 'Cliente', value: m.client_name },
    { label: 'URL reunião', value: m.meeting_url },
  ]);

  const openContentDetail = (c: any) => onOpenDetail(c.title, 'Conteúdo', [
    { label: 'Status', value: c.status, badge: true },
    { label: 'Formato', value: c.format },
    { label: 'Tipo', value: c.content_type },
    { label: 'Objetivo', value: c.objective },
    { label: 'Data agendada', value: c.scheduled_at?.slice(0, 10) },
  ]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">6 // Operação & Esta semana</h2>
          <span className="text-xs text-muted-foreground">{tasksWeekDone}/{tasksWeekCount} tarefas • {meetingsWeekCount} reuniões • {contentWeekCount} conteúdos</span>
        </div>
        <div className="flex gap-3">
          <Link to="/hub/projetos" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Projetos <ArrowUpRight className="h-3 w-3" /></Link>
          <Link to="/hub/tarefas" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Tarefas <ArrowUpRight className="h-3 w-3" /></Link>
          <Link to="/hub/reunioes" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Reuniões <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
      </div>

      <Card><CardContent className="p-4">
        <h3 className="text-sm font-medium mb-2">Projetos a acontecer</h3>
        {projects.length === 0 ? <EmptyHint>Sem projetos ativos</EmptyHint> :
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Status</TableHead><TableHead>Projeto</TableHead><TableHead>Departamento</TableHead><TableHead>Deadline</TableHead>
            </TableRow></TableHeader>
            <TableBody>{projects.slice(0, 10).map(p => {
              const st = getProjectStatusInfo(p.status);
              return (
              <TableRow key={p.id} className={clickableRow} onClick={() => navigate(`/hub/projetos/${p.id}`)}>
                <TableCell><span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium', st.color)}>{st.label}</span></TableCell>
                <TableCell className="text-sm">{p.name}</TableCell>
                <TableCell className="">{resolveDepartments(p)}</TableCell>
                <TableCell className="">{p.deadline ? format(parseISO(p.deadline), 'dd/MM/yyyy') : '—'}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div>
        }
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <h3 className="text-sm font-medium mb-2">Tarefas planeadas</h3>
          {tasks.length === 0 ? <EmptyHint>Sem tarefas</EmptyHint> :
            tasks.map(t => (
              <div key={t.id} className={cn("flex items-center gap-2 py-1 px-1 rounded", clickableRow)} onClick={() => openTaskDetail(t)}>
                <div className={`h-2 w-2 rounded-full shrink-0 ${isTaskDone(t) ? 'bg-success' : 'bg-warning'}`} />
                <span className="text-xs">{t.name}</span>
              </div>
            ))
          }
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <h3 className="text-sm font-medium mb-2">Reuniões marcadas</h3>
          {meetings.length === 0 ? <EmptyHint>Sem reuniões</EmptyHint> :
            meetings.map(m => (
              <div key={m.id} className={cn("text-xs py-1 px-1 flex justify-between rounded", clickableRow)} onClick={() => openMeetingDetail(m)}>
                <span>{m.title}</span><span className="text-muted-foreground">{m.date_time?.slice(0, 10)}</span>
              </div>
            ))
          }
        </CardContent></Card>

        <Card><CardContent className="p-4">
          <h3 className="text-sm font-medium mb-2">Conteúdos desta semana</h3>
          {contents.length === 0 ? <EmptyHint>Sem conteúdos</EmptyHint> :
            contents.map(c => (
              <div key={c.id} className={cn("py-1 px-1 rounded", clickableRow)} onClick={() => openContentDetail(c)}>
                <p className="text-xs font-medium">{c.title}</p>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                  {c.format && <Badge variant="outline" className="text-[9px]">{c.format}</Badge>}
                </div>
              </div>
            ))
          }
        </CardContent></Card>
      </div>
    </section>
  );
}

// ─── Marketing Goals Section ───
interface MarketingGoalsSectionProps {
  currentMonth: number;
  currentYear?: number;
}

export function MarketingGoalsSection({ currentMonth, currentYear }: MarketingGoalsSectionProps) {
  const year = currentYear || new Date().getFullYear();

  const { data: goals = [] } = useQuery({
    queryKey: ['marketing-goals', year, currentMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_goals')
        .select('*')
        .eq('year', year)
        .eq('month', currentMonth)
        .order('sort_order') as any;
      return (data || []) as { id: string; metric_label: string; target_value: number; current_value: number; channel_id: string | null; notes: string | null }[];
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['marketing-channels-names'],
    queryFn: async () => {
      const { data } = await supabase.from('marketing_channels').select('id, name').order('sort_order') as any;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const getChannelName = (id: string | null) => id ? channels.find(c => c.id === id)?.name || null : null;

  if (goals.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Metas de Marketing</h2>
      <Card><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Métrica</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead className="text-right">Alvo</TableHead>
            <TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Progresso</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {goals.map(g => {
              const pct = g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0;
              const achieved = pct >= 100;
              const channelName = getChannelName(g.channel_id);
              return (
                <TableRow key={g.id}>
                  <TableCell className="text-sm font-medium">{g.metric_label}</TableCell>
                  <TableCell className="text-muted-foreground">{channelName || 'Geral'}</TableCell>
                  <TableCell className="text-right">{g.target_value}</TableCell>
                  <TableCell className="text-right">{g.current_value}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={achieved ? 'default' : 'secondary'} className={cn('text-[10px]', achieved && 'bg-success hover:bg-success')}>
                      {pct}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div></Card>
    </section>
  );
}
