import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CalendarRange, ChevronRight, ChevronDown, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const QUARTERS = [
  { short: 'T1', label: '1º Trimestre', range: 'Jan – Mar', monthIdx: [0, 1, 2] },
  { short: 'T2', label: '2º Trimestre', range: 'Abr – Jun', monthIdx: [3, 4, 5] },
  { short: 'T3', label: '3º Trimestre', range: 'Jul – Set', monthIdx: [6, 7, 8] },
  { short: 'T4', label: '4º Trimestre', range: 'Out – Dez', monthIdx: [9, 10, 11] },
];

interface Props {
  planning: any;
  year: number;
}

export function HorizonsView({ planning, year }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);

  const now = new Date();
  const currentQuarter = year === now.getFullYear() ? Math.floor(now.getMonth() / 3) : -1;

  const quarters = useMemo(() => {
    return QUARTERS.map((q, idx) => {
      const monthNames = q.monthIdx.map(i => MONTHS[i]);
      const pp = planning.getPeriodProgress(monthNames);
      const months = q.monthIdx.map(i => ({
        idx: i,
        name: MONTHS[i],
        ...planning.getPeriodProgress([MONTHS[i]]),
      }));
      return { ...q, idx, monthNames, pct: pp.pct, count: pp.count, achieved: pp.achievedCount, months };
    });
  }, [planning, year]);

  const statusFor = (q: typeof quarters[number]) => {
    if (q.count === 0) return { label: 'Sem metas', tone: 'muted' as const };
    if (q.pct >= 80) return { label: 'Forte', tone: 'success' as const };
    if (q.pct >= 50) return { label: 'Em curso', tone: 'primary' as const };
    if (q.idx < currentQuarter) return { label: 'Atrasado', tone: 'destructive' as const };
    return { label: 'A caminho', tone: 'muted' as const };
  };

  return (
    <Card className="hq-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Horizontes do ano
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Progresso por trimestre. Clica num trimestre para ver os meses.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <a href={`/executive/planeamento/operacional?ano=${year}`}>
              Ver vista mensal <ArrowRight className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quarters.map(q => {
            const status = statusFor(q);
            const isCurrent = q.idx === currentQuarter;
            const isOpen = expanded === q.idx;
            return (
              <button
                key={q.short}
                onClick={() => setExpanded(isOpen ? null : q.idx)}
                className={`text-left rounded-xl border p-3 hq-transition ${
                  isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:border-primary/30'
                } ${isOpen ? 'ring-2 ring-primary/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{q.short}</p>
                    <p className="text-sm font-semibold">{q.range}</p>
                  </div>
                  {status.tone === 'success' ? (
                    <Badge variant="outline" className="text-[10px] gap-1 border-success/40 text-success">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {status.label}
                    </Badge>
                  ) : status.tone === 'destructive' ? (
                    <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5" /> {status.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{status.label}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{q.count} metas · {q.achieved} ✓</span>
                  <span className="font-medium tabular-nums text-foreground">{q.pct}%</span>
                </div>
                <Progress value={q.pct} className="h-1.5" />
                <div className="flex items-center justify-end mt-2 text-[11px] text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span className="ml-0.5">{isOpen ? 'Fechar' : 'Ver meses'}</span>
                </div>
              </button>
            );
          })}
        </div>

        {expanded !== null && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {QUARTERS[expanded].short} · {QUARTERS[expanded].range}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {quarters[expanded].months.map(m => (
                <button
                  key={m.name}
                  onClick={() => navigate(`/executive/planeamento/operacional?ano=${year}&mes=${m.idx + 1}`)}
                  className="rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm hq-transition p-3 text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{m.pct}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    {m.count} metas · {m.achievedCount} concluídas
                  </p>
                  <Progress value={m.pct} className="h-1" />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}