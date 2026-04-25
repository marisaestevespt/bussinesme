import { useState, useMemo } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePlanningData } from '@/hooks/usePlanningData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { WeeklyAlignDetailSheet, type DetailField } from '@/components/executive/WeeklyAlignDetailSheet';
import { WeeklyKpiCards, CapacityFinancialCards } from '@/components/executive/WeeklyAlignKpis';
import { WeeklyStrategicMetrics } from '@/components/executive/WeeklyStrategicMetrics';
import { MetasSection, AgendaSection, VendasSection, LeadsSection, ClientesSection, NpsSection, ExpiringContractsSection, OperacaoSection, MarketingGoalsSection } from '@/components/executive/WeeklyAlignSections';
import { RoutinesSection } from '@/components/executive/WeeklyAlignRoutines';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useWeeklyAlignData } from '@/hooks/useWeeklyAlignData';

export default function ExecutiveWeeklyAlign() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const wa = useWeeklyAlignData(weekOffset);
  const planning = usePlanningData(wa.currentYear);

  // Detail sheet state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailSubtitle, setDetailSubtitle] = useState('');
  const [detailFields, setDetailFields] = useState<DetailField[]>([]);

  const openDetail = (title: string, subtitle: string, fields: DetailField[]) => {
    setDetailTitle(title);
    setDetailSubtitle(subtitle);
    setDetailFields(fields);
    setDetailOpen(true);
  };

  // Weekly notes
  const weeklyNotes = useQuery({
    queryKey: ['wa-notes', wa.weekStartStr],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('weekly_align_notes').select('*').eq('week_start', wa.weekStartStr).maybeSingle();
      return data;
    },
  });

  const [notesForm, setNotesForm] = useState({ decisions: '', blockers: '', key_points: '' });
  const notesLoaded = useMemo(() => {
    if (weeklyNotes.data) {
      return { decisions: weeklyNotes.data.decisions || '', blockers: weeklyNotes.data.blockers || '', key_points: weeklyNotes.data.key_points || '' };
    }
    return { decisions: '', blockers: '', key_points: '' };
  }, [weeklyNotes.data]);

  useMemo(() => { setNotesForm(notesLoaded); }, [notesLoaded]);

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (weeklyNotes.data?.id) {
        const { error } = await supabase.from('weekly_align_notes').update(notesForm as any).eq('id', weeklyNotes.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('weekly_align_notes').insert({ ...notesForm, week_start: wa.weekStartStr } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-notes'] }); toast.success('Notas guardadas'); },
    onError: () => toast.error('Erro ao guardar notas'),
  });

  return (
    <AppLayout>
      <div className="space-y-8">
        <BackNavigation />
        <PageHeader title="Weekly Align" subtitle={`Semana ${format(wa.weekStart, 'dd/MM')} — ${format(wa.weekEnd, 'dd/MM/yyyy')}`} />

        {/* Week navigation */}
        <div className="flex items-center justify-center gap-4 -mt-4">
          <Button variant="outline" aria-label="Anterior" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(wa.weekStart, 'dd/MM')} — {format(wa.weekEnd, 'dd/MM/yyyy')}
          </span>
          <Button variant="outline" aria-label="Seguinte" size="icon" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!wa.isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-xs">
              Semana atual
            </Button>
          )}
        </div>
        {!wa.isCurrentWeek && (
          <p className="text-xs text-muted-foreground text-center -mt-2">Dados de semanas anteriores são apenas de leitura.</p>
        )}

        <WeeklyStrategicMetrics />

        <WeeklyKpiCards
          salesWeekTotal={wa.salesWeekTotal}
          prevSalesWeekTotal={wa.prevSalesWeekTotal}
          tasksWeekDone={wa.tasksWeekDone}
          tasksWeekCount={wa.tasksWeekCount}
          prevTasksWeekCount={wa.prevTasksWeekCount}
          leadsCount={(wa.leads || []).length}
          followUpsCount={wa.followUps.length}
          overdueNpsCount={(wa.npsOverdue || []).length}
          meetingsWeekCount={wa.meetingsWeekCount}
          prevMeetingsWeekCount={wa.prevMeetingsWeekCount}
        />

        <CapacityFinancialCards
          capacityAlert={wa.capacityAlert}
          totalBilled={wa.totalBilled}
          financialSummary={wa.financialSummary}
          currentMonth={wa.currentMonth}
        />

        <Separator />

        {/* Notas & Decisões */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Notas & Decisões</h2>
            <Button size="sm" variant="outline" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Guardar
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Decisões tomadas</label>
              <Textarea placeholder="Decisões desta semana..." value={notesForm.decisions} onChange={e => setNotesForm(p => ({ ...p, decisions: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bloqueios / Riscos</label>
              <Textarea placeholder="Bloqueios identificados..." value={notesForm.blockers} onChange={e => setNotesForm(p => ({ ...p, blockers: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Pontos-chave</label>
              <Textarea placeholder="Destaques da semana..." value={notesForm.key_points} onChange={e => setNotesForm(p => ({ ...p, key_points: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
          </div>
        </section>

        <Separator />
        <MetasSection planning={planning} currentMonth={wa.currentMonth} onOpenDetail={openDetail} />
        <Separator />
        <MarketingGoalsSection currentMonth={wa.currentMonth} />
        <Separator />
        <AgendaSection events={wa.events} onOpenDetail={openDetail} />
        <Separator />
        <VendasSection
          salesWeek={wa.salesWeek}
          salesActions={wa.salesActions}
          salesWeekTotal={wa.salesWeekTotal}
          prevSalesWeekTotal={wa.prevSalesWeekTotal}
          totalBilled={wa.totalBilled}
          billingGoal={wa.billingGoal}
          currentMonth={wa.currentMonth}
          onOpenDetail={openDetail}
        />
        <Separator />
        <LeadsSection leads={wa.leads} followUps={wa.followUps} onOpenDetail={openDetail} />
        <Separator />
        <ClientesSection onboardingClients={wa.onboardingClients} renewalClients={wa.renewalClients} />
        <Separator />
        <NpsSection
          npsWeek={wa.npsWeek}
          npsOverdue={wa.npsOverdue}
          milestonesWeek={wa.milestonesWeek}
          getMemberName={wa.getMemberName}
          onOpenDetail={openDetail}
        />
        <Separator />
        <ExpiringContractsSection expiringContractsList={wa.expiringContractsList} />
        {wa.expiringContractsList.length > 0 && <Separator />}
        <Separator />
        <RoutinesSection
          thisWeekRoutines={wa.routineTasksWeek}
          prevWeekRoutines={wa.routineTasksPrevWeek}
        />
        <Separator />
        <OperacaoSection
          projects={wa.projects}
          tasks={wa.tasks}
          meetings={wa.meetings}
          contents={wa.contents}
          tasksWeekDone={wa.tasksWeekDone}
          tasksWeekCount={wa.tasksWeekCount}
          meetingsWeekCount={wa.meetingsWeekCount}
          contentWeekCount={wa.contentWeekCount}
          onOpenDetail={openDetail}
        />
      </div>

      <WeeklyAlignDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailTitle}
        subtitle={detailSubtitle}
        fields={detailFields}
      />
    </AppLayout>
  );
}
