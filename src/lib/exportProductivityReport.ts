import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { pt } from 'date-fns/locale';

interface TimeEntry {
  id: string;
  entry_date: string;
  duration: number;
  category: string;
  description?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  _isMeeting?: boolean;
}

interface Task {
  id: string;
  name: string;
  status: string;
  updated_at?: string;
  deadline?: string;
  project_id?: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface ReportData {
  memberName: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  entries: TimeEntry[];
  tasks: Task[];
  completedTasks: Task[];
  overdueTasks: Task[];
  projects: Project[];
  expectedDailyHours: number;
}

const CAT_LABELS: Record<string, string> = {
  cliente: 'Cliente', interno: 'Interno', reuniao: 'Reunião',
  conteudos: 'Conteúdos', formacao: 'Formação', outro: 'Outro',
};

function h(n: number) { return (Math.round(n * 100) / 100).toFixed(1); }

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportProductivityReport(data: ReportData) {
  const { entries, tasks, completedTasks, overdueTasks, projects, periodStart, periodEnd } = data;

  const totalHours = entries.reduce((s, e) => s + Number(e.duration || 0), 0);
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });

  // Group entries by day
  const byDay: Record<string, TimeEntry[]> = {};
  entries.forEach(e => {
    if (!byDay[e.entry_date]) byDay[e.entry_date] = [];
    byDay[e.entry_date].push(e);
  });

  // Group by category
  const byCategory: Record<string, number> = {};
  entries.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.duration || 0);
  });

  // Group by project
  const byProject: Record<string, { name: string; hours: number; entries: TimeEntry[] }> = {};
  entries.forEach(e => {
    const pid = e.project_id || '__none__';
    const proj = projects.find(p => p.id === pid);
    if (!byProject[pid]) byProject[pid] = { name: proj?.name || 'Sem projeto', hours: 0, entries: [] };
    byProject[pid].hours += Number(e.duration || 0);
    byProject[pid].entries.push(e);
  });

  // Group by task
  const byTask: Record<string, { name: string; hours: number }> = {};
  entries.forEach(e => {
    if (!e.task_id) return;
    const task = tasks.find(t => t.id === e.task_id);
    if (!byTask[e.task_id]) byTask[e.task_id] = { name: task?.name || 'Tarefa', hours: 0 };
    byTask[e.task_id].hours += Number(e.duration || 0);
  });
  const taskRanking = Object.values(byTask).sort((a, b) => b.hours - a.hours);

  // Build daily rows
  const dailyRows = days.map(d => {
    const key = format(d, 'yyyy-MM-dd');
    const dayEntries = byDay[key] || [];
    const dayHours = dayEntries.reduce((s, e) => s + Number(e.duration || 0), 0);
    const dayProjects = [...new Set(dayEntries.filter(e => e.project_id).map(e => {
      const p = projects.find(pr => pr.id === e.project_id);
      return p?.name || '';
    }).filter(Boolean))];
    const dayTasks = [...new Set(dayEntries.filter(e => e.task_id).map(e => {
      const t = tasks.find(tk => tk.id === e.task_id);
      return t?.name || '';
    }).filter(Boolean))];
    return { date: d, key, dayEntries, dayHours, dayProjects, dayTasks };
  });

  const workDays = dailyRows.filter(d => d.dayHours > 0).length;
  const avgPerDay = workDays > 0 ? totalHours / workDays : 0;

  const pw = window.open('', '_blank', 'width=900,height=700');
  if (!pw) return;

  pw.document.write(`<!DOCTYPE html><html><head><title>Relatório de Produtividade</title>
<style>
@page { size: A4; margin: 12mm 10mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.45; }
h1 { font-size: 16px; font-weight: 700; }
h2 { font-size: 12px; font-weight: 700; margin: 14px 0 6px; border-bottom: 2px solid #e5e7eb; padding-bottom: 3px; }
h3 { font-size: 11px; font-weight: 600; margin: 10px 0 4px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5px; }
th, td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; }
th { font-weight: 600; background: #f9fafb; border-bottom: 2px solid #d1d5db; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.mono { font-family: monospace; }
.bold { font-weight: 700; }
.muted { color: #6b7280; }
.green { color: #059669; }
.red { color: #dc2626; }
.amber { color: #d97706; }
.header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
.header h1 { margin: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
.summary-card .label { font-size: 9px; color: #6b7280; margin-bottom: 2px; }
.summary-card .value { font-size: 18px; font-weight: 700; }
.cat-bar { display: flex; height: 16px; border-radius: 4px; overflow: hidden; margin: 6px 0 10px; }
.cat-bar div { height: 100%; }
.cat-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; font-size: 9px; }
.cat-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 3px; vertical-align: middle; }
.day-section { page-break-inside: avoid; margin-bottom: 8px; padding: 6px 8px; border: 1px solid #f3f4f6; border-radius: 4px; }
.day-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.tag { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8px; background: #f3f4f6; margin-right: 3px; }
.page-break { page-break-before: always; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div><h1>Relatório de Produtividade</h1><span class="muted">${data.memberName}</span></div>
  <div style="text-align:right"><span class="muted">${data.periodLabel}</span><br/><span style="font-size:9px" class="muted">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}</span></div>
</div>

<!-- RESUMO -->
<div class="summary-grid">
  <div class="summary-card"><div class="label">Total horas</div><div class="value">${h(totalHours)}h</div></div>
  <div class="summary-card"><div class="label">Dias com registo</div><div class="value">${workDays}</div></div>
  <div class="summary-card"><div class="label">Média horas/dia</div><div class="value">${h(avgPerDay)}h</div></div>
  <div class="summary-card"><div class="label">Tarefas concluídas</div><div class="value">${completedTasks.length}</div></div>
</div>

<!-- DISTRIBUIÇÃO POR CATEGORIA -->
<h2>Distribuição por Categoria</h2>
${totalHours > 0 ? `<div class="cat-bar">${Object.entries(byCategory).map(([cat, hrs], i) => {
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#6b7280'];
  return `<div style="width:${(hrs/totalHours*100).toFixed(1)}%;background:${colors[i % colors.length]}" title="${CAT_LABELS[cat] || cat}: ${h(hrs)}h"></div>`;
}).join('')}</div>
<div class="cat-legend">${Object.entries(byCategory).map(([cat, hrs], i) => {
  const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#6b7280'];
  return `<span><span class="cat-dot" style="background:${colors[i % colors.length]}"></span>${CAT_LABELS[cat] || cat}: ${h(hrs)}h (${(hrs/totalHours*100).toFixed(0)}%)</span>`;
}).join('')}</div>` : '<p class="muted">Sem registos.</p>'}

<!-- POR PROJETO -->
<h2>Horas por Projeto</h2>
<table>
<thead><tr><th>Projeto</th><th class="text-right">Horas</th><th class="text-right">%</th><th class="text-right">Registos</th></tr></thead>
<tbody>
${Object.values(byProject).sort((a, b) => b.hours - a.hours).map(p => 
  `<tr><td>${p.name}</td><td class="text-right mono">${h(p.hours)}h</td><td class="text-right">${totalHours > 0 ? (p.hours/totalHours*100).toFixed(0) : 0}%</td><td class="text-right">${p.entries.length}</td></tr>`
).join('')}
<tr class="bold"><td>Total</td><td class="text-right mono">${h(totalHours)}h</td><td class="text-right">100%</td><td class="text-right">${entries.length}</td></tr>
</tbody></table>

<!-- RANKING TAREFAS -->
<h2>Ranking — Tarefas por Tempo</h2>
${taskRanking.length === 0 ? '<p class="muted">Sem tempo associado a tarefas.</p>' : `<table>
<thead><tr><th>#</th><th>Tarefa</th><th class="text-right">Horas</th><th class="text-right">%</th></tr></thead>
<tbody>
${taskRanking.slice(0, 20).map((t, i) =>
  `<tr><td>${i+1}</td><td>${t.name}</td><td class="text-right mono">${h(t.hours)}h</td><td class="text-right">${totalHours > 0 ? (t.hours/totalHours*100).toFixed(0) : 0}%</td></tr>`
).join('')}
</tbody></table>`}

<!-- TAREFAS CONCLUÍDAS -->
<h2>Tarefas Concluídas (${completedTasks.length})</h2>
${completedTasks.length === 0 ? '<p class="muted">Nenhuma tarefa concluída neste período.</p>' : `<table>
<thead><tr><th>Tarefa</th><th>Concluída em</th></tr></thead>
<tbody>
${completedTasks.map(t =>
  `<tr><td>${t.name}</td><td>${t.updated_at ? format(parseISO(t.updated_at), 'dd/MM/yyyy') : '—'}</td></tr>`
).join('')}
</tbody></table>`}

<!-- TAREFAS EM ATRASO -->
${overdueTasks.length > 0 ? `<h2 class="red">Tarefas em Atraso (${overdueTasks.length})</h2>
<table>
<thead><tr><th>Tarefa</th><th>Prazo</th></tr></thead>
<tbody>
${overdueTasks.map(t =>
  `<tr><td>${t.name}</td><td class="red">${t.deadline ? format(parseISO(t.deadline), 'dd/MM/yyyy') : '—'}</td></tr>`
).join('')}
</tbody></table>` : ''}

<!-- DETALHE DIÁRIO -->
<div class="page-break"></div>
<h2>Detalhe Diário</h2>
${dailyRows.map(d => {
  if (d.dayHours === 0 && d.dayEntries.length === 0) return '';
  const dayLabel = format(d.date, "EEEE, dd 'de' MMMM", { locale: pt });
  const overExpected = d.dayHours >= data.expectedDailyHours;
  return `<div class="day-section">
  <div class="day-header">
    <h3 style="margin:0">${dayLabel}</h3>
    <span class="mono bold ${overExpected ? 'green' : ''}">${h(d.dayHours)}h</span>
  </div>
  ${d.dayProjects.length > 0 ? `<div style="margin-bottom:3px">${d.dayProjects.map(p => `<span class="tag">${p}</span>`).join('')}</div>` : ''}
  <table style="margin-bottom:0">
  <thead><tr><th>Descrição</th><th>Categoria</th><th class="text-right">Duração</th></tr></thead>
  <tbody>
  ${d.dayEntries.map(e => 
    `<tr><td>${e.description || '—'}</td><td>${CAT_LABELS[e.category] || e.category}</td><td class="text-right mono">${h(Number(e.duration))}h</td></tr>`
  ).join('')}
  </tbody></table>
  ${d.dayTasks.length > 0 ? `<div style="margin-top:3px;font-size:9px" class="muted">Tarefas: ${d.dayTasks.join(', ')}</div>` : ''}
  </div>`;
}).join('')}

</body></html>`);

  pw.document.close();
  setTimeout(() => {
    pw.print();
    pw.onafterprint = () => pw.close();
    setTimeout(() => { try { pw.close(); } catch {} }, 5000);
  }, 600);
}
