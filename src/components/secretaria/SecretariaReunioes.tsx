import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMyMeetings, useProfiles } from './secretaria-shared';
import { NewMeetingButton } from '@/components/meeting/NewMeetingButton';
import { getMeetingStatusInfo } from '@/lib/meetingStatus';

export default function SecretariaReunioes() {
  const meetings = useMyMeetings();
  const profiles = useProfiles();
  const [view, setView] = useState<'proximas' | 'todas'>('proximas');
  const now = new Date();
  const filtered = view === 'proximas' ? (meetings.data || []).filter(m => parseISO(m.date_time) >= startOfDay(now)) : (meetings.data || []);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'proximas', label: 'Próximas' },
            { id: 'todas', label: 'Todas' },
          ] as const).map(v => {
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 h-8 text-xs font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground/80 border-border hover:border-foreground/40',
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <NewMeetingButton size="sm" label="Nova Reunião" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Data & Hora</TableHead>
            <TableHead>Reunião</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Projeto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem reuniões.</TableCell></TableRow>}
          {filtered.map((m: any) => {
            const si = getMeetingStatusInfo(m.status);
            return (
            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/hub/reunioes/${m.id}`, '_self')}>
              <TableCell><Badge className={cn('text-[10px]', si.color)}>{si.label}</Badge></TableCell>
              <TableCell className="text-sm">{format(parseISO(m.date_time), "dd/MM/yyyy 'às' HH:mm")}</TableCell>
              <TableCell className="font-medium">{m.title}</TableCell>
              <TableCell>
                {m.transcript_url && <Button variant="ghost" size="sm" asChild><a href={m.transcript_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.project_name || '—'}</TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
