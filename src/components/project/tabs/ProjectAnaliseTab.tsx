import { Progress } from '@/components/ui/progress';
import { EntitySection } from '@/components/layout/entity';
import { BarChart3 } from 'lucide-react';

function formatMinutes(min: number | null | undefined): string {
  const value = Math.max(0, Math.round(Number(min || 0)));
  if (value < 60) return `${value}m`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function safePct(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export interface ProjectAnalysis {
  totalMinutes: number;
  budgetMinutes: number;
  estimatedTaskMinutes: number;
  doneTasks: number;
  totalTasks: number;
  completedDeliverables: number;
  totalDeliverables: number;
  people: { id: string; name: string; minutes: number }[];
  currentMonthMinutes: number;
  monthlyBudget: number;
}

interface Props {
  projectAnalysis: ProjectAnalysis;
  isServicoMensal: boolean;
}

export function ProjectAnaliseTab({ projectAnalysis, isServicoMensal }: Props) {
  return (
    <EntitySection
      title="Saúde do Projeto"
      icon={BarChart3}
      description={isServicoMensal ? 'Contratado vs. consumido no mês corrente e total produtivo.' : 'Previsto vs. realizado, execução e distribuição de esforço.'}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: isServicoMensal ? 'Horas contratadas/mês' : 'Tempo previsto', value: projectAnalysis.budgetMinutes > 0 ? formatMinutes(projectAnalysis.budgetMinutes) : '—', sub: projectAnalysis.estimatedTaskMinutes > 0 ? `${formatMinutes(projectAnalysis.estimatedTaskMinutes)} estimadas em tarefas` : 'Sem estimativa detalhada' },
          { label: 'Tempo produtivo total', value: projectAnalysis.totalMinutes > 0 ? formatMinutes(projectAnalysis.totalMinutes) : '—', sub: projectAnalysis.totalMinutes > 0 ? `${safePct(projectAnalysis.totalMinutes, projectAnalysis.budgetMinutes)}% do previsto` : 'Sem tempo registado' },
          { label: 'Tarefas feitas', value: `${projectAnalysis.doneTasks}/${projectAnalysis.totalTasks}`, sub: `${safePct(projectAnalysis.doneTasks, projectAnalysis.totalTasks)}% concluído` },
          { label: 'Entregas concluídas', value: `${projectAnalysis.completedDeliverables}/${projectAnalysis.totalDeliverables}`, sub: `${safePct(projectAnalysis.completedDeliverables, projectAnalysis.totalDeliverables)}% concluído` },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Consumo do orçamento</span>
              <span className="text-muted-foreground tabular-nums">{projectAnalysis.totalMinutes > 0 ? formatMinutes(projectAnalysis.totalMinutes) : '0m'}{projectAnalysis.budgetMinutes > 0 ? ` / ${formatMinutes(projectAnalysis.budgetMinutes)}` : ''}</span>
            </div>
            <Progress value={safePct(projectAnalysis.totalMinutes, projectAnalysis.budgetMinutes)} className="h-2" />
          </div>
          {isServicoMensal && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Mês corrente</span>
                <span className="text-muted-foreground tabular-nums">{formatMinutes(projectAnalysis.currentMonthMinutes)}{projectAnalysis.monthlyBudget > 0 ? ` / ${formatMinutes(projectAnalysis.monthlyBudget)}` : ''}</span>
              </div>
              <Progress value={safePct(projectAnalysis.currentMonthMinutes, projectAnalysis.monthlyBudget)} className="h-2" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
            <h3 className="text-sm font-semibold">Tempo por pessoa</h3>
          </div>
          {projectAnalysis.people.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sem tempo registado.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {projectAnalysis.people.map(person => (
                <div key={person.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{person.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatMinutes(person.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </EntitySection>
  );
}