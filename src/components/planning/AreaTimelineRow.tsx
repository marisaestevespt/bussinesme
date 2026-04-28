import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserPlus, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { TacticalArea } from '@/hooks/useTacticalAreas';

export interface AreaPeriodCell {
  key: string;            // e.g. 'T1', 'S1'
  label: string;          // 'T1', 'S1'
  fullLabel: string;      // 'T1 — Jan/Fev/Mar'
  progress: number;       // 0..100
  goalsCount: number;
  initiativesCount: number;
  objectivesCount?: number;
  isCurrent?: boolean;
}

interface Props {
  area: TacticalArea;
  responsibles: Array<{ id: string; full_name: string; photo_url: string | null }>;
  cells: AreaPeriodCell[];
  totalProgress: number; // year/area progress
  onSelectCell: (cellKey: string) => void;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function AreaTimelineRow({ area, responsibles, cells, totalProgress, onSelectCell }: Props) {
  const navigate = useNavigate();
  const hasOwner = responsibles.length > 0;

  return (
    <Card className="hq-card overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="space-y-1 min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/planeamento/dep/${area.key}`)}
                className="text-sm font-semibold tracking-tight truncate hover:text-primary hq-transition text-left"
              >
                {area.label}
              </button>
              {hasOwner ? (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {responsibles.slice(0, 3).map((m) => (
                      <Avatar key={m.id} className="h-5 w-5 ring-2 ring-background">
                        {m.photo_url && <AvatarImage src={m.photo_url} alt={m.full_name} />}
                        <AvatarFallback className="text-[9px]">{initials(m.full_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {responsibles[0].full_name}
                    {responsibles.length > 1 && ` +${responsibles.length - 1}`}
                  </span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 -ml-1.5 text-[11px] gap-1 text-warning hover:text-warning hover:bg-warning/10"
                  onClick={() => navigate('/hub/equipa')}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Sem responsável
                  <UserPlus className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums leading-none">{totalProgress}%</div>
                <div className="text-[10px] text-muted-foreground">no ano</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1 text-xs"
                onClick={() => navigate(`/planeamento/dep/${area.key}`)}
              >
                Abrir <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline cells */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
        >
          {cells.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelectCell(c.key)}
              className={cn(
                'group relative rounded-lg border bg-card hover:bg-muted/40 hq-transition text-left p-2.5 space-y-1.5',
                c.isCurrent && 'ring-1 ring-primary border-primary/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">{c.label}</span>
                <span className="text-[11px] tabular-nums font-medium text-muted-foreground">{c.progress}%</span>
              </div>
              <div className="h-1 rounded bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    c.progress >= 75 ? 'bg-success' : c.progress >= 40 ? 'bg-primary' : 'bg-muted-foreground/40'
                  )}
                  style={{ width: `${c.progress}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {(c.objectivesCount ?? 0) > 0 && (
                  <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4 tabular-nums">
                    {c.objectivesCount}o
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 tabular-nums">
                  {c.goalsCount}m
                </Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 tabular-nums">
                  {c.initiativesCount}p
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}