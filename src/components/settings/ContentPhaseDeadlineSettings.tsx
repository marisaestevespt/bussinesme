import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_OPTIONS, getStatusOption } from '@/lib/marketing-constants';

interface PhaseSetting {
  status: string;
  days_before_publish: number;
  enabled: boolean;
  sort_order: number;
}

// Statuses that represent production work — exclude post-publish/parking states
const PRODUCTION_STATUSES = new Set([
  'em_ideia', 'pronto_para_copy', 'em_copy', 'pronto_para_design',
  'em_design', 'gravar', 'editar', 'aprovacao_final', 'tudo_pronto', 'agendado',
]);

export function ContentPhaseDeadlineSettings() {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['content-phase-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_phase_settings' as any)
        .select('*')
        .order('sort_order');
      return (data || []) as unknown as PhaseSetting[];
    },
  });

  if (!isOwner) return null;

  // Merge: ensure every production status has a row (fallback default = 0 days)
  const byStatus = new Map(settings.map(s => [s.status, s]));
  const rows = STATUS_OPTIONS
    .filter(s => PRODUCTION_STATUSES.has(s.value))
    .map(s => byStatus.get(s.value) || {
      status: s.value, days_before_publish: 0, enabled: false, sort_order: 0,
    });

  const updateRow = async (status: string, patch: Partial<PhaseSetting>) => {
    const existing = byStatus.get(status);
    if (existing) {
      await supabase
        .from('content_phase_settings' as any)
        .update(patch as any)
        .eq('status', status);
    } else {
      await supabase
        .from('content_phase_settings' as any)
        .insert({ status, days_before_publish: 0, enabled: true, ...patch } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['content-phase-settings'] });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    toast.success('Prazos atualizados');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold tracking-tight uppercase">Prazos por Fase de Conteúdo</h2>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Para cada fase, define quantos dias <strong>antes da data de publicação</strong> a fase tem de estar concluída.
          Os prazos das tarefas dos conteúdos são calculados automaticamente a partir destes valores.
          Podes sempre ajustar manualmente num conteúdo específico.
        </p>
        <div className="space-y-1">
          {rows.map(row => {
            const opt = getStatusOption(row.status);
            return (
              <div key={row.status} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 px-1 rounded-md hover:bg-muted/30 hq-transition">
                <div className="text-sm text-foreground">{opt?.label || row.status}</div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={row.days_before_publish}
                    onChange={e => {
                      const v = parseInt(e.target.value || '0', 10);
                      if (!isNaN(v)) updateRow(row.status, { days_before_publish: Math.max(0, v) });
                    }}
                    className="h-8 w-16 text-center tabular-nums"
                    disabled={!row.enabled}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">dias antes</span>
                </div>
                <Switch
                  checked={row.enabled}
                  onCheckedChange={v => updateRow(row.status, { enabled: v })}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}