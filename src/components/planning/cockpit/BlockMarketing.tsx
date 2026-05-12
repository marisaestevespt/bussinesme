import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CalendarDays, Megaphone, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContentCalendar } from '@/components/marketing/ContentCalendar';
import type { ContentItem, MarketingChannel, ContentChannelLink } from '@/lib/marketing-constants';

export function BlockMarketing({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cockpit-marketing', year, month],
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevStart = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;

      const [goals, content, leadsNow, leadsPrev, funnels, automations, campaigns, channels, channelLinks, profiles, attachments] = await Promise.all([
        supabase.from('marketing_goals').select('*').eq('year', year).eq('month', month),
        supabase.from('content_items').select('*').gte('scheduled_at', start).lte('scheduled_at', end + 'T23:59:59').order('scheduled_at', { ascending: true }),
        supabase.from('crm_leads').select('id, added_at, status').gte('added_at', start).lte('added_at', end + 'T23:59:59'),
        supabase.from('crm_leads').select('id').gte('added_at', prevStart).lt('added_at', start),
        supabase.from('marketing_funnels').select('id, name, status, tipo_funil').eq('status', 'ativo'),
        supabase.from('marketing_automations').select('id, name, status').eq('status', 'ativo'),
        supabase.from('commercial_sales_actions').select('id, action_name, status, action_type, start_date, end_date').eq('action_type', 'marketing').or(`and(start_date.gte.${start},start_date.lte.${end}),and(end_date.gte.${start},end_date.lte.${end})`),
        supabase.from('marketing_channels').select('*').order('sort_order'),
        supabase.from('content_channels').select('*'),
        supabase.from('profiles').select('id, full_name, avatar_url'),
        supabase.from('content_attachments').select('*'),
      ]);

      const leads = leadsNow.data || [];
      const leadsClosed = leads.filter((l: any) => (l.status || '').toLowerCase() === 'ganha').length;
      return {
        goals: goals.data || [],
        content: (content.data || []) as ContentItem[],
        leadsCount: leads.length,
        leadsPrev: (leadsPrev.data || []).length,
        leadConversion: leads.length > 0 ? (leadsClosed / leads.length) * 100 : 0,
        funnels: funnels.data || [],
        automations: automations.data || [],
        campaigns: campaigns.data || [],
        channels: (channels.data || []) as MarketingChannel[],
        channelLinks: (channelLinks.data || []) as ContentChannelLink[],
        profiles: profiles.data || [],
        attachments: (attachments.data || []) as any[],
      };
    },
    staleTime: 60_000,
  });

  if (isLoading || !data) return <div className="text-xs text-muted-foreground">A carregar…</div>;

  const leadDelta = data.leadsCount - data.leadsPrev;

  // Status counts
  const counts: Record<string, number> = {};
  data.content.forEach((c: any) => { counts[c.status] = (counts[c.status] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/hub/comercial?tab=pipeline" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block" target="_blank" rel="noopener noreferrer">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Leads no mês</div>
          <div className="text-lg font-semibold tabular-nums">{data.leadsCount}</div>
          <div className={cn('text-[10px] mt-0.5', leadDelta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {leadDelta >= 0 ? '+' : ''}{leadDelta} vs. mês anterior
          </div>
        </Link>
        <Link to="/hub/comercial?tab=pipeline" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block" target="_blank" rel="noopener noreferrer">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversão lead→cliente</div>
          <div className="text-lg font-semibold tabular-nums">{data.leadConversion.toFixed(1)}%</div>
        </Link>
        <Link to="/hub/marketing" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block" target="_blank" rel="noopener noreferrer">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conteúdos planeados</div>
          <div className="text-lg font-semibold tabular-nums">{data.content.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{counts.publicado || 0} publicados</div>
        </Link>
        <Link to="/hub/marketing?tab=funis" className="hq-surface-sunken rounded-lg p-3 hover:bg-accent/40 hq-transition block" target="_blank" rel="noopener noreferrer">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Funis e automações</div>
          <div className="text-lg font-semibold tabular-nums">{data.funnels.length + data.automations.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{data.funnels.length} funis · {data.automations.length} autom.</div>
        </Link>
      </div>

      {/* Metas marketing */}
      {data.goals.length > 0 && (
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Metas de marketing</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.goals.slice(0, 4).map((g: any) => {
              const pct = g.target_value ? Math.min(100, (Number(g.current_value || 0) / Number(g.target_value)) * 100) : 0;
              return (
                <div key={g.id} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="truncate">{g.metric_label || g.metric_key}</span>
                    <span className="tabular-nums text-muted-foreground">{Number(g.current_value || 0)}/{Number(g.target_value || 0)}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendário de conteúdo */}
      <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium">Calendário de conteúdo</div>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] px-2">
            <Link to="/hub/marketing" target="_blank" rel="noopener noreferrer">Abrir editor →</Link>
          </Button>
        </div>
        <ContentCalendar
          items={data.content}
          channels={data.channels}
          contentChannelLinks={data.channelLinks}
          profiles={data.profiles}
          attachments={data.attachments}
          calendarOnly
        />
      </div>

      {/* Funis + Campanhas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium">Funis ativos</div>
          </div>
            {data.funnels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem funis ativos</p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-auto pr-1">
                {data.funnels.slice(0, 6).map((f: any) => (
                  <li key={f.id}>
                    <Link to={`/hub/marketing/funis/${f.id}`} className="flex items-center gap-2 text-xs hover:bg-accent/40 rounded px-1 py-0.5 hq-transition" target="_blank" rel="noopener noreferrer">
                      <span className="truncate flex-1">{f.name}</span>
                      {f.tipo_funil && <Badge variant="outline" className="text-[9px] px-1 py-0">{f.tipo_funil}</Badge>}
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="hq-surface-sunken rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium">Campanhas no mês</div>
          </div>
            {data.campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem campanhas</p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-auto pr-1">
                {data.campaigns.slice(0, 6).map((a: any) => (
                  <li key={a.id}>
                    <Link to="/hub/comercial?tab=acoes" className="flex items-center gap-2 text-xs hover:bg-accent/40 rounded px-1 py-0.5 hq-transition" target="_blank" rel="noopener noreferrer">
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{a.status || '—'}</Badge>
                      <span className="truncate">{a.action_name}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
