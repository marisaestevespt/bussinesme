import { useState, useMemo } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Clock, BarChart3, Building2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { OverviewTab } from '@/components/productivity/OverviewTab';
import { TimeTab } from '@/components/productivity/TimeTab';
import { CapacityTab } from '@/components/productivity/CapacityTab';

import { OverloadTab } from '@/components/productivity/OverloadTab';
import { format } from 'date-fns';

const MAIN_TABS = [
  { value: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { value: 'time', label: 'Tempo', icon: Clock },
  { value: 'capacity', label: 'Capacidade', icon: Building2 },
  { value: 'overload', label: 'Sobrecarga', icon: AlertTriangle },
];

export default function ExecutiveProductivity() {
  const [active, setActive] = useState('overview');

  const members = useQuery({
    queryKey: ['team', 'members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('*').order('full_name');
      return (data || []) as any[];
    },
  });

  const entries = useQuery({
    queryKey: ['time_entries'],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').order('entry_date', { ascending: false });
      return (data || []) as any[];
    },
  });

  const clientsQ = useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name, current_product, status, dp');
      return (data || []) as any[];
    },
  });

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name, monthly_hours_per_client, max_simultaneous_clients');
      return (data || []) as any[];
    },
  });

  const projects = useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, client_name, type').is('archived_at', null);
      return (data || []) as any[];
    },
  });

  const tasks = useQuery({
    queryKey: ['tasks_list'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('id, name, assigned_to, original_assignee, project_id, department, estimated_minutes, deadline, status, priority, notes, created_at, updated_at');
      return (data || []) as any[];
    },
  });

  const capacityScenarios = useQuery({
    queryKey: ['capacity_scenarios'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenarios').select('*').order('created_at', { ascending: false }).limit(1);
      return (data || []) as any[];
    },
  });

  const capacityProducts = useQuery({
    queryKey: ['capacity_scenario_products'],
    queryFn: async () => {
      const { data } = await supabase.from('capacity_scenario_products').select('*');
      return (data || []) as any[];
    },
  });

  // Fetch meetings with duration and participants
  const meetingsQ = useQuery({
    queryKey: ['meetings-for-productivity'],
    queryFn: async () => {
      const { data } = await supabase.from('meetings').select('id, title, date_time, duration_minutes, planned_duration_minutes, actual_duration_minutes, client_id, project_id, status');
      return (data || []) as any[];
    },
  });

  const participantsQ = useQuery({
    queryKey: ['meeting-participants-for-productivity'],
    queryFn: async () => {
      const { data } = await supabase.from('meeting_participants').select('meeting_id, profile_id');
      return (data || []) as any[];
    },
  });

  const m = members.data || [];
  const rawEntries = entries.data || [];
  const c = clientsQ.data || [];
  const p = productsQ.data || [];
  const pr = projects.data || [];
  const t = tasks.data || [];
  const sc = capacityScenarios.data?.[0] || null;
  const sp = capacityProducts.data || [];
  const meetings = meetingsQ.data || [];
  const participants = participantsQ.data || [];

  // Merge meetings into virtual time entries
  const e = useMemo(() => {
    // Build profile_id → team_member.id map
    const profileToMember: Record<string, string> = {};
    m.forEach((member: any) => {
      if (member.profile_id) profileToMember[member.profile_id] = member.id;
    });

    // Create virtual entries from meetings with duration
    const meetingEntries: any[] = [];
    meetings.forEach((meeting: any) => {
      const minutes = meeting.actual_duration_minutes ?? meeting.planned_duration_minutes ?? meeting.duration_minutes;
      if (!minutes || minutes <= 0) return;
      if (meeting.status === 'por_confirmar') return; // only count confirmed/completed meetings

      const durationHours = Number((minutes / 60).toFixed(2));
      const entryDate = format(new Date(meeting.date_time), 'yyyy-MM-dd');

      // Get participants for this meeting
      const meetingParticipants = participants.filter((p: any) => p.meeting_id === meeting.id);

      meetingParticipants.forEach((participant: any) => {
        const memberId = profileToMember[participant.profile_id];
        if (!memberId) return;

        meetingEntries.push({
          id: `meeting-${meeting.id}-${participant.profile_id}`,
          entry_date: entryDate,
          member_id: memberId,
          duration: durationHours,
          category: 'reuniao',
          client_id: meeting.client_id || null,
          project_id: meeting.project_id || null,
          task_id: null,
          description: `Reunião: ${meeting.title}`,
          _isMeeting: true,
        });
      });
    });

    return [...rawEntries, ...meetingEntries];
  }, [rawEntries, meetings, participants, m]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Produtividade & Capacidade" subtitle="Tempo, ocupação, capacidade e simulações de crescimento" />

        <div className="flex flex-wrap gap-2">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActive(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium border transition-all",
                active === tab.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {active === 'overview' && <OverviewTab entries={e} members={m} tasks={t} />}
        {active === 'time' && <TimeTab entries={e} members={m} clients={c} projects={pr} tasks={t} scenario={sc} scenarioProducts={sp} />}
        {active === 'capacity' && <CapacityTab members={m} entries={e} clients={c} products={p} scenario={sc} scenarioProducts={sp} />}
        {active === 'overload' && <OverloadTab entries={e} members={m} tasks={t} />}
      </div>
    </AppLayout>
  );
}
