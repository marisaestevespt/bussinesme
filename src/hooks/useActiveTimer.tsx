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
}

interface ActiveTimerContextValue {
  activeTimer: ActiveTimer | null;
  elapsed: number;
  startTimer: (taskId: string, taskName: string) => Promise<void>;
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
      // Fetch task name
      const { data: task } = await supabase.from('tasks').select('name').eq('id', data.task_id).single();
      setActiveTimer({
        entryId: data.id,
        taskId: data.task_id,
        taskName: task?.name || 'Tarefa',
        startedAt: parseISO(data.started_at),
      });
    } else {
      setActiveTimer(null);
    }
  }, [user?.id]);

  useEffect(() => { fetchRunning(); }, [fetchRunning]);

  // Tick
  useEffect(() => {
    if (activeTimer) {
      intervalRef.current = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), activeTimer.startedAt));
      }, 1000);
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
      await stopTimerInternal();
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
    });
    queryClient.invalidateQueries({ queryKey: ['task-time-entries', taskId] });
  }, [user?.id, activeTimer]);

  const stopTimerInternal = useCallback(async () => {
    if (!activeTimer) return;
    const now = new Date();
    const mins = Math.max(1, differenceInMinutes(now, activeTimer.startedAt));
    await supabase.from('task_time_entries')
      .update({ ended_at: now.toISOString(), duration_minutes: mins })
      .eq('id', activeTimer.entryId);
    queryClient.invalidateQueries({ queryKey: ['task-time-entries', activeTimer.taskId] });
    queryClient.invalidateQueries({ queryKey: ['task-time-entries-totals'] });
    const prevTimer = activeTimer;
    setActiveTimer(null);
    return prevTimer;
  }, [activeTimer, queryClient]);

  const stopTimer = useCallback(async () => {
    await stopTimerInternal();
    toast.success('Timer parado');
  }, [stopTimerInternal]);

  return (
    <ActiveTimerContext.Provider value={{ activeTimer, elapsed, startTimer, stopTimer, refreshTimer: fetchRunning }}>
      {children}
    </ActiveTimerContext.Provider>
  );
}
