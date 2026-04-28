import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, ChevronRight, Target, Briefcase, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { planStatusLabel } from '@/hooks/usePlanningData';
import type { TacticalArea } from '@/hooks/useTacticalAreas';

interface Props {
  area: TacticalArea;
  responsibles: Array<{ id: string; full_name: string; photo_url: string | null; role_title: string | null }>;
  goals: any[];
  initiatives: any[];
  /** 0..100 progress for this area in the period */
  progress: number;
  /** Optional comparison vs a previous period (e.g. T1 vs T2) */
  comparison?: { previousPct: number; previousLabel: string } | null;
  onSelectGoal?: (goal: any) => void;
  onSelectInitiative?: (project: any) => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function TacticalAreaCard({
  area,
  responsibles,
  goals,
  initiatives,
  progress,
  comparison,
  onSelectGoal,
  onSelectInitiative,
}: Props) {
  const navigate = useNavigate();
  const hasOwner = responsibles.length > 0;
  const trend = comparison ? progress - comparison.previousPct : null;

  return (
    <Card className="hq-card overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Header: area name + responsibles */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight truncate">{area.label}</h3>
            {hasOwner ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex -space-x-2">
                  {responsibles.slice(0, 3).map((m) => (
                    <Avatar key={m.id} className="h-6 w-6 ring-2 ring-background">
                      {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                      <AvatarFallback className="text-[10px]">{initials(m.full_name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {responsibles[0].full_name}
                  {responsibles.length > 1 && ` +${responsibles.length - 1}`}
                </span>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 -ml-2 text-xs gap-1.5 text-warning hover:text-warning hover:bg-warning/10"
                onClick={() => navigate('/hub/equipa')}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Sem responsável
                <UserPlus className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold tabular-nums">{progress}%</div>
            {trend !== null && (
              <div
                className={cn(
                  'text-[10px] font-medium',
                  trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} vs {comparison!.previousLabel}
              </div>
            )}
          </div>
        </div>

        <Progress value={progress} className="h-1.5" />

        {/* Goals */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Metas <span className="tabular-nums">({goals.length})</span>
          </div>
          {goals.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 italic pl-5">Sem metas definidas.</p>
          ) : (
            <ul className="space-y-1.5">
              {goals.slice(0, 4).map((g) => {
                const target = Number(g.target_value || 0);
                const actual = Number(g.actual_value || 0);
                const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : null;
                return (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-2 py-1 -mx-1 transition-colors"
                    onClick={() => onSelectGoal?.(g)}
                  >
                    <span className="truncate flex-1">{g.name || 'Sem nome'}</span>
                    {pct !== null ? (
                      <Badge variant="secondary" className="text-[10px] tabular-nums shrink-0">
                        {pct}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {planStatusLabel(g.status)}
                      </Badge>
                    )}
                  </li>
                );
              })}
              {goals.length > 4 && (
                <li className="text-[11px] text-muted-foreground pl-2">+{goals.length - 4} mais</li>
              )}
            </ul>
          )}
        </div>

        {/* Initiatives */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" />
            Iniciativas <span className="tabular-nums">({initiatives.length})</span>
          </div>
          {initiatives.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 italic pl-5">Sem projetos no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {initiatives.slice(0, 4).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-2 py-1 -mx-1 transition-colors group"
                  onClick={() => (onSelectInitiative ? onSelectInitiative(p) : navigate(`/hub/projetos/${p.id}`))}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="truncate">{p.name}</span>
                    {p.client_name && (
                      <span className="text-[10px] text-muted-foreground truncate">· {p.client_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {p.progress ?? 0}%
                    </Badge>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </li>
              ))}
              {initiatives.length > 4 && (
                <li className="text-[11px] text-muted-foreground pl-2">+{initiatives.length - 4} mais</li>
              )}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}