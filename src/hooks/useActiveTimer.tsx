import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { differenceInSeconds, differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface ActiveTimer {
  entryId: string;
  taskId: string;
  taskName: string;
  startedAt: Date;
  paused: boolean;
  pausedElapsed: number; // seconds accumulated before pause
}

interface ActiveTimerContextValue {
  activeTimer: ActiveTimer | null;
  elapsed: number;
  startTimer: (taskId: string, taskName: string) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  refreshTimer: () => void;
}

const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

export function useActiveTimer() {
  const ctx = useContext(ActiveTimerContext);
  if (!ctx) throw new Error('useActiveTimer must be used within ActiveTimerProvider');
  return ctx;
}

export function ActiveTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRunning = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('task_time_entries')
      .select('id, task_id, started_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .eq('is_manual', false)
      .limit(1)
      .single();

    if (data && data.started_at) {
      const { data: task } = await supabase.from('tasks').select('name').eq('id', data.task_id).maybeSingle();
      setActiveTimer({
        entryId: data.id,
        taskId: data.task_id,
        taskName: task?.name || 'Tarefa',
        startedAt: parseISO(data.started_at),
        paused: false,
        pausedElapsed: 0,
      });
    } else {
      setActiveTimer(null);
    }
  }, [user?.id]);

  useEffect(() => { fetchRunning(); }, [fetchRunning]);

  // Tick
  useEffect(() => {
    if (activeTimer && !activeTimer.paused) {
      intervalRef.current = setInterval(() => {
        setElapsed(activeTimer.pausedElapsed + differenceInSeconds(new Date(), activeTimer.startedAt));
      }, 1000);
    } else if (activeTimer && activeTimer.paused) {
      setElapsed(activeTimer.pausedElapsed);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer]);

  const startTimer = useCallback(async (taskId: string, taskName: string) => {
    if (!user?.id) return;
    // Stop any existing timer first
    if (activeTimer) {
      await finishTimer();
    }
    const { data, error } = await supabase.from('task_time_entries').insert({
      task_id: taskId,
      user_id: user.id,
      started_at: new Date().toISOString(),
      duration_minutes: 0,
      is_manual: false,
    }).select('id').single();
    if (error) { toast.error('Erro ao iniciar timer'); return; }
    setActiveTimer({
      entryId: data.id,
      taskId,
      taskName,
      startedAt: new Date(),
      paused: false,
      pausedElapsed: 0,
    });
    queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
  }, [user?.id, activeTimer]);

  const pauseTimer = useCallback(() => {
    if (!activeTimer || activeTimer.paused) return;
    const currentElapsed = activeTimer.pausedElapsed + differenceInSeconds(new Date(), activeTimer.startedAt);
    setActiveTimer(prev => prev ? { ...prev, paused: true, pausedElapsed: currentElapsed } : null);
    toast.info('Timer em pausa');
  }, [activeTimer]);

  const resumeTimer = useCallback(async () => {
    if (!activeTimer || !activeTimer.paused) return;
    setActiveTimer(prev => prev ? { ...prev, paused: false, startedAt: new Date() } : null);
    toast.success('Timer retomado');
  }, [activeTimer]);

  const finishTimer = useCallback(async () => {
    if (!activeTimer) return;
    const totalSeconds = activeTimer.paused
      ? activeTimer.pausedElapsed
      : activeTimer.pausedElapsed + differenceInSeconds(new Date(), activeTimer.startedAt);
    const mins = Math.max(1, Math.round(totalSeconds / 60));
    await supabase.from('task_time_entries')
      .update({ ended_at: new Date().toISOString(), duration_minutes: mins })
      .eq('id', activeTimer.entryId);
    queryClient.invalidateQueries({ queryKey: ['task-time-entries', activeTimer.taskId] });
    queryClient.invalidateQueries({ queryKey: ['task-time-entries-totals'] });
    setActiveTimer(null);
  }, [activeTimer, queryClient]);

  const stopTimer = useCallback(async () => {
    await finishTimer();
    toast.success('Timer terminado');
  }, [finishTimer]);

  return (
    <ActiveTimerContext.Provider value={{ activeTimer, elapsed, startTimer, pauseTimer, resumeTimer, stopTimer, refreshTimer: fetchRunning }}>
      {children}
    </ActiveTimerContext.Provider>
  );
}
