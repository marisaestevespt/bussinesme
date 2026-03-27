import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ExternalLink } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMyMeetings, useProfiles } from './secretaria-shared';
import { MeetingFormDialog } from '@/pages/Reunioes';
import type { Profile, ProjectOption } from '@/pages/Reunioes';

export default function SecretariaReunioes() {
  const meetings = useMyMeetings();
  const profiles = useProfiles();
  const [view, setView] = useState<'proximas' | 'todas'>('proximas');
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const now = new Date();
  const filtered = view === 'proximas' ? (meetings.data || []).filter(m => parseISO(m.date_time) >= startOfDay(now)) : (meetings.data || []);

  const { data: fullProfiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles-for-meetings'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url, role_title');
      return (data || []) as Profile[];
    },
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['projects-for-meetings'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_id, client_name, department, type');
      return (data || []) as ProjectOption[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-meetings'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').order('full_name');
      return data || [];
    },
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={view === 'proximas' ? 'default' : 'outline'} size="sm" onClick={() => setView('proximas')}>Próximas</Button>
          <Button variant={view === 'todas' ? 'default' : 'outline'} size="sm" onClick={() => setView('todas')}>Todas</Button>
        </div>
        <Button size="sm" onClick={() => setShowNewMeeting(true)}><Plus className="h-4 w-4 mr-1" /> Nova Reunião</Button>
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
          {filtered.map((m: any) => (
            <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/hub/reunioes/${m.id}`, '_self')}>
              <TableCell><Badge variant="outline" className="text-[10px] capitalize">{m.status?.replace('_', ' ')}</Badge></TableCell>
              <TableCell className="text-sm">{format(parseISO(m.date_time), "dd/MM/yyyy 'às' HH:mm")}</TableCell>
              <TableCell className="font-medium">{m.title}</TableCell>
              <TableCell>
                {m.transcript_url && <Button variant="ghost" size="sm" asChild><a href={m.transcript_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{m.project_name || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <MeetingFormDialog
        open={showNewMeeting}
        onOpenChange={setShowNewMeeting}
        profiles={fullProfiles}
        projects={projects}
        clients={clients}
      />
    </div>
  );
}
