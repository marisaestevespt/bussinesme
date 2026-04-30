import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ListChecks } from 'lucide-react';
import { EntitySection } from '@/components/layout/entity/EntitySection';
import { ProjectAssetGallery } from '@/components/project/ProjectAssetGallery';
import { SubPageShell } from './SubPageShell';
import { format, parseISO, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Props {
  projectId: string;
  cronogramaJson: string | null;
  onChange: (json: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pendente: { label: 'Pendente', variant: 'outline' },
  em_curso: { label: 'Em curso', variant: 'default' },
  concluida: { label: 'Concluída', variant: 'secondary' },
  bloqueada: { label: 'Bloqueada', variant: 'destructive' },
};

function fmt(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), "d MMM yyyy", { locale: pt }); } catch { return d; }
}

export function CronogramaSubPage({ projectId, onBack, onSave, saving, dirty }: Props) {
  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['project-phases-cronograma', projectId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('project_phases')
        .select('id, name, status, planned_start, planned_end, sort_order')
        .eq('project_id', projectId)
        .order('sort_order');
      return (data || []) as Array<{ id: string; name: string; status: string; planned_start: string | null; planned_end: string | null; sort_order: number }>;
    },
  });

  return (
    <SubPageShell
      title="Cronograma Geral"
      description="Visão macro das fases do projeto. Para gerir entregas e detalhes usa o separador de Fases."
      icon={CalendarIcon}
      onBack={onBack}
      onSave={onSave}
      saving={saving}
      dirty={dirty}
    >
      <EntitySection title="Fases do projeto" icon={ListChecks} description="Sincronizado automaticamente com as fases criadas no projeto.">
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[40px] text-foreground">#</TableHead>
                <TableHead className="text-foreground">Fase</TableHead>
                <TableHead className="w-[140px] text-foreground">Início</TableHead>
                <TableHead className="w-[140px] text-foreground">Fim</TableHead>
                <TableHead className="w-[100px] text-foreground">Duração</TableHead>
                <TableHead className="w-[120px] text-foreground">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">A carregar...</TableCell></TableRow>
              ) : phases.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Este projeto ainda não tem fases definidas.</TableCell></TableRow>
              ) : phases.map((p, i) => {
                const dur = p.planned_start && p.planned_end ? `${differenceInDays(parseISO(p.planned_end), parseISO(p.planned_start)) + 1}d` : '—';
                const st = STATUS_LABEL[p.status] || { label: p.status, variant: 'outline' as const };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{fmt(p.planned_start)}</TableCell>
                    <TableCell className="text-sm">{fmt(p.planned_end)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dur}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </EntitySection>

      <EntitySection title="Documentos do cronograma" icon={CalendarIcon} description="Gantt em PDF, planeamentos partilhados, exports, etc.">
        <ProjectAssetGallery projectId={projectId} pageKey="cronograma" categories={['Gantt', 'Plano', 'Export']} emptyTitle="Sem documentos do cronograma" emptyDescription="Carrega Gantt, planos ou anexa links externos." />
      </EntitySection>
    </SubPageShell>
  );
}