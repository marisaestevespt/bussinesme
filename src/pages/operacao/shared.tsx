import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, X } from 'lucide-react';
import { isToday, isBefore, isAfter, startOfToday, endOfWeek } from 'date-fns';
import { isTaskDone, isTaskOverdue } from '@/lib/taskStatus';

// ─── Types ──────────────────────────────────────────────────────

export type Project = {
  id: string; name: string; type: string; status: string; department: string | null;
  client_name: string | null; deadline: string | null; progress: number;
  start_date: string | null; created_at: string; cover_url: string | null;
};
export type Task = {
  id: string; name: string; status: string; priority: string; deadline: string | null;
  assigned_to: string | null; project_id: string | null; department: string | null;
};
export type Client = {
  id: string; client_id: string; full_name: string; status: string; current_product: string | null;
  start_date: string | null; end_of_cycle: string | null;
};
export type Profile = {
  id: string; full_name: string | null; avatar_url: string | null;
};
export type ProjectMember = {
  project_id: string; profile_id: string;
};

export const ACTIVE_STATUSES = ['em_curso', 'em_ideia', 'em_pausa', 'em_revisao'];
export type TaskFilter = 'todas' | 'hoje' | 'semana' | 'atrasadas';

export const DEPT_LABELS: Record<string, string> = {
  administrativo: 'Administrativo',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  clientes: 'Clientes',
  equipa: 'Equipa',
  operacao: 'Operação',
};
export const DEPT_COLORS: Record<string, string> = {
  administrativo: 'hsl(33, 30%, 55%)',
  marketing: 'hsl(330, 60%, 55%)',
  financeiro: 'hsl(45, 80%, 50%)',
  comercial: 'hsl(190, 70%, 45%)',
  clientes: 'hsl(265, 55%, 55%)',
  equipa: 'hsl(165, 55%, 45%)',
  operacao: 'hsl(25, 75%, 55%)',
};

export function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export type TaskFilters = {
  time: TaskFilter;
  department: string;
  responsible: string;
  priority: string;
  project: string;
};

export const EMPTY_FILTERS: TaskFilters = { time: 'todas', department: '', responsible: '', priority: '', project: '' };

export const PRIORITY_OPTIONS = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  por_comecar: { label: 'Por começar', color: 'bg-muted text-muted-foreground' },
  a_fazer: { label: 'A fazer', color: 'bg-info/15 text-info border-info/30' },
  aguarda_feedback: { label: 'Aguarda feedback cliente', color: 'bg-warning/15 text-warning border-warning/30' },
  para_aprovacao: { label: 'Para aprovação', color: 'bg-primary/15 text-primary border-primary/30' },
  precisa_alteracoes: { label: 'Precisa de alterações', color: 'bg-warning/20 text-warning border-warning/40' },
  done: { label: 'Feito', color: 'bg-success/15 text-success border-success/30' },
};

export function applyTaskFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let result = tasks;
  const today = startOfToday();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  switch (filters.time) {
    case 'hoje': result = result.filter(t => t.deadline && isToday(new Date(t.deadline))); break;
    case 'semana': result = result.filter(t => t.deadline && !isBefore(new Date(t.deadline), today) && !isAfter(new Date(t.deadline), weekEnd)); break;
    case 'atrasadas': result = result.filter(t => isTaskOverdue(t as unknown as { status: string; deadline: string | null }, today)); break;
  }
  if (filters.department) result = result.filter(t => t.department === filters.department);
  if (filters.responsible) result = result.filter(t => t.assigned_to === filters.responsible);
  if (filters.priority) result = result.filter(t => t.priority === filters.priority);
  if (filters.project) result = result.filter(t => t.project_id === filters.project);
  return result;
}

export function TaskDynamicFilters({ filters, onChange, profiles, projects }: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  profiles: Profile[];
  projects: { id: string; name: string }[];
}) {
  const activeCount = [filters.department, filters.responsible, filters.priority, filters.project].filter(Boolean).length
    + (filters.time !== 'todas' ? 1 : 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(['todas', 'hoje', 'semana', 'atrasadas'] as TaskFilter[]).map(k => (
        <Button key={k} size="sm" variant={filters.time === k ? 'default' : 'outline'} className="h-7 text-xs"
          onClick={() => onChange({ ...filters, time: k })}>
          {{ todas: 'Todas', hoje: 'Hoje', semana: 'Semana', atrasadas: 'Atrasadas' }[k]}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Filter className="h-3 w-3" /> Filtros
            {activeCount > 0 && <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">{activeCount}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Departamento</label>
            <Select value={filters.department} onValueChange={v => onChange({ ...filters, department: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {Object.entries(DEPT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Responsável</label>
            <Select value={filters.responsible} onValueChange={v => onChange({ ...filters, responsible: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {profiles.filter(p => p.full_name).map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select value={filters.priority} onValueChange={v => onChange({ ...filters, priority: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas</SelectItem>
                {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Projeto</label>
            <Select value={filters.project} onValueChange={v => onChange({ ...filters, project: v === '_all' ? '' : v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {activeCount > 0 && (
            <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => onChange(EMPTY_FILTERS)}>
              <X className="h-3 w-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function TaskBadge({ deadline, status }: { deadline: string | null; status: string }) {
  if (isTaskDone({ status })) return null;
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = startOfToday();
  if (isBefore(d, today)) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasada</Badge>;
  if (isToday(d)) return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Hoje</Badge>;
  return null;
}

export function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { alta: 'bg-destructive', media: 'bg-warning', baixa: 'bg-success' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[priority] || 'bg-muted'}`} />;
}