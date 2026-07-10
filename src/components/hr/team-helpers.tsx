import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDept } from '@/lib/departments';

export const currentYear = new Date().getFullYear();
export const currentMonth = new Date().getMonth() + 1;

// Department → Badge variant mapping (uses statically-defined Tailwind classes via cva variants)
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'violet' | 'muted';
const DEPT_VARIANTS: Record<string, BadgeVariant> = {
  admin: 'warning',
  administrativo: 'warning',
  marketing: 'violet',
  comercial: 'warning',
  clientes: 'info',
  financeiro: 'success',
  operacao: 'violet',
  produtos: 'info',
  'customer-success': 'success',
  'recursos-humanos': 'destructive',
};

export function DeptBadge({ dept }: { dept: string | string[] | null | undefined }) {
  if (!dept) return null;
  const raw = Array.isArray(dept) ? dept : [dept];
  const depts = raw.filter((d): d is string => typeof d === 'string' && d.length > 0);
  if (depts.length === 0) return null;
  return (
    <>
      {depts.map(d => {
        const info = getDept(d);
        const variant = DEPT_VARIANTS[d] || 'muted';
        return <Badge key={d} variant={variant} className="text-[10px]">{info?.label || d}</Badge>;
      })}
    </>
  );
}

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function MemberSelect({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: any[] }) {
  return (
    <Select value={value || '_none'} onValueChange={v => onChange(v === '_none' ? '' : v)}>
      <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">Todos</SelectItem>
        {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

export const PERIODS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

export type DaySchedule = { manha?: string; tarde?: string };
export type ScheduleData = Record<string, DaySchedule>;

export function parseSchedule(raw: string | null): ScheduleData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const result: ScheduleData = {};
    for (const [day, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        const d: DaySchedule = {};
        if ((val as string[]).includes('manha')) d.manha = '09:00-13:00';
        if ((val as string[]).includes('tarde')) d.tarde = '14:00-18:00';
        result[day] = d;
      } else {
        result[day] = val as DaySchedule;
      }
    }
    return result;
  } catch { return {}; }
}

export function formatSchedule(schedule: ScheduleData): string {
  return JSON.stringify(schedule);
}

export function scheduleToLines(raw: string | null): string[] {
  const s = parseSchedule(raw);
  return WEEK_DAYS
    .filter(d => s[d.key] && (s[d.key].manha || s[d.key].tarde))
    .map(d => {
      const ds = s[d.key];
      const parts: string[] = [];
      if (ds.manha) parts.push(ds.manha);
      if (ds.tarde) parts.push(ds.tarde);
      return `${d.label} ${parts.join(' / ')}`;
    });
}

export const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

export const CONTRACT_DURATIONS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: 'unica', label: 'Vez única' },
  { value: 'indefinido', label: 'Indefinido' },
];

export const PRESET_ROLES = [
  { label: 'Owner', color: '#6366f1' },
  { label: 'Designer', color: '#ec4899' },
  { label: 'Copywriter', color: '#f59e0b' },
  { label: 'Gestora de Projetos', color: '#3b82f6' },
  { label: 'Gestora de Redes', color: '#14b8a6' },
  { label: 'Estratega', color: '#10b981' },
  { label: 'Marketer', color: '#8b5cf6' },
  { label: 'Comercial', color: '#10b981' },
  { label: 'Customer Success', color: '#14b8a6' },
  { label: 'Contabilista', color: '#64748b' },
  { label: 'Recursos Humanos', color: '#64748b' },
  { label: 'Advogada', color: '#ef4444' },
  { label: 'Assistente', color: '#f97316' },
  { label: 'Estagiário/a', color: '#06b6d4' },
];

export const ROLE_COLORS = [
  { value: '#6366f1', label: 'Roxo' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#10b981', label: 'Verde' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#8b5cf6', label: 'Violeta' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#64748b', label: 'Cinza' },
];

export function getPortugueseHolidays(year: number): Date[] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addDaysLocal = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  return [
    new Date(year, 0, 1),
    addDaysLocal(easter, -2),
    easter,
    new Date(year, 3, 25),
    new Date(year, 4, 1),
    addDaysLocal(easter, 60),
    new Date(year, 5, 10),
    new Date(year, 7, 15),
    new Date(year, 9, 5),
    new Date(year, 10, 1),
    new Date(year, 11, 1),
    new Date(year, 11, 8),
    new Date(year, 11, 25),
  ];
}

export const DAY_KEY_MAP: Record<number, string> = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab', 0: 'dom' };
