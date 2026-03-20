import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Star, Users, BarChart3, MessageSquare, FileText, LayoutDashboard, AlertTriangle, Clock, CreditCard, Upload, ExternalLink, CheckSquare, ListTodo, CalendarIcon, Palmtree, CalendarDays } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format, parseISO } from 'date-fns';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useTeamData, MEMBER_STATUSES, MEMBER_TYPES, CONTRACT_TYPES, CONTRACT_STATUSES,
  PAYMENT_TYPES, PAYMENT_STATUSES, FEEDBACK_TYPES, PERFORMANCE_STATUSES, labelFor,
} from '@/hooks/useTeamData';
import { getMonthName } from '@/hooks/useExecutiveData';
import { DEPARTMENTS, getDept } from '@/lib/departments';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// Module keys that belong to each department
const ALL_DEPT_MODULES = ['marketing', 'comercial', 'clientes', 'financeiro', 'operacao', 'produtos', 'recursos-humanos', 'equipa', 'planeamento', 'weekly-align', 'gestao-equipa-ceo'];

const DEPT_MODULE_MAP: Record<string, string[]> = {
  admin: ALL_DEPT_MODULES,
  marketing: ['marketing'],
  comercial: ['comercial'],
  clientes: ['clientes'],
  financeiro: ['financeiro'],
  operacao: ['operacao'],
  produtos: ['produtos'],
  'recursos-humanos': ['recursos-humanos'],
};

// Modules everyone with a department gets access to
const HALL_MODULES = ['comeca-aqui', 'mural', 'hub-equipa'];
const TRANSVERSAL_MODULES = ['agenda', 'reunioes', 'acessos', 'projetos', 'processos', 'tarefas', 'biblioteca'];
const SECRETARIA_MODULES = ['secretaria'];

function cleanPayload(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  const STRIP_KEYS = ['created_at', 'updated_at'];
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_KEYS.includes(k)) continue;
    cleaned[k] = v === '' ? null : v;
  }
  return cleaned;
}

async function autoAssignPermissions(memberId: string, department: string | null) {
  if (!department) return;

  // Get or create a role for this department
  const roleName = `dept_${department}`;
  let { data: role } = await supabase.from('custom_roles').select('id').eq('name', roleName).maybeSingle();
  
  if (!role) {
    const { data: newRole, error } = await supabase.from('custom_roles').insert({ name: roleName, description: `Auto-generated role for ${department}` }).select('id').single();
    if (error || !newRole) return;
    role = newRole;

    // Create permissions for this role
    const moduleKeys = [
      ...HALL_MODULES,
      ...TRANSVERSAL_MODULES,
      ...SECRETARIA_MODULES,
      ...(DEPT_MODULE_MAP[department] || []),
    ];
    const perms = moduleKeys.map(mk => ({ custom_role_id: role!.id, module_key: mk, can_view: true }));
    await supabase.from('role_permissions').insert(perms);
  }

  // Check if team_member has a profile_id (linked user)
  const { data: tm } = await supabase.from('team_members').select('profile_id').eq('id', memberId).maybeSingle();
  if (!tm?.profile_id) return;

  // Get the user_id from profile
  const { data: profile } = await supabase.from('profiles').select('user_id').eq('id', tm.profile_id).maybeSingle();
  if (!profile?.user_id) return;

  // Upsert into members table
  const { data: existingMember } = await supabase.from('members').select('id').eq('user_id', profile.user_id).maybeSingle();
  if (existingMember) {
    await supabase.from('members').update({ custom_role_id: role.id }).eq('id', existingMember.id);
  } else {
    await supabase.from('members').insert({ user_id: profile.user_id, custom_role_id: role.id });
  }
}

// Department color mapping for badges (consistent across app)
const DEPT_COLORS: Record<string, string> = {
  administrativo: 'bg-slate-600 text-white',
  marketing: 'bg-pink-600 text-white',
  comercial: 'bg-amber-600 text-white',
  clientes: 'bg-cyan-600 text-white',
  financeiro: 'bg-emerald-600 text-white',
  operacao: 'bg-violet-600 text-white',
  produtos: 'bg-indigo-600 text-white',
  'customer-success': 'bg-teal-600 text-white',
  'recursos-humanos': 'bg-rose-600 text-white',
};

function DeptBadge({ dept }: { dept: string | null }) {
  if (!dept) return null;
  const d = getDept(dept);
  const colorClass = DEPT_COLORS[dept] || 'bg-muted text-muted-foreground';
  return <Badge className={`${colorClass} text-[10px] border-0`}>{d?.label || dept}</Badge>;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Helper: Member Select ──────
function MemberSelect({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: any[] }) {
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

const CONTRACT_DURATIONS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
  { value: '24', label: '24 meses' },
  { value: 'unica', label: 'Vez única' },
  { value: 'indefinido', label: 'Indefinido' },
];

const ROLE_COLORS = [
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

const PRESET_ROLES = [
  { label: 'Owner', color: '#6366f1' },
  { label: 'Designer', color: '#ec4899' },
  { label: 'Copywriter', color: '#f59e0b' },
  { label: 'Gestora', color: '#3b82f6' },
  { label: 'Gestora de Redes', color: '#14b8a6' },
  { label: 'Analista', color: '#8b5cf6' },
  { label: 'Estratega', color: '#10b981' },
  { label: 'Contabilista', color: '#64748b' },
  { label: 'Advogada', color: '#ef4444' },
  { label: 'Assistente Virtual', color: '#f97316' },
  { label: 'Administrativa', color: '#3b82f6' },
];

const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

const PERIODS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
];

type DaySchedule = { manha?: string; tarde?: string };
type ScheduleData = Record<string, DaySchedule>;

function parseSchedule(raw: string | null): ScheduleData {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Migrate old format (arrays) to new format (objects with times)
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

function formatSchedule(schedule: ScheduleData): string {
  return JSON.stringify(schedule);
}

function scheduleToDisplay(raw: string | null): string {
  const s = parseSchedule(raw);
  return WEEK_DAYS
    .filter(d => s[d.key] && (s[d.key].manha || s[d.key].tarde))
    .map(d => {
      const ds = s[d.key];
      const parts: string[] = [];
      if (ds.manha) parts.push(ds.manha);
      if (ds.tarde) parts.push(ds.tarde);
      return `${d.label} ${parts.join(' / ')}`;
    })
    .join(' · ') || '';
}

function scheduleToLines(raw: string | null): string[] {
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

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00',
];

function ScheduleSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const schedule = parseSchedule(value);

  const togglePeriod = (day: string, period: 'manha' | 'tarde') => {
    const current = { ...schedule };
    if (!current[day]) current[day] = {};
    if (current[day][period]) {
      delete current[day][period];
      if (!current[day].manha && !current[day].tarde) delete current[day];
    } else {
      current[day][period] = period === 'manha' ? '09:00-13:00' : '14:00-18:00';
    }
    onChange(formatSchedule(current));
  };

  const setTime = (day: string, period: 'manha' | 'tarde', pos: 'start' | 'end', time: string) => {
    const current = { ...schedule };
    if (!current[day]) current[day] = {};
    const existing = current[day][period] || (period === 'manha' ? '09:00-13:00' : '14:00-18:00');
    const [start, end] = existing.split('-');
    current[day][period] = pos === 'start' ? `${time}-${end}` : `${start}-${time}`;
    onChange(formatSchedule(current));
  };

  return (
    <div className="col-span-2 space-y-2">
      <span className="text-xs text-muted-foreground font-medium">Horário de trabalho</span>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-1.5 text-left font-medium text-muted-foreground">Dia</th>
              <th className="p-1.5 text-center font-medium text-muted-foreground">Manhã</th>
              <th className="p-1.5 text-center font-medium text-muted-foreground">Tarde</th>
            </tr>
          </thead>
          <tbody>
            {WEEK_DAYS.map(d => {
              const ds = schedule[d.key] || {};
              return (
                <tr key={d.key} className="border-t border-muted/30">
                  <td className="p-1.5 font-medium">{d.label}</td>
                  {PERIODS.map(p => {
                    const periodKey = p.key as 'manha' | 'tarde';
                    const active = !!ds[periodKey];
                    const [start, end] = active ? (ds[periodKey] || '').split('-') : ['', ''];
                    return (
                      <td key={p.key} className="p-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => togglePeriod(d.key, periodKey)}
                            className={`h-5 w-5 rounded shrink-0 flex items-center justify-center text-[9px] font-bold transition-colors ${
                              active ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {active ? '✓' : ''}
                          </button>
                          {active && (
                            <div className="flex items-center gap-0.5 text-[10px]">
                              <select
                                value={start}
                                onChange={e => setTime(d.key, periodKey, 'start', e.target.value)}
                                className="bg-transparent border border-muted rounded px-0.5 py-0 text-[10px] w-[52px]"
                              >
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span className="text-muted-foreground">-</span>
                              <select
                                value={end}
                                onChange={e => setTime(d.key, periodKey, 'end', e.target.value)}
                                className="bg-transparent border border-muted rounded px-0.5 py-0 text-[10px] w-[52px]"
                              >
                                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const DEFAULT_MEMBER_FORM = {
  full_name: '',
  role_title: '',
  role_color: '#6366f1',
  photo_url: '',
  email: '',
  whatsapp: '',
  work_schedule: '',
  identification: '',
  status: 'ativo',
  member_type: 'colaborador_fixo',
  department: '',
  start_date: '',
  presentation: '',
  responsibilities: '',
  works_holidays: false,
  custom_holidays: [] as string[],
};

// ─── Member Form Dialog ──────
function MemberDialog({ open, onClose, initial, onSave }: any) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState({ ...DEFAULT_MEMBER_FORM, ...(initial || {}) });
  const [uploading, setUploading] = useState(false);
  const [contract, setContract] = useState({
    contract_type: 'contrato_trabalho',
    duration: '12',
    monthly_value: '',
    contracted_hours: '',
    payment_day: '1',
    start_date: '',
    end_date: '',
    status: 'ativo',
  });

  useEffect(() => {
    setF({ ...DEFAULT_MEMBER_FORM, ...(initial || {}) });
  }, [initial]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setC = (k: string, v: any) => setContract((p: any) => ({ ...p, [k]: v }));

  const calcEndDate = (start: string, dur: string) => {
    if (!start || dur === 'indefinido' || dur === 'unica') return '';
    const d = new Date(start);
    d.setMonth(d.getMonth() + parseInt(dur));
    return d.toISOString().split('T')[0];
  };

  const handleStartDateChange = (v: string) => {
    setC('start_date', v);
    set('start_date', v);
    setC('end_date', calcEndDate(v, contract.duration));
  };

  const handleDurationChange = (v: string) => {
    setC('duration', v);
    setC('end_date', calcEndDate(contract.start_date, v));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Membro' : 'Novo Membro'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Foto + Nome */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={f.photo_url || undefined} />
                <AvatarFallback className="text-lg">{f.full_name ? f.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?'}</AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Upload className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const ext = file.name.split('.').pop();
                    const path = `team/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from('personal-images').upload(path, file);
                    if (error) { toast.error('Erro ao carregar foto'); setUploading(false); return; }
                    const { data: urlData } = supabase.storage.from('personal-images').getPublicUrl(path);
                    set('photo_url', urlData.publicUrl);
                    setUploading(false);
                  }}
                />
              </label>
              {uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><span className="text-[10px] text-white">...</span></div>}
            </div>
            <div className="flex-1">
              <Input placeholder="Nome completo *" value={f.full_name} onChange={e => set('full_name', e.target.value)} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={f.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MEMBER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Função + Departamento + Tipo */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground font-medium">Função</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ROLES.map(r => {
                const isSelected = f.role_title === r.label;
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => { set('role_title', isSelected ? '' : r.label); set('role_color', r.color); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isSelected ? 'text-white border-transparent ring-2 ring-offset-1 ring-foreground/20' : 'text-foreground/70 border-border hover:border-foreground/30'}`}
                    style={isSelected ? { backgroundColor: r.color } : {}}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {/* Custom role input */}
            {!PRESET_ROLES.some(r => r.label === f.role_title) && f.role_title ? (
              <div className="flex gap-2 items-center mt-2">
                <Input className="flex-1 h-8 text-xs" value={f.role_title} onChange={e => set('role_title', e.target.value)} />
                <div className="flex gap-1">
                  {ROLE_COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => set('role_color', c.value)}
                      className={`h-5 w-5 rounded-full border-2 transition-all shrink-0 ${f.role_color === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
                <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { set('role_title', ''); set('role_color', '#6366f1'); }}>Limpar</button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                onClick={() => { set('role_title', 'Nova função'); set('role_color', '#6366f1'); }}
              >
                <Plus className="h-3 w-3" /> Adicionar outra função
              </button>
            )}
            {f.role_title && (
              <Badge className="text-xs text-white mt-1" style={{ backgroundColor: f.role_color || '#6366f1' }}>{f.role_title}</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Departamento</label>
              <Select value={f.department || '_none'} onValueChange={v => set('department', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem departamento</SelectItem>
                  {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={f.member_type} onValueChange={v => set('member_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador_fixo">Equipa Interna</SelectItem>
                  <SelectItem value="prestador_servicos">Freelancer</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email + Telefone + NIF */}
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Email" value={f.email || ''} onChange={e => set('email', e.target.value)} />
            <Input placeholder="Telefone" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
            <Input placeholder="NIF / Identificação" value={f.identification || ''} onChange={e => set('identification', e.target.value)} />
          </div>

          {/* Responsabilidades */}
          <Textarea placeholder="Responsabilidades" value={f.responsibilities || ''} onChange={e => set('responsibilities', e.target.value)} rows={2} />

          <Separator />

          {/* Horário de trabalho + Feriados */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horário</h3>
          <ScheduleSelector value={f.work_schedule || ''} onChange={v => set('work_schedule', v)} />
          <div className="flex items-center justify-between">
            <label className="text-sm">Trabalha em feriados?</label>
            <Switch checked={!!f.works_holidays} onCheckedChange={v => set('works_holidays', v)} />
          </div>

          <Separator />

          {/* Férias */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Férias</h3>
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Início</label>
                <Input type="date" id="vacation-start-input" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Fim</label>
                <Input type="date" id="vacation-end-input" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => {
              const startInput = document.getElementById('vacation-start-input') as HTMLInputElement;
              const endInput = document.getElementById('vacation-end-input') as HTMLInputElement;
              if (!startInput?.value || !endInput?.value) { toast.error('Selecione início e fim'); return; }
              if (endInput.value < startInput.value) { toast.error('Data fim deve ser após início'); return; }
              const entry = `${startInput.value}|${endInput.value}`;
              const current: string[] = Array.isArray(f.custom_holidays) ? f.custom_holidays : [];
              if (!current.includes(entry)) {
                set('custom_holidays', [...current, entry]);
              }
              startInput.value = '';
              endInput.value = '';
            }}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar período
            </Button>
            {Array.isArray(f.custom_holidays) && f.custom_holidays.length > 0 && (
              <div className="space-y-1 mt-1">
                {f.custom_holidays.map((d: string, idx: number) => {
                  const parts = d.split('|');
                  const label = parts.length === 2
                    ? `${(() => { try { return format(parseISO(parts[0]), 'dd/MM/yyyy'); } catch { return parts[0]; } })()} → ${(() => { try { return format(parseISO(parts[1]), 'dd/MM/yyyy'); } catch { return parts[1]; } })()}`
                    : (() => { try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; } })();
                  return (
                    <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-md px-2 py-1.5">
                      <span className="text-xs">{label}</span>
                      <button type="button" onClick={() => set('custom_holidays', f.custom_holidays.filter((_: string, i: number) => i !== idx))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contrato (só para novos membros) */}
          {!isEdit && (
            <>
              <Separator />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato & Pagamento</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo de contrato</label>
                  <Select value={contract.contract_type} onValueChange={v => setC('contract_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duração do contrato</label>
                  <Select value={contract.duration} onValueChange={handleDurationChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Valor mensal (€)</label>
                  <Input type="number" placeholder="0" value={contract.monthly_value} onChange={e => setC('monthly_value', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tempo contratado mensal (horas)</label>
                  <Input placeholder="Ex: 40h" value={contract.contracted_hours} onChange={e => setC('contracted_hours', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data de início</label>
                  <Input type="date" value={contract.start_date} onChange={e => handleStartDateChange(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de fim</label>
                  <Input type="date" value={contract.end_date} onChange={e => setC('end_date', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dia do mês de pagamento</label>
                  <Input type="number" min={1} max={31} placeholder="1" value={contract.payment_day} onChange={e => setC('payment_day', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status do contrato</label>
                <Select value={contract.status} onValueChange={v => setC('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Apresentação (oculto, mantido para Começa Aqui) */}
          <input type="hidden" value={f.presentation || ''} />

          <Button className="w-full" onClick={() => { onSave({ member: { ...initial, ...f }, contract: isEdit ? null : contract }); onClose(false); }} disabled={!f.full_name.trim()}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Member Detail Sheet (comprehensive) ──────
function MemberDetailSheet({ open, onClose, member, team }: any) {
  const [newTask, setNewTask] = useState('');
  const [detailTab, setDetailTab] = useState('info');
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacNotes, setVacNotes] = useState('');
  const qc = useQueryClient();

  // Fetch tasks assigned to this member's profile
  const memberTasks = useQuery({
    queryKey: ['member-tasks', member?.profile_id],
    enabled: !!member?.profile_id,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*').eq('assigned_to', member.profile_id).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Fetch time entries for this member
  const memberTime = useQuery({
    queryKey: ['member-time', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*').eq('member_id', member.id).order('entry_date', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Fetch feedback sessions for this member
  const memberFeedback = useQuery({
    queryKey: ['member-feedback', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('feedback_sessions').select('*').eq('member_id', member.id).order('session_date', { ascending: false });
      return data || [];
    },
  });

  // Fetch vacations for this member
  const memberVacations = useQuery({
    queryKey: ['member-vacations', member?.id],
    enabled: !!member?.id,
    queryFn: async () => {
      const { data } = await supabase.from('team_member_vacations').select('*').eq('member_id', member.id).order('start_date', { ascending: false });
      return data || [];
    },
  });

  const handleAddVacation = async () => {
    if (!vacStart || !vacEnd) { toast.error('Selecione as datas'); return; }
    if (vacEnd < vacStart) { toast.error('Data fim deve ser após início'); return; }
    const { error } = await supabase.from('team_member_vacations').insert({
      member_id: member.id,
      start_date: vacStart,
      end_date: vacEnd,
      notes: vacNotes || null,
    });
    if (error) toast.error('Erro ao guardar');
    else { toast.success('Férias adicionadas'); setVacStart(''); setVacEnd(''); setVacNotes(''); qc.invalidateQueries({ queryKey: ['member-vacations', member.id] }); qc.invalidateQueries({ queryKey: ['escala-vacations'] }); }
  };

  const handleDeleteVacation = async (id: string) => {
    await supabase.from('team_member_vacations').delete().eq('id', id);
    toast.success('Férias removidas');
    qc.invalidateQueries({ queryKey: ['member-vacations', member.id] });
    qc.invalidateQueries({ queryKey: ['escala-vacations'] });
  };

  const items = (team.onboarding.data || []).filter((i: any) => i.member_id === member.id);
  const contracts = (team.contracts.data || []).filter((c: any) => c.member_id === member.id);
  const payments = (team.payments.data || []).filter((p: any) => p.member_id === member.id);
  const totalHours = (memberTime.data || []).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const monthHours = (memberTime.data || []).filter((e: any) => e.entry_month === currentMonth && e.entry_year === currentYear).reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
  const pendingTasks = (memberTasks.data || []).filter((t: any) => t.status !== 'concluida').length;
  const feedbackSessions = memberFeedback.data || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={(member as any).photo_url || undefined} />
              <AvatarFallback className="text-lg">{member.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">{member.full_name}</DialogTitle>
              {member.role_title && <p className="text-sm text-muted-foreground mt-0.5">{member.role_title}</p>}
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {/* Header badges */}
          <div className="space-y-1.5">
            <div className="flex gap-2 flex-wrap">
              <Badge variant={member.status === 'ativo' ? 'default' : 'secondary'}>{labelFor(MEMBER_STATUSES, member.status)}</Badge>
              <Badge variant="outline">{labelFor(MEMBER_TYPES, member.member_type)}</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              {member.role_title && <Badge className="text-xs text-white" style={{ backgroundColor: (member as any).role_color || '#6366f1' }}>{member.role_title}</Badge>}
              <DeptBadge dept={member.department} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Horas (mês)</p>
              <p className="font-bold text-sm">{monthHours.toFixed(1)}h</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Horas (total)</p>
              <p className="font-bold text-sm">{totalHours.toFixed(1)}h</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Tarefas ativas</p>
              <p className="font-bold text-sm">{pendingTasks}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Sessões feedback</p>
              <p className="font-bold text-sm">{feedbackSessions.length}</p>
            </div>
          </div>

          {/* Tabs inside sheet */}
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="text-xs flex-1">Info</TabsTrigger>
              <TabsTrigger value="tarefas" className="text-xs flex-1">Tarefas</TabsTrigger>
              <TabsTrigger value="tempo" className="text-xs flex-1">Tempo</TabsTrigger>
              <TabsTrigger value="contrato" className="text-xs flex-1">Contrato</TabsTrigger>
              <TabsTrigger value="pagamentos" className="text-xs flex-1">Pagamentos</TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs flex-1">Feedback</TabsTrigger>
              <TabsTrigger value="ferias" className="text-xs flex-1">Férias</TabsTrigger>
              <TabsTrigger value="onboarding" className="text-xs flex-1">Onboarding</TabsTrigger>
            </TabsList>

            {/* Info tab */}
            <TabsContent value="info" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {member.email && <div><span className="text-muted-foreground text-xs">Email</span><p>{member.email}</p></div>}
                {member.whatsapp && <div><span className="text-muted-foreground text-xs">Telefone</span><p>{member.whatsapp}</p></div>}
                {member.work_schedule && <div><span className="text-muted-foreground text-xs">Horário</span><div className="mt-0.5 space-y-0.5">{scheduleToLines(member.work_schedule).map((line, i) => <p key={i} className="text-sm">{line}</p>)}</div></div>}
                {member.identification && <div><span className="text-muted-foreground text-xs">Identificação</span><p>{member.identification}</p></div>}
                {member.start_date && <div><span className="text-muted-foreground text-xs">Data de início</span><p>{member.start_date}</p></div>}
              </div>
              {member.presentation && <div><span className="text-xs text-muted-foreground">Apresentação</span><p className="text-sm mt-1">{member.presentation}</p></div>}
              {member.responsibilities && <div><span className="text-xs text-muted-foreground">Responsabilidades</span><p className="text-sm mt-1 whitespace-pre-wrap">{member.responsibilities}</p></div>}
            </TabsContent>

            {/* Tasks tab */}
            <TabsContent value="tarefas" className="space-y-2 mt-3">
              {!member.profile_id ? (
                <p className="text-xs text-muted-foreground">Este membro não está ligado a um perfil de utilizador.</p>
              ) : (memberTasks.data || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem tarefas atribuídas.</p>
              ) : (
                <div className="space-y-1">
                  {(memberTasks.data || []).map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border/50">
                      <CheckSquare className={`h-3.5 w-3.5 ${t.status === 'concluida' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm flex-1 ${t.status === 'concluida' ? 'line-through text-muted-foreground' : ''}`}>{t.name}</span>
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      {t.deadline && <span className="text-[10px] text-muted-foreground">{t.deadline}</span>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Time tab */}
            <TabsContent value="tempo" className="space-y-2 mt-3">
              {(memberTime.data || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem registos de tempo.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Data</TableHead><TableHead className="text-xs">Duração</TableHead><TableHead className="text-xs">Categoria</TableHead><TableHead className="text-xs">Descrição</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(memberTime.data || []).slice(0, 20).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{e.entry_date}</TableCell>
                        <TableCell className="text-xs">{Number(e.duration).toFixed(1)}h</TableCell>
                        <TableCell className="text-xs">{e.category || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{e.description || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Contract tab */}
            <TabsContent value="contrato" className="space-y-2 mt-3">
              {contracts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem contratos.</p>
              ) : contracts.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-3 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(CONTRACT_STATUSES, c.status)}</Badge>
                      <span className="text-xs text-muted-foreground">{labelFor(CONTRACT_TYPES, c.contract_type)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Início:</span> {c.start_date || '—'}</div>
                      <div><span className="text-muted-foreground">Fim:</span> {c.end_date || '—'}</div>
                      {c.monthly_value > 0 && <div><span className="text-muted-foreground">Valor mensal:</span> €{Number(c.monthly_value).toLocaleString()}</div>}
                      {c.contracted_hours && <div><span className="text-muted-foreground">Horas contratadas:</span> {c.contracted_hours}</div>}
                      {c.payment_day && <div><span className="text-muted-foreground">Dia de pagamento:</span> {c.payment_day}</div>}
                    </div>
                    {c.document_url && <a href={c.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Ver documento</a>}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Payments tab */}
            <TabsContent value="pagamentos" className="space-y-2 mt-3">
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem pagamentos.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Mês</TableHead><TableHead className="text-xs">Tipo</TableHead><TableHead className="text-xs">Bruto</TableHead><TableHead className="text-xs">Líquido</TableHead><TableHead className="text-xs">Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payments.map((p: any) => {
                      const isOverdue = p.status === 'por_pagar' && (p.year < currentYear || (p.year === currentYear && p.month < currentMonth));
                      return (
                        <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                          <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                          <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={p.status === 'pago' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">{isOverdue ? 'Em atraso' : labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Feedback tab */}
            <TabsContent value="feedback" className="space-y-2 mt-3">
              {feedbackSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem sessões de feedback.</p>
              ) : feedbackSessions.map((fb: any) => (
                <Card key={fb.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{fb.session_date}{fb.session_time ? ` às ${fb.session_time}` : ''}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, fb.feedback_type)}</Badge>
                    </div>
                    {fb.summary && <div><span className="text-xs text-muted-foreground">Resumo:</span><p className="text-xs mt-0.5">{fb.summary}</p></div>}
                    {fb.went_well && <div><span className="text-xs text-muted-foreground">Correu bem:</span><p className="text-xs mt-0.5">{fb.went_well}</p></div>}
                    {fb.to_improve && <div><span className="text-xs text-muted-foreground">A melhorar:</span><p className="text-xs mt-0.5">{fb.to_improve}</p></div>}
                    {fb.agreements && <div><span className="text-xs text-muted-foreground">Acordos:</span><p className="text-xs mt-0.5">{fb.agreements}</p></div>}
                    {fb.transcript_url && <a href={fb.transcript_url} target="_blank" rel="noopener" className="text-xs text-primary underline flex items-center gap-1"><FileText className="h-3 w-3" /> Ver transcrição</a>}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Onboarding tab */}
            <TabsContent value="onboarding" className="space-y-2 mt-3">
              <div className="space-y-1">
                {['Sobre o negócio', 'Valores da equipa', 'O que não fazemos', 'Comunicação', 'Hábitos importantes'].map(label => {
                  const item = items.find((i: any) => i.task === label);
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <Checkbox
                        checked={!!item?.completed}
                        onCheckedChange={v => {
                          if (item) team.toggleOnboardingItem.mutate({ id: item.id, completed: !!v });
                          else team.addOnboardingItem.mutate({ member_id: member.id, task: label });
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Novo item..." value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}} className="h-8 text-sm" />
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { if (newTask.trim()) { team.addOnboardingItem.mutate({ member_id: member.id, task: newTask.trim() }); setNewTask(''); }}}><Plus className="h-4 w-4" /></Button>
              </div>
              {items.filter((i: any) => !['Sobre o negócio', 'Valores da equipa', 'O que não fazemos', 'Comunicação', 'Hábitos importantes'].includes(i.task)).map((i: any) => (
                <div key={i.id} className="flex items-center gap-2 group">
                  <Checkbox checked={i.completed} onCheckedChange={v => team.toggleOnboardingItem.mutate({ id: i.id, completed: !!v })} />
                  <span className={`text-sm flex-1 ${i.completed ? 'line-through text-muted-foreground' : ''}`}>{i.task}</span>
                  <button onClick={() => team.deleteOnboardingItem.mutate(i.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
                </div>
              ))}
            </TabsContent>

            {/* Férias tab */}
            <TabsContent value="ferias" className="space-y-3 mt-3">
              {/* Business days taken this year */}
              {(() => {
                const yearStart = new Date(new Date().getFullYear(), 0, 1);
                const yearEnd = new Date(new Date().getFullYear(), 11, 31);
                const vacations = (memberVacations.data || []) as any[];
                let businessDays = 0;
                vacations.forEach((v: any) => {
                  try {
                    let s = parseISO(v.start_date);
                    let e = parseISO(v.end_date);
                    if (s < yearStart) s = yearStart;
                    if (e > yearEnd) e = yearEnd;
                    const current = new Date(s);
                    while (current <= e) {
                      const day = current.getDay();
                      if (day !== 0 && day !== 6) businessDays++;
                      current.setDate(current.getDate() + 1);
                    }
                  } catch {}
                });
                return (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{businessDays} dias úteis</span>
                    <span className="text-xs text-muted-foreground">de férias marcados em {new Date().getFullYear()}</span>
                  </div>
                );
              })()}

              {/* Holiday settings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Trabalha em feriados</span>
                  <Badge variant={member.works_holidays ? 'default' : 'secondary'} className="text-[10px]">{member.works_holidays ? 'Sim' : 'Não'}</Badge>
                </div>
                {Array.isArray(member.custom_holidays) && member.custom_holidays.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Feriados municipais</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {member.custom_holidays.map((d: string) => (
                        <Badge key={d} variant="outline" className="text-[10px]">
                          {(() => { try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; } })()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Existing vacations */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Períodos de férias</p>
                {(memberVacations.data || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem férias registadas.</p>
                ) : (memberVacations.data || []).map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <div>
                      <span className="text-sm">{format(parseISO(v.start_date), 'dd/MM/yyyy')} → {format(parseISO(v.end_date), 'dd/MM/yyyy')}</span>
                      {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteVacation(v.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Add new vacation */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Adicionar férias</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Início</label>
                    <Input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Fim</label>
                    <Input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)} />
                  </div>
                </div>
                <Input placeholder="Notas (opcional)" value={vacNotes} onChange={e => setVacNotes(e.target.value)} />
                <Button size="sm" onClick={handleAddVacation} className="w-full"><Plus className="h-4 w-4 mr-1" /> Adicionar Férias</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generic Form Dialog ──────
function RecordDialog({ open, onClose, title, fields, initial, onSave }: any) {
  const [f, setF] = useState(initial || {});
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((field: any) => {
            if (field.type === 'select') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Select value={f[field.key] || field.options[0]?.value || ''} onValueChange={v => set(field.key, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{field.options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.type === 'textarea') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Textarea value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} rows={2} />
                </div>
              );
            }
            if (field.type === 'number') {
              return (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground">{field.label}</label>
                  <Input type="number" value={f[field.key] || ''} onChange={e => set(field.key, e.target.value ? Number(e.target.value) : '')} />
                </div>
              );
            }
            return (
              <div key={field.key}>
                <label className="text-xs text-muted-foreground">{field.label}</label>
                <Input type={field.type || 'text'} value={f[field.key] || ''} onChange={e => set(field.key, e.target.value)} />
              </div>
            );
          })}
          <Button className="w-full" onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dashboard Overview ──────
function TabDashboard({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = (team.members.data || []).filter((m: any) => m.status === 'ativo');
  const allPayments = team.payments.data || [];
  const allContracts = team.contracts.data || [];
  const [selected, setSelected] = useState<any>(null);
  const [dialog, setDialog] = useState<any>(null);
  const qc = useQueryClient();

  // Fetch time entries for current month
  const timeEntries = useQuery({
    queryKey: ['team-dashboard-time', currentYear, currentMonth],
    queryFn: async () => {
      const { data } = await supabase.from('time_entries').select('*')
        .eq('entry_year', currentYear).eq('entry_month', currentMonth);
      return (data || []) as any[];
    },
  });

  // Total hours this month
  const totalHoursMonth = useMemo(() =>
    (timeEntries.data || []).reduce((s: number, e: any) => s + Number(e.duration || 0), 0),
    [timeEntries.data]
  );

  // Hours per member for chart
  const hoursPerMember = useMemo(() => {
    const map: Record<string, number> = {};
    (timeEntries.data || []).forEach((e: any) => {
      if (e.member_id) map[e.member_id] = (map[e.member_id] || 0) + Number(e.duration || 0);
    });
    return allMembers.map((m: any) => ({
      name: m.full_name?.split(' ')[0] || '?',
      hours: Math.round((map[m.id] || 0) * 100) / 100,
      memberId: m.id,
    })).sort((a: any, b: any) => b.hours - a.hours);
  }, [timeEntries.data, allMembers]);

  // Overload warnings: members who worked more than contracted hours
  const overloadWarnings = useMemo(() => {
    const warnings: { member: any; worked: number; contracted: number }[] = [];
    allMembers.forEach((m: any) => {
      const contract = allContracts.find((c: any) => c.member_id === m.id && c.status === 'ativo');
      if (!contract?.contracted_hours) return;
      const contractedNum = parseFloat(contract.contracted_hours);
      if (isNaN(contractedNum) || contractedNum <= 0) return;
      const worked = (timeEntries.data || [])
        .filter((e: any) => e.member_id === m.id)
        .reduce((s: number, e: any) => s + Number(e.duration || 0), 0);
      if (worked > contractedNum) {
        warnings.push({ member: m, worked: Math.round(worked * 100) / 100, contracted: contractedNum });
      }
    });
    return warnings;
  }, [allMembers, allContracts, timeEntries.data]);

  // Payment warnings: overdue payments (status 'por_pagar' and month/year already passed)
  const overduePayments = useMemo(() => {
    return allPayments.filter((p: any) => {
      if (p.status !== 'por_pagar') return false;
      if (p.year < currentYear) return true;
      if (p.year === currentYear && p.month < currentMonth) return true;
      return false;
    });
  }, [allPayments]);

  const overdueByMember = useMemo(() => {
    const map: Record<string, number> = {};
    overduePayments.forEach((p: any) => {
      map[p.member_id] = (map[p.member_id] || 0) + 1;
    });
    return map;
  }, [overduePayments]);

  // Save handler for new members
  const handleSave = async ({ member, contract: contractData }: any) => {
    try {
      const isNew = !member.id;
      let memberId = member.id;
      if (isNew) {
        const payload = cleanPayload({ ...member });
        delete payload.id;
        const { data, error } = await supabase.from('team_members').insert(payload as any).select('id').single();
        if (error) throw error;
        memberId = data.id;
      } else {
        const payload = cleanPayload(member);
        const { error } = await supabase.from('team_members').update(payload as any).eq('id', member.id);
        if (error) throw error;
      }
      // Auto-assign permissions based on department
      if (member.department) {
        await autoAssignPermissions(memberId, member.department);
      }
      if (isNew && contractData && memberId) {
        const monthlyVal = parseFloat(contractData.monthly_value) || 0;
        const paymentDay = parseInt(contractData.payment_day) || 1;
        await supabase.from('member_contracts').insert({
          member_id: memberId, contract_type: contractData.contract_type,
          start_date: contractData.start_date || null, end_date: contractData.end_date || null,
          status: contractData.status, monthly_value: monthlyVal,
          contracted_hours: contractData.contracted_hours || null, payment_day: paymentDay,
        });
        let numPayments = 0;
        if (contractData.duration === 'unica') numPayments = 1;
        else if (contractData.duration === 'indefinido') numPayments = 12;
        else numPayments = parseInt(contractData.duration) || 0;
        if (numPayments > 0 && contractData.start_date) {
          const startDate = new Date(contractData.start_date);
          const payments = [];
          for (let i = 0; i < numPayments; i++) {
            const payMonth = ((startDate.getMonth() + i) % 12) + 1;
            const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
            payments.push({
              member_id: memberId, month: payMonth, year: payYear,
              gross_value: monthlyVal, net_value: monthlyVal,
              payment_type: contractData.contract_type === 'contrato_prestacao' ? 'prestacao' : 'salario',
              status: 'por_pagar',
            });
          }
          await supabase.from('member_payments').insert(payments);
        }
      }
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Membro criado com contrato e pagamentos!' : 'Membro atualizado');
    } catch (err: any) {
      toast.error('Erro ao guardar: ' + (err.message || err));
    }
  };

  const memberName = (id: string) => allMembers.find((m: any) => m.id === id)?.full_name || (team.members.data || []).find((m: any) => m.id === id)?.full_name || '—';

  const chartConfig = { hours: { label: 'Horas', color: 'hsl(var(--primary))' } };

  // Current month payments for table
  const monthPayments = useMemo(() => {
    return allPayments
      .filter(p => p.year === currentYear)
      .sort((a, b) => a.month - b.month || (a.member_id > b.member_id ? 1 : -1));
  }, [allPayments]);

  const [paymentDialog, setPaymentDialog] = useState<any>(null);
  const paymentFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: (team.members.data || []).map((m: any) => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'payment_type', label: 'Tipo', type: 'select', options: PAYMENT_TYPES },
    { key: 'gross_value', label: 'Valor Bruto (€)', type: 'number' },
    { key: 'net_value', label: 'Valor Líquido (€)', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: PAYMENT_STATUSES },
    { key: 'document_url', label: 'Documentos (URL)', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      {/* Team Gallery */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Equipa</h2>
          <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
        </div>
        {allMembers.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem membros ativos.</CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allMembers.map((m: any) => {
              const hasOverdue = !!overdueByMember[m.id];
              return (
                <Card key={m.id} className={`cursor-pointer hover:shadow-md transition-shadow ${hasOverdue ? 'border-destructive/50' : ''}`} onClick={() => setSelected(m)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={m.photo_url || undefined} />
                        <AvatarFallback className="text-xs font-semibold">{getInitials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{m.full_name}</p>
                        {m.role_title && <p className="text-xs text-muted-foreground truncate">{m.role_title}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <DeptBadge dept={m.department} />
                    </div>
                    {hasOverdue && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{overdueByMember[m.id]} pagamento(s) em atraso</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Horas trabalhadas (mês)</p>
              <p className="text-lg font-bold">{totalHoursMonth.toFixed(1)}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Membros ativos</p>
              <p className="text-lg font-bold">{allMembers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Pagamentos em atraso</p>
              <p className="text-lg font-bold">{overduePayments.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overload Warnings */}
      {overloadWarnings.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Membros sobrecarregados este mês</h3>
            </div>
            {overloadWarnings.map(w => (
              <div key={w.member.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{w.member.full_name}</span>
                <span className="text-xs text-muted-foreground">{w.worked}h trabalhadas / {w.contracted}h contratadas</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hours Chart */}
      {hoursPerMember.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Horas por membro — {getMonthName(currentMonth)} {currentYear}</h3>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={hoursPerMember}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pagamentos de Equipa — {currentYear}</h3>
          <Button size="sm" onClick={() => setPaymentDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {monthPayments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem pagamentos</TableCell></TableRow>
              ) : monthPayments.map(p => {
                const isOverdue = p.status === 'por_pagar' && (p.year < currentYear || (p.year === currentYear && p.month < currentMonth));
                return (
                  <TableRow key={p.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-sm">{memberName(p.member_id)}</TableCell>
                    <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                    <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                    <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'pago' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">
                        {isOverdue ? 'Em atraso' : labelFor(PAYMENT_STATUSES, p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.document_url ? <a href={p.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setPaymentDialog(p); }}>Editar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div></Card>
        {paymentDialog !== null && <RecordDialog open onClose={() => setPaymentDialog(null)} title={paymentDialog.id ? 'Editar Pagamento' : 'Novo Pagamento'} fields={paymentFields} initial={paymentDialog} onSave={(r: any) => team.upsertPayment.mutate(r)} />}
      </div>

      {dialog !== null && <MemberDialog open onClose={() => setDialog(null)} initial={dialog} onSave={handleSave} />}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} />}
    </div>
  );
}

// ─── Tab: Equipa (list) ──────
export function TabEquipa({ team }: { team: ReturnType<typeof useTeamData> }) {
  const [dialog, setDialog] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const allMembers = team.members.data || [];
  const qc = useQueryClient();

  const handleSave = async ({ member, contract: contractData }: any) => {
    try {
      const isNew = !member.id;
      let memberId = member.id;
      if (isNew) {
        const payload = cleanPayload({ ...member });
        delete payload.id;
        const { data, error } = await supabase.from('team_members').insert(payload as any).select('id').single();
        if (error) throw error;
        memberId = data.id;
      } else {
        const payload = cleanPayload(member);
        const { error } = await supabase.from('team_members').update(payload as any).eq('id', member.id);
        if (error) throw error;
      }
      // Auto-assign permissions based on department
      if (member.department) {
        await autoAssignPermissions(memberId, member.department);
      }
      if (isNew && contractData && memberId) {
        const monthlyVal = parseFloat(contractData.monthly_value) || 0;
        const paymentDay = parseInt(contractData.payment_day) || 1;
        await supabase.from('member_contracts').insert({
          member_id: memberId, contract_type: contractData.contract_type,
          start_date: contractData.start_date || null, end_date: contractData.end_date || null,
          status: contractData.status, monthly_value: monthlyVal,
          contracted_hours: contractData.contracted_hours || null, payment_day: paymentDay,
        });
        let numPayments = 0;
        if (contractData.duration === 'unica') numPayments = 1;
        else if (contractData.duration === 'indefinido') numPayments = 12;
        else numPayments = parseInt(contractData.duration) || 0;
        if (numPayments > 0 && contractData.start_date) {
          const startDate = new Date(contractData.start_date);
          const payments = [];
          for (let i = 0; i < numPayments; i++) {
            const payMonth = ((startDate.getMonth() + i) % 12) + 1;
            const payYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + i) / 12);
            payments.push({
              member_id: memberId, month: payMonth, year: payYear,
              gross_value: monthlyVal, net_value: monthlyVal,
              payment_type: contractData.contract_type === 'contrato_prestacao' ? 'prestacao' : 'salario',
              status: 'por_pagar',
            });
          }
          await supabase.from('member_payments').insert(payments);
        }
      }
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Membro criado!' : 'Membro atualizado');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold">Equipa</h2>
        <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Membro</Button>
      </div>
      {allMembers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem membros.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allMembers.map(m => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(m)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-sm">{m.full_name}</h3>
                    {m.role_title && <p className="text-xs text-muted-foreground">{m.role_title}</p>}
                  </div>
                  <Badge variant={m.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {labelFor(MEMBER_STATUSES, m.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <DeptBadge dept={m.department} />
                </div>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); setDialog(m); }}>Editar</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={e => { e.stopPropagation(); team.deleteMember.mutate(m.id); }}>Apagar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog !== null && <MemberDialog open onClose={() => setDialog(null)} initial={dialog} onSave={handleSave} />}
      {selected && <MemberDetailSheet open onClose={() => setSelected(null)} member={selected} team={team} />}
    </div>
  );
}

// ─── Tab: Performance ──────
export function TabPerformance({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [weeklyDialog, setWeeklyDialog] = useState<any>(null);
  const [monthlyDialog, setMonthlyDialog] = useState<any>(null);
  const [perfTab, setPerfTab] = useState('registos');

  const weeklyData = useMemo(() => {
    let d = team.perfWeekly.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    if (dateFrom) d = d.filter(r => (r.week_end || r.week_start) >= dateFrom);
    if (dateTo) d = d.filter(r => r.week_start <= dateTo);
    return d;
  }, [team.perfWeekly.data, filterMember, dateFrom, dateTo]);

  const monthlyData = useMemo(() => {
    let d = team.perfMonthly.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    if (dateFrom) {
      const fromY = parseInt(dateFrom.slice(0, 4));
      const fromM = parseInt(dateFrom.slice(5, 7));
      d = d.filter(r => r.year > fromY || (r.year === fromY && (r.month || 1) >= fromM));
    }
    if (dateTo) {
      const toY = parseInt(dateTo.slice(0, 4));
      const toM = parseInt(dateTo.slice(5, 7));
      d = d.filter(r => r.year < toY || (r.year === toY && (r.month || 12) <= toM));
    }
    return d;
  }, [team.perfMonthly.data, filterMember, dateFrom, dateTo]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const weeklyFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'week_start', label: 'Início da semana', type: 'date' },
    { key: 'week_end', label: 'Fim da semana', type: 'date' },
    { key: 'tasks_completed', label: 'Tarefas concluídas', type: 'number' },
    { key: 'tasks_overdue', label: 'Tarefas em atraso', type: 'number' },
    { key: 'projects_active', label: 'Projetos ativos', type: 'number' },
    { key: 'notes', label: 'Notas de performance', type: 'textarea' },
    { key: 'overall_status', label: 'Status geral', type: 'select', options: PERFORMANCE_STATUSES },
  ];

  const monthlyFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'tasks_completed', label: 'Tarefas concluídas', type: 'number' },
    { key: 'tasks_overdue', label: 'Tarefas em atraso', type: 'number' },
    { key: 'projects_active', label: 'Projetos ativos', type: 'number' },
    { key: 'hours_worked', label: 'Total horas trabalhadas', type: 'number' },
    { key: 'rating', label: 'Avaliação (1-5)', type: 'number' },
    { key: 'comments', label: 'Comentários', type: 'textarea' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
    { key: 'overall_status', label: 'Status geral', type: 'select', options: PERFORMANCE_STATUSES },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Performance</h2>

      {/* Top-level navigation tabs */}
      <Tabs value={perfTab} onValueChange={setPerfTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="registos"><ListTodo className="h-3.5 w-3.5 mr-1" />Registos Semanais</TabsTrigger>
          <TabsTrigger value="tarefas-membro"><Users className="h-3.5 w-3.5 mr-1" />Tarefas por Membro</TabsTrigger>
          <TabsTrigger value="prioridade"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Por Prioridade</TabsTrigger>
          <TabsTrigger value="atraso"><Clock className="h-3.5 w-3.5 mr-1" />Em Atraso</TabsTrigger>
          <TabsTrigger value="tempo-membro"><BarChart3 className="h-3.5 w-3.5 mr-1" />Tempo por Membro</TabsTrigger>
          <TabsTrigger value="sobrecarga"><AlertTriangle className="h-3.5 w-3.5 mr-1" />Tarefas & Sobrecarga</TabsTrigger>
        </TabsList>

        <TabsContent value="registos">
          {/* Original weekly/monthly records */}
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
                  <Input type="date" className="h-8 w-36 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
                  <Input type="date" className="h-8 w-36 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>Limpar</Button>
                )}
                <div className="w-44"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
              </div>
            </div>
            <Tabs defaultValue="semanal">
              <TabsList><TabsTrigger value="semanal">Semanal</TabsTrigger><TabsTrigger value="mensal">Mensal</TabsTrigger></TabsList>
              <TabsContent value="semanal" className="space-y-3">
                <div className="flex justify-end"><Button size="sm" onClick={() => setWeeklyDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Registo</Button></div>
                <Card><div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Membro</TableHead><TableHead>Semana</TableHead><TableHead>Concluídas</TableHead><TableHead>Atraso</TableHead><TableHead>Projetos</TableHead><TableHead>Status</TableHead><TableHead>Notas</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {weeklyData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem registos</TableCell></TableRow> :
                        weeklyData.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                            <TableCell className="text-xs">{r.week_start} → {r.week_end}</TableCell>
                            <TableCell className="text-xs">{r.tasks_completed}</TableCell>
                            <TableCell className="text-xs">{r.tasks_overdue}</TableCell>
                            <TableCell className="text-xs">{r.projects_active}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{labelFor(PERFORMANCE_STATUSES, r.overall_status)}</Badge></TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{r.notes || '—'}</TableCell>
                            <TableCell><div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeeklyDialog(r)}>Editar</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePerfWeekly.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div></TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div></Card>
                {weeklyDialog !== null && <RecordDialog open onClose={() => setWeeklyDialog(null)} title={weeklyDialog.id ? 'Editar Registo Semanal' : 'Novo Registo Semanal'} fields={weeklyFields} initial={weeklyDialog} onSave={(r: any) => team.upsertPerfWeekly.mutate(r)} />}
              </TabsContent>
              <TabsContent value="mensal" className="space-y-3">
                <div className="flex justify-end"><Button size="sm" onClick={() => setMonthlyDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Registo</Button></div>
                <Card><div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Concluídas</TableHead><TableHead>Atraso</TableHead><TableHead>Horas</TableHead><TableHead>Avaliação</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {monthlyData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem registos</TableCell></TableRow> :
                        monthlyData.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                            <TableCell className="text-xs">{r.month && r.year ? `${getMonthName(r.month)} ${r.year}` : '—'}</TableCell>
                            <TableCell className="text-xs">{r.tasks_completed}</TableCell>
                            <TableCell className="text-xs">{r.tasks_overdue}</TableCell>
                            <TableCell className="text-xs">{r.hours_worked || '—'}</TableCell>
                            <TableCell>{r.rating ? <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < (r.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />)}</div> : '—'}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{labelFor(PERFORMANCE_STATUSES, r.overall_status)}</Badge></TableCell>
                            <TableCell><div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMonthlyDialog(r)}>Editar</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePerfMonthly.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div></TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </div></Card>
                {monthlyDialog !== null && <RecordDialog open onClose={() => setMonthlyDialog(null)} title={monthlyDialog.id ? 'Editar Registo Mensal' : 'Novo Registo Mensal'} fields={monthlyFields} initial={monthlyDialog} onSave={(r: any) => team.upsertPerfMonthly.mutate(r)} />}
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="tarefas-membro">
          <TasksByMemberKanban />
        </TabsContent>

        <TabsContent value="prioridade">
          <TasksByPriority />
        </TabsContent>

        <TabsContent value="atraso">
          <OverdueTasks />
        </TabsContent>

        <TabsContent value="tempo-membro">
          <ByMemberTabShared />
        </TabsContent>

        <TabsContent value="sobrecarga">
          <OverloadTabShared />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Feedback Session Dialog (custom, not generic) ──────
const FEEDBACK_EVENT_TYPE_ID = 'b058c64c-169c-4098-bfaf-2b1773a3c60f';

function FeedbackDialog({ open, onClose, initial, members, onSave }: any) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState(initial || {
    member_id: '', session_date: '', session_time: '', feedback_type: 'feedback_formal',
    went_well: '', to_improve: '', agreements: '', next_session: '', summary: '', transcript_url: '',
  });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Feedback' : 'Nova Sessão de Feedback'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Membro *</label>
            <Select value={f.member_id || ''} onValueChange={v => set('member_id', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar membro" /></SelectTrigger>
              <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Data *</label><Input type="date" value={f.session_date || ''} onChange={e => set('session_date', e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Hora</label><Input type="time" value={f.session_time || ''} onChange={e => set('session_time', e.target.value)} /></div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={f.feedback_type || 'feedback_formal'} onValueChange={v => set('feedback_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FEEDBACK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Resumo</label><Textarea value={f.summary || ''} onChange={e => set('summary', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que correu bem</label><Textarea value={f.went_well || ''} onChange={e => set('went_well', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">O que melhorar</label><Textarea value={f.to_improve || ''} onChange={e => set('to_improve', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">Acordos & próximos passos</label><Textarea value={f.agreements || ''} onChange={e => set('agreements', e.target.value)} rows={2} /></div>
          <div><label className="text-xs text-muted-foreground">URL da transcrição (PDF)</label><Input placeholder="https://..." value={f.transcript_url || ''} onChange={e => set('transcript_url', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Próxima sessão</label><Input type="date" value={f.next_session || ''} onChange={e => set('next_session', e.target.value)} /></div>
          <Button className="w-full" disabled={!f.member_id || !f.session_date} onClick={() => { onSave({ ...initial, ...f }); onClose(false); }}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Feedback ──────
export function TabFeedback({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [dialog, setDialog] = useState<any>(null);
  const { user } = useAuth();
  const qc = useQueryClient();

  const data = useMemo(() => {
    let d = team.feedback.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.feedback.data, filterMember]);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  // Save feedback + create event in agenda
  const saveFeedback = async (rec: any) => {
    try {
      const isNew = !rec.id;
      const memberObj = allMembers.find((m: any) => m.id === rec.member_id);

      // Save feedback session
      if (isNew) {
        const payload = { ...rec };
        delete payload.id;

        // Create event in agenda first
        const startDate = rec.session_date && rec.session_time
          ? `${rec.session_date}T${rec.session_time}:00`
          : `${rec.session_date}T09:00:00`;

        const { data: eventData } = await supabase.from('events').insert({
          title: `Sessão de Feedback — ${memberObj?.full_name || 'Membro'}`,
          start_date: startDate,
          event_type_id: FEEDBACK_EVENT_TYPE_ID,
          department: 'recursos-humanos',
          created_by: user?.id || null,
          notes: rec.summary || null,
        }).select('id').single();

        // Add event members (owner + team member's profile)
        if (eventData?.id) {
          const memberProfiles: string[] = [];
          if (user?.id) memberProfiles.push(user.id);
          if (memberObj?.profile_id && memberObj.profile_id !== user?.id) memberProfiles.push(memberObj.profile_id);
          if (memberProfiles.length > 0) {
            await supabase.from('event_members').insert(
              memberProfiles.map(pid => ({ event_id: eventData.id, profile_id: pid }))
            );
          }
          payload.event_id = eventData.id;
        }

        const { error } = await supabase.from('feedback_sessions').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('feedback_sessions').update(rec).eq('id', rec.id);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(isNew ? 'Sessão criada e adicionada à agenda!' : 'Sessão atualizada');
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Feedback</h2>
        <div className="flex gap-2 items-center">
          <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
          <Button size="sm" onClick={() => setDialog({})}><Plus className="h-4 w-4 mr-1" /> Nova Sessão</Button>
        </div>
      </div>
      <Card><div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Resumo</TableHead><TableHead>Transcrição</TableHead><TableHead>Próxima</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem sessões</TableCell></TableRow> :
              data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.session_date}</TableCell>
                  <TableCell className="text-xs">{r.session_time || '—'}</TableCell>
                  <TableCell className="text-sm">{memberName(r.member_id)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{labelFor(FEEDBACK_TYPES, r.feedback_type)}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{r.summary || '—'}</TableCell>
                  <TableCell>{r.transcript_url ? <a href={r.transcript_url} target="_blank" rel="noopener" className="text-xs text-primary underline">PDF</a> : '—'}</TableCell>
                  <TableCell className="text-xs">{r.next_session || '—'}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDialog(r)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteFeedback.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div></TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div></Card>
      {dialog !== null && <FeedbackDialog open onClose={() => setDialog(null)} initial={dialog} members={allMembers} onSave={saveFeedback} />}
    </div>
  );
}

// ─── Tab: Contratos & Pagamentos ──────
export function TabContracts({ team }: { team: ReturnType<typeof useTeamData> }) {
  const allMembers = team.members.data || [];
  const [filterMember, setFilterMember] = useState('');
  const [contractDialog, setContractDialog] = useState<any>(null);
  const [paymentDialog, setPaymentDialog] = useState<any>(null);

  const memberName = (id: string) => allMembers.find(m => m.id === id)?.full_name || '—';

  const contractsData = useMemo(() => {
    let d = team.contracts.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.contracts.data, filterMember]);

  const paymentsData = useMemo(() => {
    let d = team.payments.data || [];
    if (filterMember) d = d.filter(r => r.member_id === filterMember);
    return d;
  }, [team.payments.data, filterMember]);

  const paidThisMonth = useMemo(() =>
    (team.payments.data || []).filter(p => p.status === 'pago' && p.month === currentMonth && p.year === currentYear)
      .reduce((s, p) => s + Number(p.net_value || 0), 0),
    [team.payments.data]
  );

  const paidThisYear = useMemo(() =>
    (team.payments.data || []).filter(p => p.status === 'pago' && p.year === currentYear)
      .reduce((s, p) => s + Number(p.net_value || 0), 0),
    [team.payments.data]
  );

  const contractFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'contract_type', label: 'Tipo de contrato', type: 'select', options: CONTRACT_TYPES },
    { key: 'start_date', label: 'Data de início', type: 'date' },
    { key: 'end_date', label: 'Data de fim', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: CONTRACT_STATUSES },
    { key: 'document_url', label: 'Documento (URL)', type: 'text' },
    { key: 'notes', label: 'Notas', type: 'textarea' },
  ];

  const paymentFields = [
    { key: 'member_id', label: 'Membro', type: 'select', options: allMembers.map(m => ({ value: m.id, label: m.full_name })) },
    { key: 'month', label: 'Mês', type: 'number' },
    { key: 'year', label: 'Ano', type: 'number' },
    { key: 'payment_type', label: 'Tipo', type: 'select', options: PAYMENT_TYPES },
    { key: 'gross_value', label: 'Valor Bruto (€)', type: 'number' },
    { key: 'net_value', label: 'Valor Líquido (€)', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: PAYMENT_STATUSES },
    { key: 'document_url', label: 'Documentos (URL)', type: 'text' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base font-semibold">Contratos & Pagamentos</h2>
        <div className="w-48"><MemberSelect value={filterMember} onChange={setFilterMember} members={allMembers} /></div>
      </div>
      <div className="flex gap-4">
        <Card className="flex-1"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Pago este mês</p>
          <p className="text-lg font-bold">€{paidThisMonth.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="flex-1"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Pago este ano</p>
          <p className="text-lg font-bold">€{paidThisYear.toLocaleString()}</p>
        </CardContent></Card>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">/ Contratos</h3>
          <Button size="sm" onClick={() => setContractDialog({})}><Plus className="h-4 w-4 mr-1" /> Novo Contrato</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Tipo</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {contractsData.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Sem contratos</TableCell></TableRow> :
                contractsData.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{memberName(c.member_id)}</TableCell>
                    <TableCell className="text-xs">{labelFor(CONTRACT_TYPES, c.contract_type)}</TableCell>
                    <TableCell className="text-xs">{c.start_date || '—'}</TableCell>
                    <TableCell className="text-xs">{c.end_date || '—'}</TableCell>
                    <TableCell><Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(CONTRACT_STATUSES, c.status)}</Badge></TableCell>
                    <TableCell>{c.document_url ? <a href={c.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setContractDialog(c)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deleteContract.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div></Card>
        {contractDialog !== null && <RecordDialog open onClose={() => setContractDialog(null)} title={contractDialog.id ? 'Editar Contrato' : 'Novo Contrato'} fields={contractFields} initial={contractDialog} onSave={(r: any) => team.upsertContract.mutate(r)} />}
      </div>
      <Separator />
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">/ Pagamentos</h3>
          <Button size="sm" onClick={() => setPaymentDialog({ month: currentMonth, year: currentYear })}><Plus className="h-4 w-4 mr-1" /> Novo Pagamento</Button>
        </div>
        <Card><div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Membro</TableHead><TableHead>Mês</TableHead><TableHead>Tipo</TableHead><TableHead>Bruto</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paymentsData.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">Sem pagamentos</TableCell></TableRow> :
                paymentsData.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{memberName(p.member_id)}</TableCell>
                    <TableCell className="text-xs">{p.month && p.year ? `${getMonthName(p.month)} ${p.year}` : '—'}</TableCell>
                    <TableCell className="text-xs">{labelFor(PAYMENT_TYPES, p.payment_type)}</TableCell>
                    <TableCell className="text-xs">€{Number(p.gross_value).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">€{Number(p.net_value).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === 'pago' ? 'default' : 'secondary'} className="text-[10px]">{labelFor(PAYMENT_STATUSES, p.status)}</Badge></TableCell>
                    <TableCell>{p.document_url ? <a href={p.document_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver</a> : '—'}</TableCell>
                    <TableCell><div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPaymentDialog(p)}>Editar</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => team.deletePayment.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div></Card>
        {paymentDialog !== null && <RecordDialog open onClose={() => setPaymentDialog(null)} title={paymentDialog.id ? 'Editar Pagamento' : 'Novo Pagamento'} fields={paymentFields} initial={paymentDialog} onSave={(r: any) => team.upsertPayment.mutate(r)} />}
      </div>
    </div>
  );
}

// ─── Navigation Sections ──────
const HR_SECTIONS = [
  { path: '/hub/recursos-humanos/equipa', label: 'Equipa', icon: Users, iconColor: 'text-blue-600', color: 'from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10' },
  { path: '/hub/recursos-humanos/escala', label: 'Escala', icon: CalendarIcon, iconColor: 'text-orange-600', color: 'from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10' },
  { path: '/hub/recursos-humanos/performance', label: 'Performance', icon: BarChart3, iconColor: 'text-violet-600', color: 'from-violet-500/10 to-violet-600/5 hover:from-violet-500/20 hover:to-violet-600/10' },
  { path: '/hub/recursos-humanos/feedback', label: 'Feedback', icon: MessageSquare, iconColor: 'text-amber-600', color: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10' },
  { path: '/hub/recursos-humanos/contratos-pagamentos', label: 'Contratos & Pagamentos', icon: FileText, iconColor: 'text-emerald-600', color: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/10' },
];

// ─── Main Page ──────
export default function ExecutiveGestaoEquipa() {
  const team = useTeamData();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        <PageHeader title="Pessoas" subtitle="Central de gestão de todos os membros do negócio" />

        {/* Navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {HR_SECTIONS.map(s => (
            <Card
              key={s.path}
              className={`group cursor-pointer border bg-gradient-to-br ${s.color} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              onClick={() => navigate(s.path)}
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

        <Separator />

        {/* Dashboard inline */}
        <TabDashboard team={team} />
      </div>
    </AppLayout>
  );
}
