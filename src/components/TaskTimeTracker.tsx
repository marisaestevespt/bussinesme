import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Plus, Trash2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { pt } from 'date-fns/locale';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface TaskTimeTrackerProps {
  taskId: string;
  /** Minimal one-line layout (for use inside EntityProperty). */
  compact?: boolean;
}

export function TaskTimeTracker({ taskId, compact }: TaskTimeTrackerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['task-time-entries', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Check for running timer (entry with started_at but no ended_at)
  useEffect(() => {
    const running = entries.find(e => e.started_at && !e.ended_at && e.user_id === user?.id);
    if (running) {
      const start = parseISO(running.started_at!);
      setTimerRunning(true);
      setTimerStart(start);
    }
  }, [entries, user?.id]);

  // Tick the timer
  useEffect(() => {
    if (timerRunning && timerStart) {
      intervalRef.current = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), timerStart));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerStart]);

  const startTimer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_time_entries').insert({
        task_id: taskId,
        user_id: user!.id,
        started_at: new Date().toISOString(),
        duration_minutes: 0,
        is_manual: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      setTimerRunning(true);
      setTimerStart(new Date());
    },
    onError: () => toast.error('Erro ao iniciar timer'),
  });

  const stopTimer = useMutation({
    mutationFn: async () => {
      const running = entries.find(e => e.started_at && !e.ended_at && e.user_id === user?.id);
      if (!running) return;
      const now = new Date();
      const mins = Math.max(1, differenceInMinutes(now, parseISO(running.started_at!)));
      const { error } = await supabase.from('task_time_entries')
        .update({ ended_at: now.toISOString(), duration_minutes: mins })
        .eq('id', running.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-time-entries-totals'] });
      setTimerRunning(false);
      setTimerStart(null);
      toast.success('Tempo registado');
    },
    onError: () => toast.error('Erro ao parar timer'),
  });

  const addManual = useMutation({
    mutationFn: async () => {
      const h = parseInt(manualHours || '0');
      const m = parseInt(manualMinutes || '0');
      const total = h * 60 + m;
      if (total <= 0) throw new Error('invalid');
      const { error } = await supabase.from('task_time_entries').insert({
        task_id: taskId,
        user_id: user!.id,
        duration_minutes: total,
        is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-time-entries-totals'] });
      setManualHours('');
      setManualMinutes('');
      toast.success('Tempo adicionado');
    },
    onError: () => toast.error('Insere um tempo válido'),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      const { error } = await supabase.from('task_time_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-time-entries-totals'] });
    },
  });

  const totalMinutes = entries
    .filter(e => e.ended_at || e.is_manual)
    .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <span className="text-sm tabular-nums text-foreground">
          {timerRunning ? formatTimer(elapsed) : (totalMinutes > 0 ? formatDuration(totalMinutes) : '—')}
        </span>
        {timerRunning ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => stopTimer.mutate()}
            disabled={stopTimer.isPending}
          >
            <Pause className="h-3.5 w-3.5" /> Parar
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => startTimer.mutate()}
            disabled={startTimer.isPending}
          >
            <Play className="h-3.5 w-3.5" /> Iniciar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" /> Tempo investido
        {totalMinutes > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">{formatDuration(totalMinutes)} total</Badge>
        )}
      </Label>

      {/* Timer */}
      <div className="flex items-center gap-2">
        {timerRunning ? (
          <>
            <div className="font-mono text-lg font-semibold text-primary tabular-nums">
              {formatTimer(elapsed)}
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1"
              onClick={() => stopTimer.mutate()}
              disabled={stopTimer.isPending}
            >
              <Pause className="h-3.5 w-3.5" /> Parar
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => startTimer.mutate()}
            disabled={startTimer.isPending}
          >
            <Play className="h-3.5 w-3.5" /> Iniciar timer
          </Button>
        )}
      </div>

      {/* Manual entry */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <span className="text-[10px] text-muted-foreground">Horas</span>
          <Input
            type="number"
            min="0"
            value={manualHours}
            onChange={e => setManualHours(e.target.value)}
            placeholder="0"
            className="h-8"
          />
        </div>
        <div className="flex-1">
          <span className="text-[10px] text-muted-foreground">Minutos</span>
          <Input
            type="number"
            min="0"
            max="59"
            value={manualMinutes}
            onChange={e => setManualMinutes(e.target.value)}
            placeholder="0"
            className="h-8"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => addManual.mutate()}
          disabled={addManual.isPending}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {/* Entries list */}
      {entries.filter(e => e.ended_at || e.is_manual).length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {entries.filter(e => e.ended_at || e.is_manual).map(entry => (
            <div key={entry.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30 border border-border/40">
              <span className="font-medium">{formatDuration(entry.duration_minutes)}</span>
              <span className="text-muted-foreground">
                {entry.is_manual ? 'Manual' : format(parseISO(entry.created_at), "d MMM HH:mm", { locale: pt })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 ml-auto shrink-0"
                onClick={() => deleteEntry.mutate(entry.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook to get total time for a set of task ids (for project view)
export function useTaskTimeTotals(taskIds: string[]) {
  return useQuery({
    queryKey: ['task-time-entries-totals', taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return 0;
      const { data, error } = await supabase
        .from('task_time_entries')
        .select('duration_minutes')
        .in('task_id', taskIds)
        .not('ended_at', 'is', null)
        .or('is_manual.eq.true');
      if (error) throw error;
      return (data || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    },
    enabled: taskIds.length > 0,
  });
}

export { formatDuration };
