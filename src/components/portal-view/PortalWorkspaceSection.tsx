import { useMemo, useState } from 'react';
import { format, parseISO, isAfter, differenceInCalendarDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Briefcase, FileText, FolderOpen, Download, CheckCircle2, Circle, Layers, Package, Search, Clock, AlertCircle, UserCheck, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SectionCard, SectionTitle } from './SectionPrimitives';
import { isPhaseDone, isDeliverableDone } from '@/lib/projectProgress';
import type { PortalPhase, PortalMaterial, PortalDeliverable } from '@/types/portal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PortalClientContext = Record<string, unknown> & {
  documents?: string | null;
  drive_folder_url?: string | null;
};

export interface PortalProjectAsset {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  kind: 'file' | 'link';
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  category: string | null;
}

interface Props {
  phases: PortalPhase[];
  client: PortalClientContext;
  portalMaterials: PortalMaterial[];
  projectAssets?: PortalProjectAsset[];
  portalToken?: string;
  tasks: Array<Record<string, unknown>>;
  pc: string;
  pcAlpha: (a: number) => string;
  hasOngoingWork?: boolean;
  /**
   * Unified progress (mesma fórmula da app: fases done + occurrences done + tasks done / total).
   * Quando fornecido, substitui o cálculo baseado apenas em entregáveis das fases.
   */
  unifiedProgress?: { done: number; total: number; pct: number };
}

type TaskFilter = 'pendentes' | 'concluidas' | 'todas';

export function PortalWorkspaceSection({ phases, client, portalMaterials, projectAssets = [], portalToken, tasks, pc, pcAlpha, hasOngoingWork = false, unifiedProgress }: Props) {
  const allDeliverables = useMemo(() => phases.flatMap((p) => p.deliverables || []), [phases]);
  const explicitProgress = phases
    .map((p) => Number(p.project_progress))
    .filter((v) => Number.isFinite(v));
  const officialProgress = explicitProgress.length > 0
    ? Math.round(Array.from(new Set(explicitProgress)).reduce((sum, v) => sum + v, 0) / Array.from(new Set(explicitProgress)).length)
    : null;
  const useUnified = officialProgress === null && !!unifiedProgress && unifiedProgress.total > 0;
  const total = useUnified ? unifiedProgress!.total : allDeliverables.length;
  const done = useUnified ? unifiedProgress!.done : allDeliverables.filter(isDeliverableDone).length;
  const pct = officialProgress ?? (useUnified ? unifiedProgress!.pct : 0);
  const progressLabel = useUnified ? 'itens' : 'entregas';
  const activeIdx = (() => {
    const i = phases.findIndex(p => p.status === 'em_curso');
    if (i >= 0) return i;
    return phases.findIndex(p => !isPhaseDone(p));
  })();
  const activePhase = activeIdx >= 0 ? phases[activeIdx] : null;
  const nextPhase = activeIdx >= 0 ? phases.slice(activeIdx + 1).find(p => !isPhaseDone(p)) || null : null;
  // Quando todas as fases explícitas estão concluídas mas o projeto tem trabalho contínuo
  // (avença, rotinas, reuniões recorrentes), tratamos isso como uma "fase" ativa em vez
  // de mostrar "Projeto concluído".
  const allPhasesDone = total > 0 && !activePhase;
  const showContinuous = allPhasesDone && hasOngoingWork;
  const activeDeliverables: PortalDeliverable[] = (activePhase && Array.isArray(activePhase.deliverables)) ? activePhase.deliverables : [];
  const activeDDone = activeDeliverables.filter((d) => d.status === 'concluido').length;
  const activeDPct = activeDeliverables.length ? Math.round((activeDDone / activeDeliverables.length) * 100) : 0;

  // Materiais entregáveis: documentos/links do card "Entregáveis" de cada projeto,
  // mais documentos/drive ligados ao cliente, mais materiais legacy do portal.
  type MaterialItem = {
    id: string;
    label: string;
    url?: string;
    type: 'link' | 'file' | 'asset-file';
    assetId?: string;
    project?: string | null;
  };
  const allItems: MaterialItem[] = useMemo(() => {
    const items: MaterialItem[] = [];
    if (client.documents) items.push({ id: 'docs', label: 'Documentos', url: client.documents, type: 'link' });
    if (client.drive_folder_url) items.push({ id: 'drive', label: 'Pasta Drive', url: client.drive_folder_url, type: 'link' });
    portalMaterials.forEach((m) => items.push({ id: m.id, label: m.file_name || m.title || 'Material', url: m.file_url || '', type: 'file' }));
    projectAssets.forEach((a) => {
      if (a.kind === 'link') {
        items.push({ id: `asset-${a.id}`, label: a.title, url: a.url || undefined, type: 'link', project: a.project_name });
      } else {
        items.push({ id: `asset-${a.id}`, label: a.title, type: 'asset-file', assetId: a.id, project: a.project_name });
      }
    });
    return items;
  }, [client.documents, client.drive_folder_url, portalMaterials, projectAssets]);

  const openAssetFile = async (assetId: string) => {
    if (!portalToken) return;
    try {
      const { data, error } = await supabase.functions.invoke('portal-project-asset-file', {
        body: { token: portalToken, asset_id: assetId },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('Sem URL');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error('Não foi possível abrir o ficheiro');
    }
  };

  const [matQuery, setMatQuery] = useState('');
  const filteredItems = useMemo(() => {
    const q = matQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(i => i.label.toLowerCase().includes(q));
  }, [allItems, matQuery]);

  // Entregas do cliente: deliverables com responsible_type='cliente', agregados de todas as fases
  const clientDeliverables = useMemo(() => {
    const items: Array<{ id: string; name: string; status: string; planned_end: string | null; phase_name: string }> = [];
    phases.forEach((p) => {
      const dels = Array.isArray(p.deliverables) ? p.deliverables : [];
      dels.forEach((d: PortalDeliverable) => {
        const rt = d.responsible_type || 'equipa';
        if (rt !== 'cliente' && rt !== 'ambos') return;
        items.push({
          id: d.id,
          name: d.name,
          status: d.status,
          planned_end: d.planned_end || null,
          phase_name: p.title || p.name || '',
        });
      });
    });
    return items;
  }, [phases]);

  const [taskFilter, setTaskFilter] = useState<TaskFilter>('pendentes');
  const taskCounts = useMemo(() => {
    const c = { pendentes: 0, concluidas: 0, todas: clientDeliverables.length };
    clientDeliverables.forEach((d) => {
      if (d.status === 'concluido') c.concluidas++;
      else c.pendentes++;
    });
    return c;
  }, [clientDeliverables]);

  const filteredTasks = useMemo(() => {
    const sorted = [...clientDeliverables].sort((a, b) => {
      const ad = a.status === 'concluido' ? 1 : 0;
      const bd = b.status === 'concluido' ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const at = a.planned_end ? new Date(a.planned_end).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.planned_end ? new Date(b.planned_end).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
    if (taskFilter === 'pendentes') return sorted.filter(d => d.status !== 'concluido');
    if (taskFilter === 'concluidas') return sorted.filter(d => d.status === 'concluido');
    return sorted;
  }, [clientDeliverables, taskFilter]);

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
              {total > 0
                ? (activePhase ? 'Fase atual' : (showContinuous ? 'Trabalho contínuo' : 'Projeto concluído'))
                : 'Sem fases ainda'}
            </div>
            <h2
              className="text-2xl sm:text-3xl leading-tight"
            >
              {activePhase
                ? (activePhase.title || activePhase.name)
                : (showContinuous
                    ? 'Avença a decorrer'
                    : (total > 0 ? 'Tudo concluído' : 'A começar em breve'))}
            </h2>
            {activePhase?.description ? (
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{activePhase.description}</p>
            ) : showContinuous ? (
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                Fases iniciais concluídas. O serviço continua com reuniões, rotinas e entregas recorrentes em curso.
              </p>
            ) : null}
            {total > 0 && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 max-w-[260px] h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: pc }} />
                </div>
                <span className="text-xs text-muted-foreground">{done}/{total} {progressLabel}</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div
              className="text-5xl sm:text-6xl font-light tracking-tight tabular-nums"
              style={{ color: pc }}
            >
              {pct}<span className="text-2xl align-top">%</span>
            </div>
            <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground mt-1">progresso</div>
          </div>
        </div>
      </SectionCard>

      {/* ─── Entregáveis da fase atual + teaser próxima ─── */}
      {activePhase && activeDeliverables.length > 0 && (
        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" style={{ color: pc }} strokeWidth={1.5} />
              <span className="text-[10px] tracking-[0.24em] uppercase font-semibold text-muted-foreground">Entregáveis desta fase</span>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{activeDDone}/{activeDeliverables.length} · {activeDPct}%</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {activeDeliverables.map((d) => {
              const ddone = d.status === 'concluido';
              const dactive = d.status === 'em_progresso';
              return (
                <li key={d.id} className="flex items-center gap-2.5">
                  {ddone ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : dactive ? (
                    <div className="h-4 w-4 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-sm truncate ${ddone ? 'text-muted-foreground line-through' : ''}`}>{d.name}</span>
                </li>
              );
            })}
          </ul>

          {nextPhase && (
            <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground shrink-0">A seguir</span>
                <span className="text-sm truncate">
                  {nextPhase.title || nextPhase.name}
                </span>
              </div>
              {nextPhase.planned_start && (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {format(parseISO(nextPhase.planned_start), "d MMM", { locale: pt })}
                </span>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* ─── As tuas entregas ─── */}
      <div className="space-y-4">
        <header className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <UserCheck className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight">As tuas entregas</h3>
            {clientDeliverables.length > 0 && <span className="text-xs text-muted-foreground">{clientDeliverables.length}</span>}
          </div>
          {clientDeliverables.length > 0 && (
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
            <div className="hidden sm:grid grid-cols-[1fr_180px_140px_110px] bg-muted/20 px-4 py-2 text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold border-b border-border/30">
              <span>Entrega</span>
              <span>Fase</span>
              <span>Data limite</span>
              <span className="text-right">Estado</span>
            </div>
            <ul className="divide-y divide-border/20">
              {filteredTasks.map((t) => {
                const isDone = t.status === 'concluido';
                const isProgress = t.status === 'em_progresso';
                const due = t.planned_end ? parseISO(t.planned_end) : null;
                const overdue = due && !isDone && isAfter(new Date(), due);
                const daysToDue = due ? differenceInCalendarDays(due, new Date()) : null;

                return (
                  <li key={t.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_180px_140px_110px] items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : isProgress ? (
                        <div className="h-4 w-4 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${isDone ? 'text-muted-foreground line-through' : ''}`}>{t.name}</p>
                        <p className="text-[11px] text-muted-foreground sm:hidden truncate">{t.phase_name}</p>
                      </div>
                    </div>
                    <span className="hidden sm:block text-xs text-muted-foreground truncate">{t.phase_name}</span>
                    <span className={`hidden sm:inline-flex items-center gap-1 text-xs tabular-nums ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {due ? (
                        <>
                          {overdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {format(due, "d MMM", { locale: pt })}
                          {!isDone && daysToDue !== null && (
                            <span className="opacity-70">{daysToDue === 0 ? ' · hoje' : daysToDue > 0 ? ` · ${daysToDue}d` : ` · -${Math.abs(daysToDue)}d`}</span>
                          )}
                        </>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </span>
                    <div className="sm:justify-self-end">
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-0 ${
                          isDone ? 'bg-success/15 text-success' : isProgress ? 'text-white' : 'bg-muted/50 text-muted-foreground'
                        }`}
                        style={isProgress ? { backgroundColor: pc } : undefined}
                      >
                        {isDone ? 'Concluída' : isProgress ? 'Em progresso' : 'Pendente'}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ) : (
          <SectionCard className="p-8 text-center">
            <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              {clientDeliverables.length === 0 ? 'Não tens nenhuma entrega pendente — está tudo connosco. ✨' : 'Sem entregas neste filtro.'}
            </p>
          </SectionCard>
        )}
      </div>

      {/* ─── Divisor ─── */}
      <div className="border-t border-border/40" />

      {/* ─── Entregáveis (materiais para o cliente) ─── */}
      <div className="space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="h-4 w-4" style={{ color: pc }} strokeWidth={1.5} />
            <h3 className="text-base font-semibold tracking-tight">Entregáveis</h3>
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
                placeholder="Procurar entregável..."
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          )}
        </header>

        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map(item => {
              const isAssetFile = item.type === 'asset-file';
              const hasUrl = !!item.url;
              const commonInner = (
                <SectionCard className="p-4 hover:-translate-y-0.5 transition-transform h-full">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: pcAlpha(0.08) }}
                  >
                    {item.type === 'link'
                      ? <FolderOpen className="h-5 w-5" style={{ color: pc }} strokeWidth={1.5} />
                      : <FileText className="h-5 w-5" style={{ color: pc }} strokeWidth={1.5} />}
                  </div>
                  <p className="text-xs font-medium leading-snug line-clamp-2 mb-1">{item.label}</p>
                  {item.project && (
                    <p className="text-[10px] text-muted-foreground/80 line-clamp-1 mb-1">{item.project}</p>
                  )}
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 group-hover:text-foreground transition-colors">
                    {item.type === 'link' ? <ExternalLink className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                    Abrir
                  </span>
                </SectionCard>
              );
              if (isAssetFile) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.assetId && openAssetFile(item.assetId)}
                    className="group block text-left"
                  >
                    {commonInner}
                  </button>
                );
              }
              const CardTag = hasUrl ? 'a' : 'div';
              return (
                <CardTag
                  key={item.id}
                  {...(hasUrl ? { href: item.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group block"
                >
                  {commonInner}
                </CardTag>
              );
            })}
          </div>
        ) : (
          <SectionCard className="p-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              {matQuery ? 'Sem resultados para a tua pesquisa.' : 'Ainda sem entregáveis disponíveis.'}
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
