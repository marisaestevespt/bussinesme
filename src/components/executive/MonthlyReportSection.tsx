import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Play, Download, FileBarChart, TrendingUp, Users, CheckSquare, DollarSign, Briefcase, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MonthlyReportSection() {
  const [running, setRunning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${prev.getMonth() + 1}`;
  });
  const [viewingReport, setViewingReport] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['monthly-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(24);
      if (error) throw error;
      return data;
    },
  });

  const handleGenerate = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const [yearStr, monthStr] = selectedMonth.split('-');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-monthly-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ year: parseInt(yearStr), month: parseInt(monthStr) }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao gerar relatório');

      toast.success(`Relatório de ${MONTH_NAMES[parseInt(monthStr) - 1]} ${yearStr} gerado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar relatório');
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = (reportData: any, year: number, month: number) => {
    const label = reportData.period?.label || `${MONTH_NAMES[month - 1]} ${year}`;
    const f = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { toast.error('Popup bloqueado'); return; }

    const fin = reportData.financial || {};
    const com = reportData.commercial || {};
    const cli = reportData.clients || {};
    const ops = reportData.operations || {};
    const team = reportData.team || {};
    const crm = reportData.crm || {};

    const topProductsHtml = (com.topProducts || []).map(([name, value]: [string, number]) =>
      `<tr><td>${name}</td><td style="text-align:right;font-weight:600">€${f(value)}</td></tr>`
    ).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório ${label}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header .date { font-size: 10px; color: #6b7280; }
  h2 { font-size: 13px; font-weight: 700; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .kpi .label { font-size: 9px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.3px; }
  .kpi .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .kpi .sub { font-size: 9px; color: #6b7280; margin-top: 1px; }
  .section-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .card h3 { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; font-size: 10px; padding: 3px 0; }
  .row .lbl { color: #6b7280; }
  .row .val { font-weight: 600; }
  .green { color: #059669; }
  .red { color: #dc2626; }
  .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin: 4px 0; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { font-weight: 600; background: #f9fafb; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <div class="header">
    <h1>Relatório Mensal — ${label}</h1>
    <span class="date">Gerado em ${new Date(reportData.generatedAt || Date.now()).toLocaleDateString('pt-PT')}</span>
  </div>

  <h2>Financeiro</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Receita</div><div class="value">€${f(fin.revenue || 0)}</div></div>
    <div class="kpi"><div class="label">Despesas</div><div class="value">€${f(fin.expenses || 0)}</div></div>
    <div class="kpi"><div class="label">Margem</div><div class="value">€${f(fin.margin || 0)}</div><div class="sub">${(fin.marginPct || 0).toFixed(1)}%</div></div>
  </div>

  <h2>Comercial</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Vendas no mês</div><div class="value">${com.salesCount || 0}</div><div class="sub">€${f(com.totalSales || 0)}</div></div>
    <div class="kpi"><div class="label">Total YTD</div><div class="value">€${f(com.totalYtd || 0)}</div></div>
    <div class="kpi">
      <div class="label">Meta Anual</div><div class="value">${(com.progressPct || 0).toFixed(1)}%</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(com.progressPct || 0, 100)}%"></div></div>
      <div class="sub">€${f(com.totalYtd || 0)} / €${f(com.annualGoal || 0)}</div>
    </div>
  </div>

  ${topProductsHtml ? `<h2>Top Produtos</h2><table><thead><tr><th>Produto</th><th style="text-align:right">Valor</th></tr></thead><tbody>${topProductsHtml}</tbody></table>` : ''}

  <h2>Clientes & CRM</h2>
  <div class="section-grid">
    <div class="card"><h3>Clientes</h3>
      <div class="row"><span class="lbl">Ativos</span><span class="val">${cli.activeCount || 0}</span></div>
      <div class="row"><span class="lbl">Novos</span><span class="val">${cli.newCount || 0}</span></div>
      ${cli.avgNps != null ? `<div class="row"><span class="lbl">NPS médio</span><span class="val">${cli.avgNps.toFixed(1)}</span></div>` : ''}
    </div>
    <div class="card"><h3>CRM</h3>
      <div class="row"><span class="lbl">Leads convertidas</span><span class="val green">${crm.leadsConverted || 0}</span></div>
      <div class="row"><span class="lbl">Leads perdidas</span><span class="val red">${crm.leadsLost || 0}</span></div>
    </div>
    <div class="card"><h3>Equipa</h3>
      <div class="row"><span class="lbl">Horas registadas</span><span class="val">${team.totalHours || 0}h</span></div>
      <div class="row"><span class="lbl">Membros ativos</span><span class="val">${team.activeMembers || 0}</span></div>
      <div class="row"><span class="lbl">Média p/ membro</span><span class="val">${team.avgHoursPerMember || 0}h</span></div>
    </div>
  </div>

  <h2>Operações</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Tarefas Concluídas</div><div class="value">${ops.tasksCompleted || 0}</div><div class="sub">${ops.tasksPending || 0} pendentes</div></div>
    <div class="kpi"><div class="label">Reuniões</div><div class="value">${ops.meetingsHeld || 0}</div></div>
    <div class="kpi"><div class="label">Entregáveis Concluídos</div><div class="value">${ops.deliverablesCompleted || 0}</div></div>
  </div>
</body></html>`);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
      setTimeout(() => { try { printWindow.close(); } catch {} }, 5000);
    }, 400);
  };

  // Build month options for the last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1 - i);
    return {
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    };
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600 text-xs">Concluído</Badge>;
      case 'running':
        return <Badge variant="secondary" className="text-xs">A gerar...</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Falhou</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const reportData = viewingReport?.report_data;

  return (
    <div className="space-y-6">
      {/* Header + Generate */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileBarChart className="h-4.5 w-4.5 text-primary" />
            Relatório Mensal
          </h3>
          <p className="text-sm text-muted-foreground">Snapshot operacional consolidado de todos os módulos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGenerate} disabled={running}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {running ? 'A gerar...' : 'Gerar'}
          </Button>
        </div>
      </div>

      {/* Report viewer */}
      {reportData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{reportData.period?.label}</h4>
            <Button variant="ghost" size="sm" onClick={() => setViewingReport(null)}>Fechar</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <ReportCard icon={DollarSign} label="Receita" value={`€${fmt(reportData.financial?.revenue || 0)}`} />
            <ReportCard icon={DollarSign} label="Despesas" value={`€${fmt(reportData.financial?.expenses || 0)}`} />
            <ReportCard icon={TrendingUp} label="Margem" value={`€${fmt(reportData.financial?.margin || 0)}`}
              sub={`${(reportData.financial?.marginPct || 0).toFixed(1)}%`} />
            <ReportCard icon={Briefcase} label="Vendas" value={`${reportData.commercial?.salesCount || 0}`}
              sub={`€${fmt(reportData.commercial?.totalSales || 0)}`} />
            <ReportCard icon={Users} label="Clientes Ativos" value={`${reportData.clients?.activeCount || 0}`}
              sub={`+${reportData.clients?.newCount || 0} novos`} />
            <ReportCard icon={CheckSquare} label="Tarefas Concluídas" value={`${reportData.operations?.tasksCompleted || 0}`}
              sub={`${reportData.operations?.tasksPending || 0} pendentes`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Commercial progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Progresso Comercial Anual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={Math.min(reportData.commercial?.progressPct || 0, 100)} className="h-2.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>€{fmt(reportData.commercial?.totalYtd || 0)} faturado</span>
                  <span>{(reportData.commercial?.progressPct || 0).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* CRM */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">CRM</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leads convertidas</span>
                  <span className="font-medium text-success">{reportData.crm?.leadsConverted || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leads perdidas</span>
                  <span className="font-medium text-destructive">{reportData.crm?.leadsLost || 0}</span>
                </div>
                {reportData.clients?.avgNps != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NPS médio</span>
                    <span className="font-medium">{reportData.clients.avgNps.toFixed(1)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Equipa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Horas registadas</span>
                  <span className="font-medium">{reportData.team?.totalHours || 0}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Membros ativos</span>
                  <span className="font-medium">{reportData.team?.activeMembers || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Média p/ membro</span>
                  <span className="font-medium">{reportData.team?.avgHoursPerMember || 0}h</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top products */}
          {reportData.commercial?.topProducts?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.commercial.topProducts.map(([name, value]: [string, number]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span>{name}</span>
                      <span className="font-medium">€{fmt(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Operations summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Reuniões realizadas" value={reportData.operations?.meetingsHeld || 0} />
            <MiniStat label="Entregáveis concluídos" value={reportData.operations?.deliverablesCompleted || 0} />
            <MiniStat label="Tarefas concluídas" value={reportData.operations?.tasksCompleted || 0} />
            <MiniStat label="Tarefas pendentes" value={reportData.operations?.tasksPending || 0} />
          </div>
        </div>
      )}

      {/* Report history */}
      {!viewingReport && (
        <>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar...</p>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileBarChart className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum relatório gerado ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Seleciona um mês e clica em "Gerar" para criar o primeiro relatório.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reports.map((r: any) => (
                <Card key={r.id} className="p-3 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3 min-w-0">
                    {statusBadge(r.status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {MONTH_NAMES[(r.month || 1) - 1]} {r.year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.trigger_type === 'manual' ? 'Manual' : 'Automático'}
                        {r.file_size_bytes ? ` · ${formatBytes(r.file_size_bytes)}` : ''}
                        {r.completed_at ? ` · ${format(new Date(r.completed_at), "d MMM HH:mm", { locale: pt })}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.status === 'completed' && r.report_data && (
                      <Button variant="outline" size="sm" onClick={() => setViewingReport(r)}>
                        Ver relatório
                      </Button>
                    )}
                    {r.status === 'completed' && r.report_data && (
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(r.report_data, r.year, r.month)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReportCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
