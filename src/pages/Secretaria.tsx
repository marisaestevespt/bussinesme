import { useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RecommendationWidget } from '@/components/RecommendationWidget';
import { MemberDigestSettings } from '@/components/settings/MemberDigestSettings';


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  CheckSquare, AlertTriangle, Users, FolderKanban,
  CalendarIcon, FileText, BarChart3, ListTodo, ArrowLeft, Mail,
} from 'lucide-react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMyProfile, useMyTeamMember, useMyTasks, useMyProjects, useMyMeetings, useMyOnboarding, greetingText } from '@/components/secretaria/secretaria-shared';
import { isTaskOpen, isTaskOverdue } from '@/lib/taskStatus';
import { DashboardPersonalWidgets } from '@/components/secretaria/SecretariaWidgets';
import { KpiSkeleton, CardListSkeleton } from '@/components/ui/loading-skeletons';
import { StatCard } from '@/components/editorial';
import { OnboardingItem } from '@/components/onboarding/OnboardingItem';

// ─── Lazy-loaded tab components ─────────────────────────────
const SecretariaDia = lazy(() => import('@/components/secretaria/SecretariaDia'));
const SecretariaSemana = lazy(() => import('@/components/secretaria/SecretariaSemana'));
const SecretariaAgenda = lazy(() => import('@/components/secretaria/SecretariaAgenda'));
const SecretariaTarefas = lazy(() => import('@/components/secretaria/SecretariaTarefas'));
const SecretariaProjetos = lazy(() => import('@/components/secretaria/SecretariaProjetos'));
const SecretariaReunioes = lazy(() => import('@/components/secretaria/SecretariaReunioes'));
const SecretariaProdutividade = lazy(() => import('@/components/secretaria/SecretariaProdutividade'));
const SecretariaContrato = lazy(() => import('@/components/secretaria/SecretariaContrato'));
const SecretariaConteudos = lazy(() => import('@/components/secretaria/SecretariaConteudos'));

const today = startOfDay(new Date());

function TabLoader() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <KpiSkeleton count={3} />
      <CardListSkeleton count={4} />
    </div>
  );
}

export default function SecretariaPage() {
  const { user, isOwner } = useAuth();
  const { impersonating } = useImpersonation();
  const effectiveIsOwner = isOwner && !impersonating;
  const navigate = useNavigate();
  const profile = useMyProfile();
  const teamMember = useMyTeamMember();
  const tasks = useMyTasks();
  const projects = useMyProjects();
  const meetings = useMyMeetings();
  const onboarding = useMyOnboarding(teamMember.data?.id);
  const qc = useQueryClient();

  // Fallback chain: impersonation > team member > profile > auth metadata > email local-part.
  // Nunca cair em "Utilizador" — preferir mostrar nada do que um nome genérico.
  const metaFullName = (user?.user_metadata as any)?.full_name as string | undefined;
  const emailLocal = user?.email ? user.email.split('@')[0] : '';
  const displayName =
    impersonating?.full_name ||
    teamMember.data?.full_name ||
    profile.data?.full_name ||
    metaFullName ||
    emailLocal ||
    '';
  const firstName = displayName.split(/[\s.]/)[0] || '';

  // Absence conflict alerts (owner only, hidden during impersonation)
  const absenceAlerts = useQuery({
    queryKey: ['absence-alerts'],
    enabled: effectiveIsOwner,
    queryFn: async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { data: absences } = await supabase
        .from('absence_coverage')
        .select('member_id, start_date, end_date')
        .gte('end_date', todayStr);
      if (!absences?.length) return [];

      const memberIds = [...new Set(absences.map(a => a.member_id))];
      const { data: members } = await supabase
        .from('team_members')
        .select('id, full_name, profile_id')
        .in('id', memberIds);
      if (!members?.length) return [];

      const alerts: { memberName: string; startDate: string; endDate: string; taskName: string; taskId: string }[] = [];

      for (const absence of absences) {
        const member = members.find(m => m.id === absence.member_id);
        if (!member?.profile_id) continue;

        const { data: absTasks } = await supabase
          .from('tasks')
          .select('id, name')
          .eq('assigned_to', member.profile_id)
          .neq('status', 'done')
          .gte('deadline', absence.start_date)
          .lte('deadline', absence.end_date);

        for (const task of absTasks || []) {
          alerts.push({
            memberName: member.full_name,
            startDate: absence.start_date,
            endDate: absence.end_date,
            taskName: task.name,
            taskId: task.id,
          });
        }
      }
      return alerts;
    },
  });

  // Dashboard summary counts (only computed when on dashboard)
  const todayTasks = useMemo(() => (tasks.data || []).filter(t => t.deadline && isToday(parseISO(t.deadline)) && isTaskOpen(t)), [tasks.data]);
  const overdueTasks = useMemo(() => (tasks.data || []).filter(t => isTaskOverdue(t, today)), [tasks.data]);
  const todayMeetings = useMemo(() => (meetings.data || []).filter(m => isToday(parseISO(m.date_time))), [meetings.data]);
  const activeProjects = useMemo(() => (projects.data || []).filter(p => p.status === 'em_curso'), [projects.data]);

  const [activeTab, setActiveTab] = useState<string | null>(null);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dia': return <SecretariaDia />;
      case 'semana': return <SecretariaSemana />;
      case 'agenda': return <SecretariaAgenda />;
      case 'tarefas': return <SecretariaTarefas />;
      case 'projetos': return <SecretariaProjetos />;
      case 'reunioes': return <SecretariaReunioes />;
      case 'produtividade': return <SecretariaProdutividade />;
      case 'contrato': return <SecretariaContrato />;
      case 'recomendacoes': return <RecommendationWidget memberName={firstName} />;
      case 'resumo_email': return <MemberDigestSettings />;
      default: return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation parentRoute="/hub-equipa" parentLabel="Hub de Equipa" />
        <PageHeader title={`${greetingText()}, ${firstName}.`} subtitle={format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })} department="secretaria" />

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { value: 'dia', label: 'O Meu Dia', icon: CalendarIcon, iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
            { value: 'semana', label: 'A Minha Semana', icon: CalendarIcon, iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
            { value: 'agenda', label: 'A Minha Agenda', icon: CalendarIcon, iconColor: 'text-success', color: 'from-success/10 to-success/5 hover:from-success/20 hover:to-success/10' },
            { value: 'tarefas', label: 'As Minhas Tarefas', icon: CheckSquare, iconColor: 'text-success', color: 'from-success/10 to-success/5 hover:from-success/20 hover:to-success/10' },
            { value: 'projetos', label: 'Os Meus Projetos', icon: FolderKanban, iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10' },
            { value: 'reunioes', label: 'As Minhas Reuniões', icon: Users, iconColor: 'text-destructive', color: 'from-destructive/10 to-destructive/5 hover:from-destructive/20 hover:to-destructive/10' },
            { value: 'produtividade', label: 'Produtividade', icon: BarChart3, iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10' },
            { value: 'contrato', label: 'Contrato & Pagamentos', icon: FileText, iconColor: 'text-info', color: 'from-info/10 to-info/5 hover:from-info/20 hover:to-info/10' },
          ].map(s => (
            <Card
              key={s.value}
              className={cn(
                'group cursor-pointer border bg-gradient-to-br transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5',
                s.color,
                activeTab === s.value && 'ring-2 ring-primary/50 shadow-md'
              )}
              onClick={() => setActiveTab(activeTab === s.value ? null : s.value)}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-xs sm:text-sm text-foreground leading-tight">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dashboard view (no tab active) */}
        {!activeTab && (
          <div className="space-y-6 pt-4 sm:pt-6">
            {/* Onboarding checklist */}
            {(onboarding.data || []).length > 0 && (() => {
              const items = onboarding.data || [];
              const doneCount = items.filter((i: any) => i.completed).length;
              const allDone = doneCount === items.length;
              if (allDone) return null;
              return (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-primary" /> O Teu Onboarding
                      <Badge variant="secondary" className="ml-auto text-xs">{doneCount} de {items.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={(doneCount / items.length) * 100} className="h-2" />
                    {items.filter((i: any) => !i.completed).map((item: any) => (
                      <OnboardingItem
                        key={item.id}
                        item={item}
                        onToggle={async (id, next) => {
                          await supabase.from('member_onboarding').update({ completed: next }).eq('id', id);
                          qc.invalidateQueries({ queryKey: ['my-onboarding'] });
                          if (next) toast.success('Item concluído!');
                        }}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
              <StatCard tone="primary" size="sm" value={todayTasks.length} label={<><CheckSquare className="h-3 w-3 inline mr-1.5 -mt-0.5" />tarefas para hoje</>} />
              <StatCard tone="destructive" size="sm" value={overdueTasks.length} label={<><AlertTriangle className="h-3 w-3 inline mr-1.5 -mt-0.5" />tarefas em atraso</>} />
              <StatCard tone="info" size="sm" value={todayMeetings.length} label={<><Users className="h-3 w-3 inline mr-1.5 -mt-0.5" />reuniões hoje</>} />
              <StatCard tone="success" size="sm" value={activeProjects.length} label={<><FolderKanban className="h-3 w-3 inline mr-1.5 -mt-0.5" />projetos ativos</>} />
            </div>

            {/* Absence alerts for owner */}
            {effectiveIsOwner && (absenceAlerts.data || []).length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Alertas de Ausência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(absenceAlerts.data || []).map((alert, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-background border cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate('/hub/tarefas')}
                    >
                      <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">
                        <strong>{alert.memberName}</strong> está ausente de{' '}
                        {format(parseISO(alert.startDate), 'dd/MM')} a {format(parseISO(alert.endDate), 'dd/MM')}.
                        A tarefa <strong>"{alert.taskName}"</strong> precisa de ser realocada.
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {effectiveIsOwner && (
              <Suspense fallback={null}>
                <SecretariaConteudos />
              </Suspense>
            )}

            <DashboardPersonalWidgets userId={impersonating?.user_id || user?.id} />

            {/* Bottom utility buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {[
                { value: 'recomendacoes', label: 'Caixa de Recomendações', icon: ListTodo, iconColor: 'text-warning', color: 'from-warning/10 to-warning/5 hover:from-warning/20 hover:to-warning/10' },
                { value: 'resumo_email', label: 'Resumo por Email', icon: Mail, iconColor: 'text-accent-violet', color: 'from-accent-violet/10 to-accent-violet/5 hover:from-accent-violet/20 hover:to-accent-violet/10' },
              ].map(s => (
                <Card
                  key={s.value}
                  className={cn(
                    'group cursor-pointer border bg-gradient-to-br transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
                    s.color
                  )}
                  onClick={() => setActiveTab(s.value)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 ${s.iconColor}`}>
                      <s.icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{s.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tab content with lazy loading */}
        {activeTab && (
          <>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setActiveTab(null)}>
              <ArrowLeft className="h-4 w-4" /> Voltar à Secretária
            </Button>
            <Suspense fallback={<TabLoader />}>
              {renderTabContent()}
            </Suspense>
          </>
        )}
      </div>
    </AppLayout>
  );
}
