import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Briefcase, FileText, FolderOpen, Download, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export function PortalWorkspaceSection({ phases, client, portalMaterials, tasks, pc, pcAlpha }: Props) {
  const total = phases.length;
  const done = phases.filter(isPhaseDone).length;
  const pct = phaseProgress(phases);

  const allItems: { id: string; label: string; url: string; type: 'link' | 'file' }[] = [];
  if (client.documents) allItems.push({ id: 'docs', label: 'Documentos', url: client.documents, type: 'link' });
  if (client.drive_folder_url) allItems.push({ id: 'drive', label: 'Pasta Drive', url: client.drive_folder_url, type: 'link' });
  portalMaterials.forEach((m) => allItems.push({ id: m.id, label: m.file_name || m.title || 'Material', url: m.file_url || '', type: 'file' }));

  return (
    <div className="space-y-5">
      <SectionTitle icon={Briefcase}>Espaço de Trabalho</SectionTitle>

      <SectionCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">📋 Fases do Projeto</p>
          {total > 0 && <span className="text-xs text-muted-foreground">{done}/{total} concluídas</span>}
        </div>
        {total > 0 ? (
          <>
            <div className="h-2.5 rounded-full bg-muted/40 mb-5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pc }} />
            </div>
            <div className="space-y-4">
              {phases.map((p, i) => {
                const isDone = isPhaseDone(p);
                const isActive = p.status === 'em_curso';
                const deliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
                return (
                  <div key={p.id} className={`rounded-xl border p-4 transition-all ${
                    isDone ? 'border-success/30 bg-success/15/50' :
                    isActive ? 'border-2 shadow-sm' : 'border-border/30 bg-muted/10'
                  }`} style={isActive ? { borderColor: pc, backgroundColor: pcAlpha(0.04) } : undefined}>
                    <div className="flex items-center gap-3">
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      ) : isActive ? (
                        <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: pc }}>{i + 1}</div>
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : ''}`}>{p.title || p.name}</p>
                          {(p.planned_start || p.planned_end) && (
                            <span className="text-[10px] text-muted-foreground">
                              {p.planned_start ? format(parseISO(p.planned_start), "d MMM", { locale: pt }) : '?'}
                              {' — '}
                              {p.planned_end ? format(parseISO(p.planned_end), "d MMM", { locale: pt }) : '?'}
                            </span>
                          )}
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                      </div>
                      <span className={`text-[10px] font-medium shrink-0 ${
                        isDone ? 'text-success' : isActive ? '' : 'text-muted-foreground'
                      }`} style={isActive ? { color: pc } : undefined}>
                        {isDone ? 'Concluído' : isActive ? 'Em curso' : 'Por começar'}
                      </span>
                    </div>
                    {deliverables.length > 0 && (
                      <div className="mt-3 pl-8 space-y-2">
                        {deliverables.map((d) => {
                          const dDone = d.status === 'concluido';
                          const dActive = d.status === 'em_progresso';
                          return (
                            <div key={d.id} className="flex items-center gap-2">
                              {dDone ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                              ) : dActive ? (
                                <div className="h-3.5 w-3.5 rounded-full border-2 shrink-0" style={{ borderColor: pc }} />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                              )}
                              <span className={`text-xs ${dDone ? 'text-muted-foreground line-through' : ''}`}>{d.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda sem fases definidas. Em breve terás aqui o progresso do teu projeto.</p>
        )}
      </SectionCard>

      <SectionCard className="p-6">
        <p className="text-sm font-semibold mb-4">📦 Entregáveis</p>
        {allItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allItems.map(item => (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="group rounded-xl border border-border/30 p-4 hover:shadow-md hover:border-border/60 transition-all flex flex-col items-center gap-3 text-center">
                <div className="p-3 rounded-xl transition-colors" style={{ backgroundColor: pcAlpha(0.08) }}>
                  {item.type === 'link' ? <FolderOpen className="h-6 w-6" style={{ color: pc }} /> : <FileText className="h-6 w-6" style={{ color: pc }} />}
                </div>
                <span className="text-xs font-medium truncate w-full">{item.label}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Download className="h-3 w-3" />{item.type === 'link' ? 'Abrir' : 'Descarregar'}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda sem entregáveis disponíveis.</p>
        )}
      </SectionCard>

      <SectionCard className="p-5">
        <p className="text-sm font-semibold mb-3">✅ Tarefas</p>
        {tasks.length > 0 ? (
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <div className="grid grid-cols-[1fr_120px] bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
              <span>Tarefa</span><span className="text-center">Estado</span>
            </div>
            {tasks.map((t, i) => (
              <div key={t.id} className={`grid grid-cols-[1fr_120px] px-4 py-3 text-sm items-center ${i < tasks.length - 1 ? 'border-b border-border/20' : ''}`}>
                <span className="truncate">{t.name}</span>
                <div className="flex justify-center">
                  <Badge variant="outline" className={`text-[10px] ${
                    t.status === 'concluida' ? 'bg-success/15 text-success border-success/30' :
                    t.status === 'em_progresso' ? 'border-0 text-white' : ''
                  }`} style={t.status === 'em_progresso' ? { backgroundColor: pc } : undefined}>
                    {t.status === 'concluida' ? 'Concluída' : t.status === 'em_progresso' ? 'Em progresso' : t.status === 'pendente' ? 'Pendente' : t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda sem tarefas atribuídas.</p>
        )}
      </SectionCard>

    </div>
  );
}