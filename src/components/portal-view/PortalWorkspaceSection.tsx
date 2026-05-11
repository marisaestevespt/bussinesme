import { useMemo, useState } from 'react';
import { format, parseISO, isAfter, differenceInCalendarDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Briefcase, FileText, FolderOpen, Download, CheckCircle2, Circle, ListChecks, Layers, Package, Search, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { isPhaseDone, phaseProgress } from '@/lib/projectProgress';
import type { PortalPhase, PortalMaterial } from '@/types/portal';

interface Props {
  phases: PortalPhase[];
  client: Record<string, any>;
  portalMaterials: PortalMaterial[];
  tasks: Array<Record<string, any>>;
  pc: string;
  pcAlpha: (a: number) => string;
}

type TaskFilter = 'pendentes' | 'concluidas' | 'todas';

export function PortalWorkspaceSection({ phases, client, portalMaterials, tasks, pc, pcAlpha }: Props) {
  const total = phases.length;
  const done = phases.filter(isPhaseDone).length;
  const pct = phaseProgress(phases);
  const activePhase = phases.find(p => p.status === 'em_curso') || phases.find(p => !isPhaseDone(p)) || null;

  // Materials + client links
  const allItems: { id: string; label: string; url: string; type: 'link' | 'file' }[] = [];
  if (client.documents) allItems.push({ id: 'docs', label: 'Documentos', url: client.documents, type: 'link' });
  if (client.drive_folder_url) allItems.push({ id: 'drive', label: 'Pasta Drive', url: client.drive_folder_url, type: 'link' });
  portalMaterials.forEach((m) => allItems.push({ id: m.id, label: m.file_name || m.title || 'Material', url: m.file_url || '', type: 'file' }));

  const [matQuery, setMatQuery] = useState('');
  const filteredItems = useMemo(() => {
    const q = matQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(i => i.label.toLowerCase().includes(q));
  }, [allItems, matQuery]);

  // Tasks filter
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('pendentes');
  const taskCounts = useMemo(() => {
    const c = { pendentes: 0, concluidas: 0, todas: tasks.length };
    tasks.forEach(t => {
      if (t.status === 'concluida') c.concluidas++;
      else c.pendentes++;
    });
    return c;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      // Pending first, then by due_date asc, undated last
      const ad = a.status === 'concluida' ? 1 : 0;
      const bd = b.status === 'concluida' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const at = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
    if (taskFilter === 'pendentes') return sorted.filter(t => t.status !== 'concluida');
    if (taskFilter === 'concluidas') return sorted.filter(t => t.status === 'concluida');
    return sorted;
  }, [tasks, taskFilter]);

  return (
    <div className="space-y-8">
      <SectionTitle icon={Briefcase}>Espaço de Trabalho</SectionTitle>

      {/* ─── Hero overview ─── */}
      <SectionCard className="p-6 sm:p-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-[0.07] blur-3xl"
          style={{ background: pc }}
        />
        <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="space-y-2">
            <div className="text-[10px] tracking-[0.28em] uppercase font-semibold" style={{ color: pc }}>
              {total > 0 ? (activePhase ? 'Fase atual' : 'Projeto concluído') : 'Sem fases ainda'}
            </div>
            <h2
              className="text-2xl sm:text-3xl leading-tight"
              style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
            >
              {activePhase ? (activePhase.title || activePhase.name) : (total > 0 ? 'Tudo concluído' : 'A começar em breve')}
            </h2>
            {activePhase?.description && (
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{activePhase.description}</p>
            )}
            {total > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 max-w-[260px] h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: pc }} />
                </div>
                <span className="text-xs text-muted-foreground">{done}/{total} fases</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div
              className="text-5xl sm:text-6xl font-light tracking-tight tabular-nums"
              style={{ color: pc, fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
            >
              {pct}<span className="text-2xl align-top">%</span>
            </div>
            <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground mt-1">progresso</div>
          </div>
        </div>
      </SectionCard>

      {/* ─── Fases ─── */}
      <div className="space-y-4">
        <header className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight">Fases do projeto</h3>
          </div>
          {total > 0 && <span className="text-xs text-muted-foreground">{done}/{total} concluídas</span>}
        </header>

        {total > 0 ? (
          <div className="space-y-3">
            {phases.map((p, i) => {
              const isDone = isPhaseDone(p);
              const isActive = p.status === 'em_curso';
              const deliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
              const dDone = deliverables.filter((d: any) => d.status === 'concluido').length;
              const dPct = deliverables.length ? Math.round((dDone / deliverables.length) * 100) : 0;

              return (
                <SectionCard
                  key={p.id}
                  className={`p-5 transition-all ${isActive ? 'shadow-sm' : ''}`}
                  style={isActive ? { borderColor: pcAlpha(0.4) } : undefined}
                >
                  <div className="flex items-start gap-4">
                    {/* Number / state */}
                    <div className="shrink-0">
                      {isDone ? (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center bg-success/15">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </div>
                      ) : isActive ? (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold tabular-nums" style={{ backgroundColor: pc }}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                      ) : (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center border border-border/50 text-muted-foreground/60 text-xs font-medium tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4
                            className={`text-base leading-snug ${isDone ? 'text-muted-foreground line-through' : ''}`}
                            style={{ fontFamily: 'var(--font-display, Cormorant Garamond), Georgia, serif' }}
                          >
                            {p.title || p.name}
                          </h4>
                          {(p.planned_start || p.planned_end) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                              {p.planned_start ? format(parseISO(p.planned_start), "d MMM", { locale: pt }) : '—'}
                              <span className="opacity-50"> → </span>
                              {p.planned_end ? format(parseISO(p.planned_end), "d MMM yyyy", { locale: pt }) : '—'}
                            </p>
                          )}
                          {p.description && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.description}</p>}
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] tracking-wide uppercase border-0 ${
                            isDone ? 'bg-success/10 text-success' : isActive ? 'text-white' : 'bg-muted/50 text-muted-foreground'
                          }`}
                          style={isActive ? { backgroundColor: pc } : undefined}
                        >
                          {isDone ? 'Concluída' : isActive ? 'Em curso' : 'Por começar'}
                        </Badge>
                      </div>

                      {deliverables.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Entregáveis</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{dDone}/{deliverables.length} · {dPct}%</span>
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                            {deliverables.map((d: any) => {
                              const ddone = d.status === 'concluido';
                              const dactive = d.status === 'em_progresso';
                              return (
                                <li key={d.id} className="flex items-center gap-2">
                                  {ddone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                  ) : dactive ? (
                                    <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                  )}
                                  <span className={`text-xs truncate ${ddone ? 'text-muted-foreground line-through' : ''}`}>{d.name}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>
              );
            })}
          </div>
        ) : (
          <SectionCard className="p-8 text-center">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Ainda sem fases definidas. Em breve terás aqui o progresso do teu projeto.</p>
          </SectionCard>
        )}
      </div>

      {/* ─── Entregáveis & materiais ─── */}
      <div className="space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight">Materiais</h3>
            {allItems.length > 0 && (
              <span className="text-xs text-muted-foreground">{allItems.length}</span>
            )}
          </div>
          {allItems.length > 4 && (
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                value={matQuery}
                onChange={(e) => setMatQuery(e.target.value)}
                placeholder="Procurar material..."
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          )}
        </header>

        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <SectionCard className="p-4 hover:-translate-y-0.5 transition-transform">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: pcAlpha(0.08) }}
                  >
                    {item.type === 'link'
                      ? <FolderOpen className="h-5 w-5" style={{ color: pc }} strokeWidth={1.5} />
                      : <FileText className="h-5 w-5" style={{ color: pc }} strokeWidth={1.5} />}
                  </div>
                  <p className="text-xs font-medium leading-snug line-clamp-2 mb-2">{item.label}</p>
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 group-hover:text-foreground transition-colors">
                    <Download className="h-3 w-3" />{item.type === 'link' ? 'Abrir' : 'Descarregar'}
                  </span>
                </SectionCard>
              </a>
            ))}
          </div>
        ) : (
          <SectionCard className="p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              {matQuery ? 'Sem resultados para a tua pesquisa.' : 'Ainda sem materiais disponíveis.'}
            </p>
          </SectionCard>
        )}
      </div>

      {/* ─── Tarefas ─── */}
      <div className="space-y-4">
        <header className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ListChecks className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight">Tarefas</h3>
            {tasks.length > 0 && <span className="text-xs text-muted-foreground">{tasks.length}</span>}
          </div>
          {tasks.length > 0 && (
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/30">
              {([
                ['pendentes', `Pendentes · ${taskCounts.pendentes}`],
                ['concluidas', `Concluídas · ${taskCounts.concluidas}`],
                ['todas', `Todas · ${taskCounts.todas}`],
              ] as const).map(([key, label]) => {
                const active = taskFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTaskFilter(key)}
                    className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                      active ? 'text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={active ? { backgroundColor: pc } : undefined}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {filteredTasks.length > 0 ? (
          <SectionCard className="overflow-hidden">
            <ul className="divide-y divide-border/20">
              {filteredTasks.map((t) => {
                const isDone = t.status === 'concluida';
                const isProgress = t.status === 'em_progresso';
                const due = t.due_date ? parseISO(t.due_date) : null;
                const overdue = due && !isDone && isAfter(new Date(), due);
                const daysToDue = due ? differenceInCalendarDays(due, new Date()) : null;

                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : isProgress ? (
                      <div className="h-4 w-4 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isDone ? 'text-muted-foreground line-through' : ''}`}>{t.name}</p>
                      {due && (
                        <p className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {format(due, "d 'de' MMM", { locale: pt })}
                          {!isDone && daysToDue !== null && (
                            <span className="opacity-70">
                              {daysToDue === 0 ? ' · hoje' : daysToDue > 0 ? ` · em ${daysToDue}d` : ` · há ${Math.abs(daysToDue)}d`}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 border-0 ${
                        isDone ? 'bg-success/15 text-success' : isProgress ? 'text-white' : 'bg-muted/50 text-muted-foreground'
                      }`}
                      style={isProgress ? { backgroundColor: pc } : undefined}
                    >
                      {isDone ? 'Concluída' : isProgress ? 'Em progresso' : t.status === 'pendente' ? 'Pendente' : t.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ) : (
          <SectionCard className="p-8 text-center">
            <ListChecks className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0 ? 'Ainda sem tarefas atribuídas.' : 'Sem tarefas neste filtro.'}
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
