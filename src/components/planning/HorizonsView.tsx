import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarRange, ChevronRight, ChevronDown, ArrowRight, CheckCircle2, AlertTriangle, StickyNote, Pencil } from 'lucide-react';

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
  const qc = useQueryClient();

  const notesQuery = useQuery({
    queryKey: ['planning_quarter_notes', year],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('planning_quarter_notes')
        .select('*')
        .eq('year', year);
      return (data || []) as Array<{ id: string; year: number; quarter: number; note: string | null; status_override: string | null }>;
    },
  });

  const upsertNote = useMutation({
    mutationFn: async ({ quarter, note, status_override }: { quarter: number; note: string | null; status_override: string | null }) => {
      const existing = (notesQuery.data || []).find(n => n.quarter === quarter);
      if (existing) {
        const { error } = await (supabase as any)
          .from('planning_quarter_notes')
          .update({ note, status_override })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('planning_quarter_notes')
          .insert({ year, quarter, note, status_override });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning_quarter_notes', year] });
      toast.success('Trimestre atualizado');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || e)),
  });

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
    const n = (notesQuery.data || []).find(x => x.quarter === q.idx + 1);
    if (n?.status_override) {
      const map: Record<string, { label: string; tone: 'success' | 'primary' | 'destructive' | 'muted' }> = {
        forte: { label: 'Forte', tone: 'success' },
        em_curso: { label: 'Em curso', tone: 'primary' },
        atrasado: { label: 'Atrasado', tone: 'destructive' },
        a_caminho: { label: 'A caminho', tone: 'muted' },
        sem_metas: { label: 'Sem metas', tone: 'muted' },
      };
      return map[n.status_override] || { label: n.status_override, tone: 'muted' as const };
    }
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
            const note = (notesQuery.data || []).find(n => n.quarter === q.idx + 1);
            return (
              <div
                key={q.short}
                className={`relative text-left rounded-xl border p-3 hq-transition ${
                  isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:border-primary/30'
                } ${isOpen ? 'ring-2 ring-primary/30' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : q.idx)}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`${isOpen ? 'Fechar' : 'Expandir'} ${q.short}`}
                />
                <div className="relative flex items-center justify-between mb-2">
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
                <div className="relative flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{q.count} metas · {q.achieved} ✓</span>
                  <span className="font-medium tabular-nums text-foreground">{q.pct}%</span>
                </div>
                <Progress value={q.pct} className="relative h-1.5" />
                {note?.note && (
                  <p className="relative mt-2 text-[11px] text-muted-foreground italic line-clamp-2">
                    “{note.note}”
                  </p>
                )}
                <div className="relative flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                  <QuarterNotePopover
                    quarter={q.idx + 1}
                    initialNote={note?.note || ''}
                    initialOverride={note?.status_override || null}
                    onSave={(note, status_override) => upsertNote.mutate({ quarter: q.idx + 1, note, status_override })}
                  />
                  <div className="flex items-center">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="ml-0.5">{isOpen ? 'Fechar' : 'Ver meses'}</span>
                  </div>
                </div>
              </div>
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
                  {(() => {
                    const monthGoals = (planning.allGoals || []).filter((g: any) => g.period === m.name).slice(0, 3);
                    if (monthGoals.length === 0) return null;
                    return (
                      <ul className="mt-2 space-y-0.5">
                        {monthGoals.map((g: any) => (
                          <li key={g.id} className="text-[10px] text-muted-foreground truncate">• {g.title || g.description || 'Meta'}</li>
                        ))}
                      </ul>
                    );
                  })()}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuarterNotePopover({
  quarter,
  initialNote,
  initialOverride,
  onSave,
}: {
  quarter: number;
  initialNote: string;
  initialOverride: string | null;
  onSave: (note: string | null, status_override: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [override, setOverride] = useState<string>(initialOverride || 'auto');
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) { setNote(initialNote); setOverride(initialOverride || 'auto'); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 hover:text-foreground hq-transition"
        >
          <StickyNote className="h-3 w-3" />
          <span>Nota</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={override} onValueChange={setOverride}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (calculado)</SelectItem>
                <SelectItem value="forte">Forte</SelectItem>
                <SelectItem value="em_curso">Em curso</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="a_caminho">A caminho</SelectItem>
                <SelectItem value="sem_metas">Sem metas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nota / contexto</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: T1 atrasado por contratação tardia"
              className="text-xs min-h-[80px] mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => {
              onSave(note.trim() || null, override === 'auto' ? null : override);
              setOpen(false);
            }}>Guardar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}