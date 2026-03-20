import { useActiveTimer } from '@/hooks/useActiveTimer';
import { Button } from '@/components/ui/button';
import { Pause, Play, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function FloatingTimer() {
  const { activeTimer, elapsed, pauseTimer, resumeTimer, stopTimer } = useActiveTimer();
  const navigate = useNavigate();

  if (!activeTimer) return null;

  const isPaused = activeTimer.paused;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-card border border-border rounded-xl shadow-lg px-4 py-2.5 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {isPaused ? (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </>
          )}
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[140px]">
            {activeTimer.taskName}
          </span>
          <span className="font-mono text-sm font-semibold text-foreground tabular-nums leading-tight">
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isPaused ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-emerald-500/10 hover:text-emerald-600"
            onClick={resumeTimer}
            title="Retomar"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-amber-500/10 hover:text-amber-600"
            onClick={pauseTimer}
            title="Pausar"
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={stopTimer}
          title="Terminar"
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
