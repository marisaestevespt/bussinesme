import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { EntitySection } from '@/components/layout/entity';
import { ProjectPhasesGallery } from '@/components/project/ProjectPhasesGallery';
import { Target, BookOpen, CalendarIcon, FileText, Users, Lightbulb, StickyNote, ClipboardList, ChevronRight, Workflow, Video, RefreshCw } from 'lucide-react';
import type { ProjectFull, Meeting } from '@/hooks/useProjectDetailData';

type SubPage = null | 'objetivo' | 'diretrizes' | 'cronograma' | 'briefing' | 'brainstorming' | 'entregaveis' | 'reunioes' | 'recursos' | 'notas' | 'outras_info';

interface Props {
  projectId: string;
  local: ProjectFull;
  meetings: Meeting[];
  resolvedClientId: string | null | undefined;
  taskMode: string;
  taskModes?: string[];
  setSubPage: (s: SubPage) => void;
}

const hasText = (v: unknown) => typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim().length > 0;

export function ProjectMainTab({ projectId, local, meetings, resolvedClientId, taskMode, taskModes, setSubPage }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const hasPhases = (taskModes || [taskMode]).includes('fases');

  const handleSyncTemplate = async () => {
    if (!local.product_id) {
      toast.error('Este projeto não está associado a um produto.');
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_project_with_template', { _project_id: projectId });
      if (error) throw error;
      const result = (data ?? {}) as { phases_added?: number; added?: number; error?: string };
      if (result.error) {
        toast.error(result.error);
      } else {
        const phases = result.phases_added ?? 0;
        const deliverables = result.added ?? 0;
        if (phases === 0 && deliverables === 0) {
          toast.success('Projeto já está sincronizado com o produto.');
        } else {
          toast.success(`Sincronizado: +${phases} fase(s), +${deliverables} entregável(eis).`);
        }
        qc.invalidateQueries({ queryKey: ['project-phases', projectId] });
        qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      }
    } catch (e) {
      toast.error('Erro ao sincronizar com o produto', { description: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  };

  const now = new Date();
  const next = [...(meetings || [])]
    .filter((m) => m.date_time && new Date(m.date_time) >= now)
    .sort((a, b) => new Date(a.date_time!).getTime() - new Date(b.date_time!).getTime())[0];

  const baseTiles = local.type === 'cliente_servico_mensal' ? [
    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes da Avença', filled: hasText(local.diretrizes) },
    { key: '__agenda__' as SubPage, icon: CalendarIcon, label: 'Calendário Editorial', filled: false },
    { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas', filled: hasText(local.project_notes) },
  ] : [
    { key: 'objetivo' as SubPage, icon: Target, label: 'Objetivo e Definição', filled: hasText(local.objetivo) },
    { key: 'diretrizes' as SubPage, icon: BookOpen, label: 'Diretrizes Iniciais', filled: hasText(local.diretrizes) },
    { key: 'cronograma' as SubPage, icon: CalendarIcon, label: 'Cronograma Geral', filled: hasText(local.cronograma) },
    { key: 'notas' as SubPage, icon: StickyNote, label: 'Notas', filled: hasText(local.project_notes) },
  ];

  const devTiles = [
    local.type === 'interno'
      ? { key: 'brainstorming' as SubPage, icon: Lightbulb, label: 'Brainstorming', filled: hasText((local as { brainstorming?: string }).brainstorming) }
      : { key: 'briefing' as SubPage, icon: ClipboardList, label: local.type === 'cliente_servico_mensal' ? 'Âmbito da Avença' : 'Briefing', filled: false },
    { key: 'entregaveis' as SubPage, icon: FileText, label: 'Entregáveis', filled: hasText(local.entregaveis) },
    { key: 'reunioes' as SubPage, icon: Users, label: 'Reuniões', filled: meetings.length > 0 },
    { key: 'recursos' as SubPage, icon: Lightbulb, label: 'Recursos & Materiais', filled: hasText(local.recursos) },
  ];

  return (
    <>
      {next && (
        <button
          onClick={() => navigate(`/hub/reunioes/${next.id}`)}
          className="w-full flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent px-4 py-3 text-left transition-all hover:border-primary/60 hover:shadow-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-primary/15 p-2">
              <Video className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Próxima Reunião</p>
              <p className="text-sm font-semibold truncate">{next.title}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(next.date_time!), "EEEE, d MMM 'às' HH:mm", { locale: pt })}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        </button>
      )}

      <EntitySection title="Menu Inicial" icon={Target}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {baseTiles.map(({ key, icon: Icon, label, filled }) => (
            <button key={key} onClick={() => {
              if (key === ('__agenda__' as SubPage)) {
                const params = new URLSearchParams();
                if (resolvedClientId) params.set('client_id', resolvedClientId);
                if (local.client_name) params.set('client_name', local.client_name);
                navigate(`/hub/agenda?${params.toString()}`);
              } else {
                setSubPage(key);
              }
            }} className="group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:from-primary/25 group-hover:to-primary/10 group-hover:ring-primary/30">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground leading-tight flex items-center gap-2">
                {label}
                {filled && <span className="h-1.5 w-1.5 rounded-full bg-success" title="Já tem conteúdo" />}
              </span>
              <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </EntitySection>

      <EntitySection title="Desenvolvimento" icon={FileText}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {devTiles.map(({ key, icon: Icon, label, filled }) => (
            <button key={key} onClick={() => setSubPage(key)} className="group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-card to-card/80 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
              <div className="rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 ring-1 ring-primary/10 transition-all group-hover:from-primary/25 group-hover:to-primary/10 group-hover:ring-primary/30">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground leading-tight flex items-center gap-2">
                {label}
                {filled && <span className="h-1.5 w-1.5 rounded-full bg-success" title="Já tem conteúdo" />}
              </span>
              <ChevronRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </EntitySection>

      {hasPhases && (
        <EntitySection
          title="Fases do Projeto"
          icon={Workflow}
          action={local.product_id ? (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={syncing} onClick={handleSyncTemplate} title="Importa fases e entregáveis novos do produto sem apagar nada existente">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'A sincronizar...' : 'Sincronizar com produto'}
            </Button>
          ) : undefined}
        >
          <ProjectPhasesGallery projectId={projectId} projectStartDate={local.start_date} />
        </EntitySection>
      )}
    </>
  );
}