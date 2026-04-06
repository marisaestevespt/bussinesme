import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Clock, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectPhase {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  linked_sop_id: string | null;
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', icon: Circle, color: 'text-muted-foreground' },
  { value: 'em_curso', label: 'Em curso', icon: Clock, color: 'text-info' },
  { value: 'concluida', label: 'Concluída', icon: CheckCircle2, color: 'text-success' },
];

function getStatusInfo(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

interface Props {
  projectId: string;
}

export function ProjectPhasesTimeline({ projectId }: Props) {
  const qc = useQueryClient();
  const key = ['project-phases', projectId];

  const { data: phases = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await (supabase as any).from('project_phases').select('*').eq('project_id', projectId).order('sort_order');
      return (data || []) as ProjectPhase[];
    },
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      const updates: Record<string, unknown> = { ...fields };
      if (fields.status === 'em_curso' && !fields.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (fields.status === 'concluida' && !fields.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      if (fields.status === 'pendente') {
        updates.started_at = null;
        updates.completed_at = null;
      }
      await (supabase as any).from('project_phases').update(updates).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (phases.length === 0) return null;

  const currentPhaseIdx = phases.findIndex(p => p.status === 'em_curso');
  const completedCount = phases.filter(p => p.status === 'concluida').length;
  const progress = Math.round((completedCount / phases.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm">Fases do Projeto</CardTitle>
          <Badge variant="secondary" className="text-[10px]">{completedCount}/{phases.length}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{progress}% concluído</span>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative">
          {phases.map((phase, i) => {
            const si = getStatusInfo(phase.status);
            const Icon = si.icon;
            const isLast = i === phases.length - 1;

            return (
              <div key={phase.id} className="flex gap-3 relative">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2',
                    phase.status === 'concluida' ? 'border-success bg-success/10' :
                    phase.status === 'em_curso' ? 'border-info bg-info/10' :
                    'border-muted bg-muted/30'
                  )}>
                    <Icon className={cn('h-3.5 w-3.5', si.color)} />
                  </div>
                  {!isLast && (
                    <div className={cn('w-0.5 flex-1 min-h-[24px]',
                      phase.status === 'concluida' ? 'bg-success/40' : 'bg-border'
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className={cn('pb-4 flex-1 min-w-0', isLast && 'pb-0')}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{phase.name || `Fase ${phase.sort_order + 1}`}</span>
                    <Select value={phase.status} onValueChange={(v) => updatePhase.mutate({ id: phase.id, status: v })}>
                      <SelectTrigger className="h-6 text-[10px] w-24 border-none shadow-none p-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {phase.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
