import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Upload, FileText, ExternalLink, Loader2, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CONTRACT_STATUSES,
} from '@/hooks/useTeamData';
import { DEPARTMENTS } from '@/lib/departments';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { SENSITIVE_CATEGORIES } from '@/hooks/useSensitiveAccess';
import {
  WEEK_DAYS, PERIODS, TIME_OPTIONS, CONTRACT_DURATIONS, PRESET_ROLES, ROLE_COLORS,
  parseSchedule, formatSchedule,
} from './team-helpers';

const DEFAULT_MEMBER_FORM = {
  full_name: '',
  role_title: '',
  role_color: '#6366f1',
  photo_url: '',
  email: '',
  whatsapp: '',
  work_schedule: '',
  identification: '',
  iban: '',
  fiscal_address: '',
  departments: [] as string[],
  sensitiveAccess: {} as Record<string, boolean>,
  birthday: '',
  responsibilities: '',
  system_role: 'team_member' as string, // função no sistema (RBAC)
  works_with_clients: false,
};

// Funções do sistema disponíveis para atribuir a um membro de equipa.
// "owner" não está aqui — é único e gere-se à parte.
const SYSTEM_ROLE_OPTIONS = [
  { value: 'admin',       label: 'Administradora',   hint: 'Vê e gere quase tudo (exceto trocar a Dona).' },
  { value: 'accountant',  label: 'Contabilista',     hint: 'Acesso só à parte financeira/fiscal.' },
  { value: 'hr',          label: 'Recursos Humanos', hint: 'Gere pessoas, salários, contratos.' },
  { value: 'admin_staff', label: 'Administrativa',   hint: 'Apoio administrativo geral.' },
  { value: 'sales',       label: 'Comercial',        hint: 'Vê CRM, leads, vendas.' },
  { value: 'team_member', label: 'Membro de equipa', hint: 'Acesso ao próprio trabalho e clientes atribuídos.' },
  { value: 'viewer',      label: 'Visualizador',     hint: 'Só pode ver, não pode editar nada.' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferência' },
  { value: 'mbway', label: 'MB WAY' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'numerario', label: 'Numerário' },
  { value: 'debito_direto', label: 'Débito Direto' },
  { value: 'outro', label: 'Outro' },
];

// Vínculo unificado: controla simultaneamente member_type e contract_type
const BOND_OPTIONS = [
  { value: 'interno',    label: 'Equipa Interna',  hint: 'Contrato de trabalho',           contract_type: 'contrato_trabalho' },
  { value: 'freelancer', label: 'Freelancer',      hint: 'Prestação de serviços',          contract_type: 'contrato_prestacao' },
  { value: 'socio',      label: 'Sócio',           hint: 'Acordo de sociedade',            contract_type: 'acordo' },
  { value: 'outro',      label: 'Outro',           hint: 'Outro tipo de vínculo',          contract_type: 'outro' },
];

function bondFromContractType(contractType: string): string {
  if (contractType === 'contrato_prestacao' || contractType === 'prestacao_servicos') return 'freelancer';
  if (contractType === 'acordo') return 'socio';
  if (contractType === 'outro') return 'outro';
  return 'interno';
}

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

function ContractDocUpload({ contract, setC, uploading, setUploading, memberId }: {
  contract: any; setC: (k: string, v: any) => void; uploading: boolean; setUploading: (v: boolean) => void; memberId?: string;
}) {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `contracts/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('financial-files').upload(path, file);
    if (error) { toast.error('Erro ao carregar documento'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('financial-files').getPublicUrl(path);
    setC('document_url', urlData.publicUrl);
    // If editing and contract exists, update DB immediately
    if (contract.id) {
      await supabase.from('member_contracts').update({ document_url: urlData.publicUrl }).eq('id', contract.id);
    }
    setUploading(false);
    toast.success('Documento carregado!');
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground font-medium">Documento do contrato</label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors text-xs text-muted-foreground hover:text-foreground">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'A carregar...' : 'Upload ficheiro'}
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {contract.document_url && (
          <a href={contract.document_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-primary hover:underline">
            <FileText className="h-3.5 w-3.5" />
            Ver documento
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function MemberDialog({ open, onClose, initial, onSave }: any) {
  const { settings } = useBusinessSettings();
  const isENI = settings?.business_type === 'eni';
  const isAccountant = !!settings && !!initial?.id && (settings as any).accountant_member_id === initial.id;

  const isEdit = !!initial?.id;
  const [f, setF] = useState({ ...DEFAULT_MEMBER_FORM, ...(initial || {}) });
  const [uploading, setUploading] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contract, setContract] = useState({
    id: '',
    contract_type: 'contrato_trabalho',
    duration: '12',
    monthly_value: '',
    contracted_hours: '',
    payment_day: '1',
    start_date: '',
    end_date: '',
    status: 'ativo',
    document_url: '',
    notes: '',
    value_includes_vat: false,
    payment_start_date: '', // if different from contract start
    use_custom_payment_start: false,
    ss_employer_rate: 0.2375,
    payment_method: '',
  });
  const [contractLoaded, setContractLoaded] = useState(false);

  const isOwnerRole = f.role_title === 'Owner';
  const isENIOwner = isENI && isOwnerRole;

  // Custom role presets from DB (replaces static PRESET_ROLES)
  const qc = useQueryClient();
  const { data: dbPresets = [] } = useQuery({
    queryKey: ['team_role_presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_role_presets')
        .select('id, label, color')
        .order('label');
      if (error) throw error;
      return data || [];
    },
  });
  const rolePresets = dbPresets.length > 0 ? dbPresets : PRESET_ROLES.map(r => ({ id: r.label, label: r.label, color: r.color }));
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6366f1');

  async function saveNewRolePreset() {
    const label = newRoleLabel.trim();
    if (!label) { toast.error('Indica um nome para o cargo'); return; }
    if (rolePresets.some((r: any) => r.label.toLowerCase() === label.toLowerCase())) {
      toast.error('Já existe um cargo com esse nome');
      return;
    }
    const { error } = await supabase.from('team_role_presets').insert({ label, color: newRoleColor });
    if (error) { toast.error('Sem permissão para criar cargos'); return; }
    toast.success('Cargo criado');
    set('role_title', label);
    set('role_color', newRoleColor);
    setCreatingRole(false);
    setNewRoleLabel('');
    setNewRoleColor('#6366f1');
    qc.invalidateQueries({ queryKey: ['team_role_presets'] });
  }

  async function deleteRolePreset(id: string, label: string) {
    if (!confirm(`Eliminar o cargo "${label}" da lista?`)) return;
    const { error } = await supabase.from('team_role_presets').delete().eq('id', id);
    if (error) { toast.error('Sem permissão para eliminar'); return; }
    toast.success('Cargo removido');
    qc.invalidateQueries({ queryKey: ['team_role_presets'] });
  }

  useEffect(() => {
    const init = { ...DEFAULT_MEMBER_FORM, ...(initial || {}) };
    setF(init);
    setContractLoaded(false);
    if (initial?.id) {
      // Load sensitive access
      supabase.from('member_sensitive_access').select('category, granted').eq('member_id', initial.id).then(({ data }) => {
        if (data && data.length > 0) {
          const sa: Record<string, boolean> = {};
          data.forEach(r => { sa[r.category] = r.granted; });
          setF((prev: any) => ({ ...prev, sensitiveAccess: sa }));
        }
      });
      // Load existing system role from user_roles (via profile_id → user_id)
      if (initial.profile_id) {
        supabase.from('profiles').select('user_id').eq('id', initial.profile_id).maybeSingle().then(({ data: prof }) => {
          if (!prof?.user_id) return;
          supabase.from('user_roles').select('role').eq('user_id', prof.user_id).then(({ data: rolesData }) => {
            const nonOwner = (rolesData || []).map((r: any) => r.role).filter((r: string) => r !== 'owner');
            // Se é owner, não mostramos seletor — caso contrário pega no primeiro role atribuído
            const isOwner = (rolesData || []).some((r: any) => r.role === 'owner');
            if (!isOwner) {
              const order = ['admin','accountant','hr','admin_staff','sales','team_member','viewer','member'];
              const sorted = nonOwner.sort((a: string, b: string) => order.indexOf(a) - order.indexOf(b));
              if (sorted.length > 0) {
                setF((prev: any) => ({ ...prev, system_role: sorted[0] === 'member' ? 'team_member' : sorted[0] }));
              }
            }
          });
        });
      }
      // Load existing contract
      supabase.from('member_contracts').select('*').eq('member_id', initial.id).order('created_at', { ascending: false }).limit(1).then(({ data }) => {
        if (data && data.length > 0) {
          const c = data[0];
          setContract({
            id: c.id,
            contract_type: c.contract_type || 'contrato_trabalho',
            duration: (c as any).duration || 'indefinido',
            monthly_value: c.monthly_value?.toString() || '',
            contracted_hours: c.contracted_hours || '',
            payment_day: c.payment_day?.toString() || '1',
            start_date: c.start_date || '',
            end_date: c.end_date || '',
            status: c.status || 'ativo',
            document_url: c.document_url || '',
            notes: c.notes || '',
            value_includes_vat: !!c.value_includes_vat,
            payment_start_date: c.payment_start_date || '',
            use_custom_payment_start: !!c.use_custom_payment_start,
            ss_employer_rate: typeof (c as any).ss_employer_rate === 'number' ? (c as any).ss_employer_rate : 0.2375,
            payment_method: (c as any).payment_method || (initial as any)?.payment_method || '',
          });
        }
        setContractLoaded(true);
      });
    } else {
      setContract({
        id: '',
        contract_type: 'contrato_trabalho',
        duration: '12',
        monthly_value: '',
        contracted_hours: '',
        payment_day: '1',
        start_date: '',
        end_date: '',
        status: 'ativo',
        document_url: '',
        notes: '',
        value_includes_vat: false,
        payment_start_date: '',
        use_custom_payment_start: false,
        ss_employer_rate: 0.2375,
        payment_method: '',
      });
      setContractLoaded(true);
    }
  }, [initial]);

  // Auto-fill everything when ENI + Owner is selected
  const applyOwnerDefaults = useCallback(() => {
    const allDepts = DEPARTMENTS.map(d => d.value);
    const allSensitive: Record<string, boolean> = {};
    SENSITIVE_CATEGORIES.forEach(cat => { allSensitive[cat.key] = true; });
    setF((prev: any) => ({
      ...prev,
      departments: allDepts,
      sensitiveAccess: allSensitive,
      system_role: 'admin',
    }));
    if (isENI) {
      const today = new Date().toISOString().split('T')[0];
      setContract(prev => ({
        ...prev,
        contract_type: 'outro',
        duration: 'indefinido',
        start_date: today,
        end_date: '',
        status: 'ativo',
      }));
    }
  }, [isENI]);

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
    setC('end_date', calcEndDate(v, contract.duration));
  };

  const handleDurationChange = (v: string) => {
    setC('duration', v);
    setC('end_date', calcEndDate(contract.start_date, v));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? 'Editar Membro' : 'Novo Membro'}
            {isAccountant && (
              <Badge variant="secondary" className="text-[10px] font-medium">Contabilista</Badge>
            )}
          </DialogTitle>
          {isAccountant && (
            <p className="text-xs text-muted-foreground pt-1">
              Este membro está definido como contabilista do negócio. O tipo de contrato está bloqueado em "prestação de serviços". Para alterar, remove-o primeiro em Definições &gt; Fiscal.
            </p>
          )}
        </DialogHeader>
        <div className="space-y-5">

          {/* ═══ BLOCO 1: IDENTIDADE ═══ */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">👤 Identidade</h3>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={f.photo_url || undefined} />
                  <AvatarFallback className="text-lg">{f.full_name ? f.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?'}</AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Upload className="h-4 w-4 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
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
                  }} />
                </label>
                {uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><span className="text-[10px] text-white">...</span></div>}
              </div>
              <div className="flex-1">
                <Input placeholder="Nome completo *" value={f.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
            </div>

            {/* Função */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Cargo</span>
              <p className="text-[10px] text-muted-foreground">Título descritivo (ex: Designer, Gestora). Não controla permissões — isso é a "Função no sistema" mais abaixo.</p>
              <div className="flex flex-wrap gap-2">
                {rolePresets.map((r: any) => {
                  const isSelected = f.role_title === r.label;
                  return (
                    <div key={r.id || r.label} className="relative group">
                      <button type="button"
                        onClick={() => {
                          const newRole = isSelected ? '' : r.label;
                          set('role_title', newRole);
                          set('role_color', r.color);
                          if (newRole === 'Owner') {
                            setTimeout(applyOwnerDefaults, 0);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isSelected ? 'text-white border-transparent ring-2 ring-offset-1 ring-foreground/20' : 'text-foreground/70 border-border hover:border-foreground/30'}`}
                        style={isSelected ? { backgroundColor: r.color } : {}}
                      >{r.label}</button>
                      {r.id && r.label !== 'Owner' && (
                        <button type="button"
                          onClick={() => deleteRolePreset(r.id, r.label)}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground items-center justify-center text-[10px] hidden group-hover:flex"
                          title="Eliminar cargo"
                        ><X className="h-2.5 w-2.5" /></button>
                      )}
                    </div>
                  );
                })}
                {!creatingRole && (
                  <button type="button"
                    onClick={() => { setCreatingRole(true); setNewRoleLabel(''); setNewRoleColor('#6366f1'); }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/60 transition-all flex items-center gap-1"
                  ><Plus className="h-3 w-3" /> Criar cargo</button>
                )}
              </div>

              {creatingRole && (
                <div className="flex gap-2 items-center mt-2 p-2 rounded-md border border-dashed">
                  <Input
                    className="flex-1 h-8 text-xs"
                    placeholder="Nome do cargo (ex: Consultora)"
                    value={newRoleLabel}
                    autoFocus
                    onChange={e => setNewRoleLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewRolePreset(); } }}
                  />
                  <div className="flex gap-1">
                    {ROLE_COLORS.map(c => (
                      <button key={c.value} type="button" onClick={() => setNewRoleColor(c.value)}
                        className={`h-5 w-5 rounded-full border-2 transition-all shrink-0 ${newRoleColor === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.value }} title={c.label} />
                    ))}
                  </div>
                  <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={saveNewRolePreset}>
                    <Check className="h-3 w-3" /> Guardar
                  </button>
                  <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setCreatingRole(false)}>Cancelar</button>
                </div>
              )}

              {!rolePresets.some((r: any) => r.label === f.role_title) && f.role_title ? (
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
              ) : null}
              {f.role_title && <Badge className="text-xs text-white mt-1" style={{ backgroundColor: f.role_color || '#6366f1' }}>{f.role_title}</Badge>}
            </div>

            {/* Contactos */}
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Email" value={f.email || ''} onChange={e => set('email', e.target.value)} />
              <Input placeholder="Telefone" value={f.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* ═══ DADOS FISCAIS ═══ */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🧾 Dados Fiscais</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Data de nascimento</label>
                <Input type="date" value={f.birthday || ''} onChange={e => set('birthday', e.target.value)} />
              </div>
              <div />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="NIF / Identificação" value={f.identification || ''} onChange={e => set('identification', e.target.value)} />
              <Input placeholder="IBAN" value={f.iban || ''} onChange={e => set('iban', e.target.value)} />
            </div>
            <Input placeholder="Morada fiscal" value={f.fiscal_address || ''} onChange={e => set('fiscal_address', e.target.value)} />
          </div>

          {isOwnerRole ? (
            <>
              <Separator />
              <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                <p className="text-xs text-primary font-medium">👑 Como Owner, todos os departamentos, áreas, função no sistema e permissões sensíveis foram atribuídos automaticamente.</p>
              </div>
            </>
          ) : (
            <>
              <Separator />
              {/* ═══ O QUE FAZ ═══ */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🏢 O que faz</h3>
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Atalhos rápidos</span>
                  <p className="text-[10px] text-muted-foreground">Aplica em 1 clique departamento(s) + modo de trabalho típico. Podes ajustar depois.</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      { key: 'contabilista',     label: 'Contabilista',     depts: ['financeiro'],     wwc: false },
                      { key: 'marketer',         label: 'Marketer',         depts: ['marketing'],      wwc: false },
                      { key: 'comercial',        label: 'Comercial',        depts: ['comercial'],      wwc: true  },
                      { key: 'customer-success', label: 'Customer Success', depts: ['clientes'],       wwc: true  },
                      { key: 'administrativa',   label: 'Administrativa',   depts: ['administrativo'], wwc: false },
                    ].map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          set('departments', p.depts);
                          set('works_with_clients', p.wwc);
                        }}
                        className="text-[11px] rounded-full border border-border px-2.5 py-1 hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Departamentos</span>
                  <p className="text-[10px] text-muted-foreground">Define em que áreas do negócio este membro trabalha. Controla também o acesso a essas secções do sistema.</p>
                  <div className="space-y-1 mt-1.5">
                    {DEPARTMENTS.map(d => {
                      const depts: string[] = Array.isArray(f.departments) ? f.departments : [];
                      const checked = depts.includes(d.value);
                      return (
                        <label key={d.value} className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs',
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                        )}>
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            const next = v ? [...depts, d.value] : depts.filter(x => x !== d.value);
                            set('departments', next);
                          }} />
                          <span>{d.icon} {d.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <Textarea placeholder="Responsabilidades específicas (opcional)" value={f.responsibilities || ''} onChange={e => set('responsibilities', e.target.value)} rows={2} />
              </div>

              <Separator />

              {/* ═══ ACESSOS & PERMISSÕES ═══ */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🔐 Acessos & Permissões</h3>

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Função no sistema</span>
                  <p className="text-[10px] text-muted-foreground">Controla o nível de acesso técnico. Diferente do cargo (descritivo).</p>
                  <Select value={f.system_role || 'team_member'} onValueChange={(v) => set('system_role', v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Membro de equipa" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[320px]">
                      {SYSTEM_ROLE_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value} className="text-xs py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{r.label}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-normal leading-tight">{r.hint}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground font-medium">Permissões Sensíveis</span>
                  <p className="text-[10px] text-muted-foreground">Define que informação sensível este membro pode ver. Tudo OFF por defeito.</p>
                  <div className="space-y-1">
                    {SENSITIVE_CATEGORIES.map(cat => {
                      const checked = !!(f.sensitiveAccess || {})[cat.key];
                      return (
                        <label key={cat.key} className={cn(
                          'flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors',
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                        )}>
                          <Switch checked={checked} onCheckedChange={(v) => {
                            set('sensitiveAccess', { ...(f.sensitiveAccess || {}), [cat.key]: !!v });
                          }} />
                          <div>
                            <span className="text-xs font-medium">{cat.label}</span>
                            <p className="text-[10px] text-muted-foreground leading-tight">{cat.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* ═══ HORÁRIO ═══ */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🕐 Horário</h3>
             <ScheduleSelector value={f.work_schedule || ''} onChange={v => set('work_schedule', v)} />
          </div>

          <Separator />

          {/* ═══ MODO DE TRABALHO ═══ */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🎯 Modo de trabalho</h3>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Trabalha diretamente com clientes</p>
                <p className="text-xs text-muted-foreground leading-tight">Inclui-o no cálculo de capacidade client-facing e em análises de tempo Cliente vs. Interno.</p>
              </div>
              <Switch checked={!!f.works_with_clients} onCheckedChange={(v) => set('works_with_clients', v)} />
            </label>
          </div>

          {isENIOwner && (
            <>
              <Separator />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">💰 Ordenado</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Valor mensal (€)</label>
                  <Input type="number" placeholder="0" value={contract.monthly_value} onChange={e => setC('monthly_value', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Dia do mês de pagamento</label>
                  <Input type="number" min={1} max={31} placeholder="1" value={contract.payment_day} onChange={e => setC('payment_day', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data de início</label>
                  <Input type="date" value={contract.start_date} onChange={e => handleStartDateChange(e.target.value)} />
                </div>
              </div>
              {/* Document upload for ENI Owner */}
              <ContractDocUpload contract={contract} setC={setC} uploading={uploadingContract} setUploading={setUploadingContract} memberId={initial?.id} />
            </>
          )}

          {!isENIOwner && (
            <>
              <Separator />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">📄 Contrato & Pagamento</h3>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Vínculo</span>
                <p className="text-[10px] text-muted-foreground">Define o tipo de relação e o contrato associado.</p>
                <Select
                  value={bondFromContractType(contract.contract_type)}
                  onValueChange={(v) => {
                    const opt = BOND_OPTIONS.find(o => o.value === v);
                    if (!opt) return;
                    setC('contract_type', opt.contract_type);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOND_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs py-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{o.label}</span>
                          <span className="text-[10px] text-muted-foreground">{o.hint}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isEdit && (
                <div>
                  <label className="text-xs text-muted-foreground">Duração do contrato</label>
                  <Select value={contract.duration} onValueChange={handleDurationChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
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
              {contract.contract_type === 'contrato_trabalho' && (
                <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-medium">Taxa SS empresa (%)</label>
                      <p className="text-[10px] text-muted-foreground">Encargo da entidade patronal sobre o salário bruto. Default 23,75% (PT).</p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 h-9 text-right"
                      value={typeof contract.ss_employer_rate === 'number' ? (contract.ss_employer_rate * 100).toFixed(2) : '23.75'}
                      onChange={e => setC('ss_employer_rate', (parseFloat(e.target.value) || 0) / 100)}
                    />
                  </div>
                  {Number(contract.monthly_value) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Custo total mensal estimado: <span className="font-semibold text-foreground">
                        {(Number(contract.monthly_value) * (1 + (Number(contract.ss_employer_rate) || 0.2375))).toFixed(2)} €
                      </span>
                      {' '}(bruto + SS empresa)
                    </p>
                  )}
                </div>
              )}
              {contract.contract_type === 'contrato_prestacao' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={contract.value_includes_vat} onCheckedChange={(v) => setC('value_includes_vat', !!v)} />
                    <span>O valor mensal já inclui IVA (23%)</span>
                  </label>
                  <div>
                    <label className="text-xs text-muted-foreground">Método de pagamento</label>
                    <Select value={contract.payment_method || ''} onValueChange={v => setC('payment_method', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
              {contract.contract_type === 'contrato_prestacao' && !isEdit && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={contract.use_custom_payment_start} onCheckedChange={(v) => setC('use_custom_payment_start', !!v)} />
                    <span>Os pagamentos começam numa data diferente da data de início do contrato</span>
                  </label>
                  {contract.use_custom_payment_start && (
                    <div>
                      <label className="text-xs text-muted-foreground">Data de início dos pagamentos</label>
                      <Input type="date" value={contract.payment_start_date} onChange={e => setC('payment_start_date', e.target.value)} />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Status do contrato</label>
                <Select value={contract.status} onValueChange={v => setC('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTRACT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">O status do membro segue automaticamente o do contrato.</p>
              </div>
              {/* Document upload */}
              <ContractDocUpload contract={contract} setC={setC} uploading={uploadingContract} setUploading={setUploadingContract} memberId={initial?.id} />
              <div>
                <label className="text-xs text-muted-foreground">Notas do contrato</label>
                <Textarea className="text-xs" rows={2} placeholder="Notas adicionais..." value={contract.notes} onChange={e => setC('notes', e.target.value)} />
              </div>
            </>
          )}

          <Button className="w-full" onClick={() => { onSave({ member: { ...initial, ...f }, contract }); onClose(false); }} disabled={!f.full_name.trim()}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
