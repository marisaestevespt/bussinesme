import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

export function BlockMarketing({ year, month }: { year: number; month: number }) {
  const { data } = useQuery({
    queryKey: ['cockpit-marketing', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;

      const [goals, ideas, actions] = await Promise.all([
        supabase.from('marketing_goals').select('*').eq('year', year).eq('month', month),
        supabase.from('marketing_ideas').select('id, channel, content_type, created_at').gte('created_at', start).lte('created_at', end + 'T23:59:59'),
        supabase.from('commercial_sales_actions').select('id, action_name, status, action_type, start_date').eq('action_type', 'marketing').gte('start_date', start).lte('start_date', end),
      ]);

      const channelCount: Record<string, number> = {};
      (ideas.data || []).forEach((i: any) => {
        const k = i.channel || 'Outros';
        channelCount[k] = (channelCount[k] || 0) + 1;
      });

      return { goals: goals.data || [], ideas: ideas.data || [], actions: actions.data || [], channelCount };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Meta */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Meta de marketing</div>
        {(data?.goals || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem meta definida</p>
        ) : (
          (data!.goals).slice(0, 3).map((g: any) => {
            const pct = g.target_value ? Math.min(100, (Number(g.current_value || 0) / Number(g.target_value)) * 100) : 0;
            return (
              <div key={g.id} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="truncate">{g.metric_label || g.metric_key}</span>
                  <span className="tabular-nums text-muted-foreground">{Number(g.current_value || 0)}/{Number(g.target_value || 0)}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </div>

      {/* Conteúdos */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Conteúdos do mês</div>
        <div className="text-lg font-semibold tabular-nums">{data?.ideas.length ?? 0}</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(data?.channelCount || {}).slice(0, 5).map(([ch, n]) => (
            <Badge key={ch} variant="outline" className="text-[10px]">{ch}: {n}</Badge>
          ))}
        </div>
        <Link to="/hub/marketing" className="text-[11px] text-primary hover:underline">Abrir calendário editorial →</Link>
      </div>

      {/* Ações */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Ações e campanhas</div>
        {(data?.actions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem campanhas este mês</p>
        ) : (
          <ul className="space-y-1 max-h-32 overflow-auto pr-1">
            {data!.actions.slice(0, 6).map((a: any) => (
              <li key={a.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px] px-1 py-0">{a.status || '—'}</Badge>
                <span className="truncate">{a.action_name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}