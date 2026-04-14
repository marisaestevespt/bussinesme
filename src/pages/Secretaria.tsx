import { useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { BackNavigation } from '@/components/BackNavigation';
import { getDeptLabel } from '@/lib/departments';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RecommendationWidget } from '@/components/RecommendationWidget';
import { MemberDigestSettings } from '@/components/settings/MemberDigestSettings';
import { AiInsightsPanel } from '@/components/AiInsightsPanel';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  CheckSquare, AlertTriangle, Users, FolderKanban,
  CalendarIcon, FileText, BarChart3, ListTodo, ArrowLeft, Building2, Mail,
} from 'lucide-react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useMyProfile, useMyTeamMember, useMyTasks, useMyProjects, useMyMeetings, useMyOnboarding, greetingText } from '@/components/secretaria/secretaria-shared';
import { DashboardPersonalWidgets } from '@/components/secretaria/SecretariaWidgets';
import { KpiSkeleton, CardListSkeleton } from '@/components/ui/loading-skeletons';

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
  const navigate = useNavigate();
  const profile = useMyProfile();
  const teamMember = useMyTeamMember();
  const tasks = useMyTasks();
  const projects = useMyProjects();
  const meetings = useMyMeetings();
  const onboarding = useMyOnboarding(teamMember.data?.id);
  const qc = useQueryClient();

  const firstName = profile.data?.full_name?.split(' ')[0] || 'Utilizador';

  // Absence conflict alerts (owner only)
  const absenceAlerts = useQuery({
    queryKey: ['absence-alerts'],
    enabled: isOwner,
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
          .neq('status', 'concluida')
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
  const todayTasks = useMemo(() => (tasks.data || []).filter(t => t.deadline && isToday(parseISO(t.deadline)) && t.status !== 'done'), [tasks.data]);
  const overdueTasks = useMemo(() => (tasks.data || []).filter(t => t.status !== 'done' && t.deadline && isBefore(parseISO(t.deadline), today)), [tasks.data]);
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
        <PageHeader title={`${greetingText()}, ${firstName}.`} subtitle={format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })} />

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { value: 'dia', label: 'O Meu Dia', icon: CalendarIcon, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
            { value: 'semana', label: 'A Minha Semana', icon: CalendarIcon, iconColor: 'text-indigo-600', color: 'from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/10' },
            { value: 'agenda', label: 'A Minha Agenda', icon: CalendarIcon, iconColor: 'text-teal-600', color: 'from-teal-500/10 to-teal-600/5 hover:from-teal-500/20 hover:to-teal-600/10' },
            { value: 'tarefas', label: 'As Minhas Tarefas', icon: CheckSquare, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
            { value: 'projetos', label: 'Os Meus Projetos', icon: FolderKanban, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
            { value: 'reunioes', label: 'As Minhas Reuniões', icon: Users, iconColor: 'text-rose-600', color: 'from-rose-500/10 to-rose-600/5 hover:from-rose-500/20 hover:to-rose-600/10' },
            { value: 'produtividade', label: 'Produtividade', icon: BarChart3, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
            { value: 'contrato', label: 'Contrato & Pagamentos', icon: FileText, iconColor: 'text-cyan-600', color: 'from-cyan-500/10 to-cyan-600/5 hover:from-cyan-500/20 hover:to-cyan-600/10' },
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

        {/* Department card */}
        {teamMember.data?.department && (
          <Card
            className="group cursor-pointer border bg-gradient-to-br from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            onClick={() => {
              const dept = teamMember.data!.department!;
              const deptPath = dept === 'recursos-humanos' ? '/hub/recursos-humanos'
                : dept === 'customer-success' ? '/hub/clientes'
                : `/hub/${dept}`;
              navigate(deptPath);
            }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm shrink-0 text-primary">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <span className="font-medium text-sm text-foreground">O Meu Departamento</span>
              <Badge variant="secondary" className="ml-auto text-xs">{getDeptLabel(teamMember.data.department)}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Dashboard view (no tab active) */}
        {!activeTab && (
          <>
            {/* AI Proactive Alerts */}
            <AiInsightsPanel
              type="alerts"
              title="Alertas Inteligentes"
              buttonLabel="Ver alertas AI"
              compact
            />
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
                      <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-md bg-background border hover:shadow-sm transition-shadow">
                        <Checkbox
                          checked={false}
                          onCheckedChange={async () => {
                            await supabase.from('member_onboarding').update({ completed: true }).eq('id', item.id);
                            qc.invalidateQueries({ queryKey: ['my-onboarding'] });
                            toast.success('Item concluído!');
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{item.task}</span>
                          {item.deadline_date && (
                            <span className={cn(
                              "text-[10px] ml-2",
                              isBefore(parseISO(item.deadline_date), today) ? "text-destructive" : "text-muted-foreground"
                            )}>
                              até {format(parseISO(item.deadline_date), 'd MMM', { locale: pt })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-primary/60"><CardContent className="pt-4"><p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Tarefas para hoje</p><p className="text-3xl font-bold mt-1">{todayTasks.length}</p></CardContent></Card>
              <Card className="border-l-4 border-l-destructive/60"><CardContent className="pt-4"><p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Tarefas em atraso</p><p className="text-3xl font-bold text-destructive mt-1">{overdueTasks.length}</p></CardContent></Card>
              <Card className="border-l-4 border-l-info/60"><CardContent className="pt-4"><p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Reuniões hoje</p><p className="text-3xl font-bold mt-1">{todayMeetings.length}</p></CardContent></Card>
              <Card className="border-l-4 border-l-success/60"><CardContent className="pt-4"><p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Projetos ativos</p><p className="text-3xl font-bold mt-1">{activeProjects.length}</p></CardContent></Card>
            </div>

            {/* Absence alerts for owner */}
            {isOwner && (absenceAlerts.data || []).length > 0 && (
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
                      onClick={() => navigate('/tarefas')}
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
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

            <Suspense fallback={null}>
              <SecretariaConteudos />
            </Suspense>

            <DashboardPersonalWidgets userId={user?.id} />

            {/* Bottom utility buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {[
                { value: 'recomendacoes', label: 'Caixa de Recomendações', icon: ListTodo, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
                { value: 'resumo_email', label: 'Resumo por Email', icon: Mail, iconColor: 'text-pink-600', color: 'from-pink-500/10 to-pink-600/5 hover:from-pink-500/20 hover:to-pink-600/10' },
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
          </>
        )}

        {/* Tab content with lazy loading */}
        {activeTab && (
          <>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setActiveTab(null)}>
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
