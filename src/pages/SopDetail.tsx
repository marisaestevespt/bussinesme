import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTeamData } from '@/hooks/useTeamData';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, Save, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BackNavigation } from '@/components/BackNavigation';

const DEPARTMENTS = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'operacoes', label: 'Operações' },
  { value: 'produto_servico', label: 'Produto/Serviço' },
  { value: 'recursos_humanos', label: 'Pessoas' },
];

const SOP_STATUSES = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'off', label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
];

type ListItem = { text: string; checked?: boolean };

function parseJsonList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(v => (typeof v === 'string' ? v : String(v ?? '')));
  return [];
}

function parseCheckList(val: unknown): ListItem[] {
  if (Array.isArray(val)) {
    return val.map(v => {
      if (typeof v === 'object' && v !== null && 'text' in v) return v as ListItem;
      return { text: String(v ?? ''), checked: false };
    });
  }
  return [];
}

// ─── Editable list components ───────────────────────────────────

function EditableTextList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const update = (i: number, val: string) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm w-6 shrink-0">{i + 1}.</span>
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder} className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

function EditableBulletList({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const update = (i: number, val: string) => { const n = [...items]; n[i] = val; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground">•</span>
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder} className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

function EditableCheckList({ items, onChange }: { items: ListItem[]; onChange: (items: ListItem[]) => void }) {
  const updateText = (i: number, text: string) => { const n = [...items]; n[i] = { ...n[i], text }; onChange(n); };
  const toggleCheck = (i: number) => { const n = [...items]; n[i] = { ...n[i], checked: !n[i].checked }; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { text: '', checked: false }]);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Checkbox checked={item.checked} onCheckedChange={() => toggleCheck(i)} />
          <Input value={item.text} onChange={e => updateText(i, e.target.value)} className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3 w-3 mr-1" /> Adicionar
      </Button>
    </div>
  );
}

// ─── Table for Utilização ───────────────────────────────────────

function UtilizacaoTable({ usado, naoUsado, onChangeUsado, onChangeNaoUsado }: {
  usado: string[]; naoUsado: string[];
  onChangeUsado: (v: string[]) => void; onChangeNaoUsado: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <Label className="text-sm font-semibold mb-2 block">É usado quando:</Label>
        <EditableBulletList items={usado} onChange={onChangeUsado} placeholder="Situação..." />
      </div>
      <div>
        <Label className="text-sm font-semibold mb-2 block">Não é usado quando:</Label>
        <EditableBulletList items={naoUsado} onChange={onChangeNaoUsado} placeholder="Situação..." />
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ─── Fetch SOP ──────────────────────────────────────────────
  const { data: sop, isLoading } = useQuery({
    queryKey: ['sop', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('sops').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch linked routine if exists
  const routineId = (sop as any)?.routine_id;
  const { data: linkedRoutine } = useQuery({
    queryKey: ['linked-routine', routineId],
    queryFn: async () => {
      const { data } = await supabase.from('planning_routines').select('*').eq('id', routineId).single();
      return data;
    },
    enabled: !!routineId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['custom_roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_roles').select('*');
      if (error) throw error;
      return data;
    },
  });

  // ─── Local state ──────────────────────────────────────────────
  const [name, setName] = useState('');
  const [sopId, setSopId] = useState('');
  const [status, setStatus] = useState('para_criar');
  const [department, setDepartment] = useState('administrativo');
  const [roleId, setRoleId] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [usado, setUsado] = useState<string[]>(['']);
  const [naoUsado, setNaoUsado] = useState<string[]>(['']);
  const [inputs, setInputs] = useState<ListItem[]>([{ text: '', checked: false }]);
  const [passos, setPassos] = useState<string[]>(['', '', '', '', '', '']);
  const [decisoes, setDecisoes] = useState<string[]>(['']);
  const [outputs, setOutputs] = useState<ListItem[]>([{ text: '', checked: false }]);
  const [notas, setNotas] = useState<string[]>(['']);
  const [linkedEntityType, setLinkedEntityType] = useState('geral');
  const [linkedEntityId, setLinkedEntityId] = useState<string>('');
  const [applyToAllActiveClients, setApplyToAllActiveClients] = useState(false);

  // Detect if this is an onboarding/offboarding SOP linked to a product
  const isOnboardingSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('onboarding') && !sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isOffboardingSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('offboarding');
  }, [sop]);

  const isPaymentSop = useMemo(() => {
    if (!sop) return false;
    return (sop as any).linked_entity_type === 'produto' && (sop as any).linked_entity_id && sop.name?.toLowerCase().includes('pagamento');
  }, [sop]);

  const templateTable = isOnboardingSop ? 'product_onboarding_templates' : isOffboardingSop ? 'product_offboarding_templates' : null;
  const linkedProductId = (sop as any)?.linked_entity_id;

  // Payment methods for "Gestão de Pagamentos" SOP
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['product-payment-methods', linkedProductId],
    queryFn: async () => {
      if (!linkedProductId) return [];
      const { data } = await supabase.from('product_payment_methods' as any).select('*').eq('product_id', linkedProductId);
      return (data || []) as any[];
    },
    enabled: isPaymentSop && !!linkedProductId,
  });

  const { data: templateRows = [] } = useQuery({
    queryKey: ['sop-template-rows', templateTable, linkedProductId],
    queryFn: async () => {
      if (!templateTable || !linkedProductId) return [];
      const { data } = await supabase.from(templateTable as any).select('*').eq('product_id', linkedProductId).order('sort_order');
      return (data || []) as any[];
    },
    enabled: !!templateTable && !!linkedProductId,
  });

  // Entity lists for selects
  const { data: productsList = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => { const { data } = await supabase.from('products').select('id, name'); return data || []; },
  });
  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data } = await supabase.from('clients').select('id, full_name'); return data || []; },
  });
  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => { const { data } = await supabase.from('projects').select('id, name'); return data || []; },
  });

  useEffect(() => {
    if (!sop) return;
    setName(sop.name);
    setSopId(sop.sop_id);
    setStatus(sop.status);
    setDepartment(sop.department);
    setRoleId(sop.custom_role_id || '');
    setProductName(sop.product_name || '');
    setCreatedAt(sop.created_at ? format(new Date(sop.created_at), 'yyyy-MM-dd') : '');
    setObjetivo(sop.objetivo || '');
    setUsado(parseJsonList(sop.utilizacao_usado).length ? parseJsonList(sop.utilizacao_usado) : ['']);
    setNaoUsado(parseJsonList(sop.utilizacao_nao_usado).length ? parseJsonList(sop.utilizacao_nao_usado) : ['']);
    setInputs(parseCheckList(sop.inputs).length ? parseCheckList(sop.inputs) : [{ text: '', checked: false }]);
    setPassos(parseJsonList(sop.passos).length ? parseJsonList(sop.passos) : ['', '', '', '', '', '']);
    setDecisoes(parseJsonList(sop.decisoes).length ? parseJsonList(sop.decisoes) : ['']);
    setOutputs(parseCheckList(sop.outputs).length ? parseCheckList(sop.outputs) : [{ text: '', checked: false }]);
    setNotas(parseJsonList(sop.notas).length ? parseJsonList(sop.notas) : ['']);
    setLinkedEntityType((sop as any).linked_entity_type || 'geral');
    setLinkedEntityId((sop as any).linked_entity_id || '');
    setApplyToAllActiveClients((sop as any).apply_to_all_active_clients || false);
  }, [sop]);

  // ─── Save ───────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').update({
        name,
        sop_id: sopId,
        status,
        department,
        custom_role_id: roleId || null,
        product_name: productName || null,
        objetivo: objetivo || null,
        utilizacao_usado: usado as any,
        utilizacao_nao_usado: naoUsado as any,
        inputs: inputs as any,
        passos: passos as any,
        decisoes: decisoes as any,
        outputs: outputs as any,
        notas: notas as any,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId || null,
        apply_to_all_active_clients: applyToAllActiveClients,
      } as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop', id] });
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      toast.success('Processo guardado');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  // ─── Template row mutations (for onboarding/offboarding SOPs) ──
  const addTemplateRow = useMutation({
    mutationFn: async () => {
      if (!templateTable || !linkedProductId) return;
      const nextOrder = templateRows.length;
      await supabase.from(templateTable as any).insert({ product_id: linkedProductId, activity: '', sort_order: nextOrder } as any);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const updateTemplateRow = useMutation({
    mutationFn: async ({ rowId, data }: { rowId: string; data: Record<string, any> }) => {
      if (!templateTable) return;
      await supabase.from(templateTable as any).update(data).eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const deleteTemplateRow = useMutation({
    mutationFn: async (rowId: string) => {
      if (!templateTable) return;
      await supabase.from(templateTable as any).delete().eq('id', rowId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sop-template-rows', templateTable, linkedProductId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sops'] });
      navigate('/hub/processos');
      toast.success('Processo eliminado');
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!sop) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Processo não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/hub/processos')}>
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusInfo = SOP_STATUSES.find(s => s.value === status) || SOP_STATUSES[0];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackNavigation parentRoute="/hub/processos" parentLabel="Processos" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Input value={sopId} onChange={e => setSopId(e.target.value)} className="w-24 font-mono text-xs h-7" />
              <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
            </div>
            <Input value={name} onChange={e => setName(e.target.value)} className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0" />
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Guardar
          </Button>
        </div>

        {/* Meta fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Departamento</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Função associada</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto associado</Label>
            <Select value={productName || '_none_'} onValueChange={v => setProductName(v === '_none_' ? '' : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">Nenhum</SelectItem>
                {productsList.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Data de criação</Label>
            <Input type="date" value={createdAt} onChange={e => setCreatedAt(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Última atualização</Label>
            <p className="text-sm pt-2">{sop.updated_at ? format(new Date(sop.updated_at), "dd MMM yyyy, HH:mm", { locale: pt }) : '—'}</p>
          </div>
        </div>

        {/* Routine info */}
        {linkedRoutine && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-violet-100 text-violet-800 border-violet-200 border text-xs px-3 py-1">
              🔄 Rotina {linkedRoutine.recurrence_type === 'semanal'
                ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][(linkedRoutine as any).weekday || 0]} feira`
                : `Mensal — dia ${(linkedRoutine as any).month_day}`}
              {(linkedRoutine as any).hour_time ? ` às ${String((linkedRoutine as any).hour_time).slice(0, 5)}` : ''}
            </Badge>
            <Badge variant={linkedRoutine.active ? 'default' : 'secondary'} className="text-[10px]">
              {linkedRoutine.active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
        )}

        {/* Linked entity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tipo de ligação</Label>
            <Select value={linkedEntityType} onValueChange={v => { setLinkedEntityType(v); setLinkedEntityId(''); setApplyToAllActiveClients(false); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="produto">Produto</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {linkedEntityType === 'produto' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Produto</Label>
                <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {productsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={applyToAllActiveClients} onCheckedChange={setApplyToAllActiveClients} id="apply-all-clients" />
                <Label htmlFor="apply-all-clients" className="text-xs cursor-pointer">Aplicar a todos os clientes ativos</Label>
              </div>
            </>
          )}
          {linkedEntityType === 'cliente' && (
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {linkedEntityType === 'projeto' && (
            <div>
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <Select value={linkedEntityId} onValueChange={setLinkedEntityId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <section>
          <h3 className="text-lg font-semibold mb-2">1. Objetivo</h3>
          <Textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Descrever o objetivo deste SOP..." rows={3} />
        </section>

        {/* 2. Utilização */}
        <section>
          <h3 className="text-lg font-semibold mb-2">2. Utilização</h3>
          <UtilizacaoTable usado={usado} naoUsado={naoUsado} onChangeUsado={setUsado} onChangeNaoUsado={setNaoUsado} />
        </section>

        {/* 3. Inputs Necessários */}
        <section>
          <h3 className="text-lg font-semibold mb-1">3. Inputs Necessários</h3>
          <p className="text-sm text-amber-600 mb-3">⚠️ Se algum item estiver em falta, não iniciar.</p>
          <EditableCheckList items={inputs} onChange={setInputs} />
        </section>

        {/* 4. Passos do Processo */}
        <section>
          <h3 className="text-lg font-semibold mb-2">4. Passos do Processo</h3>
          <EditableTextList items={passos} onChange={setPassos} placeholder="Descrever passo..." />
        </section>

        {/* Template de Onboarding/Offboarding (structured steps for client automation) */}
        {(isOnboardingSop || isOffboardingSop) && (
          <section>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {isOnboardingSop ? 'Template de Onboarding de Clientes' : 'Template de Offboarding de Clientes'}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => addTemplateRow.mutate()}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Passo
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Estes passos serão copiados automaticamente para cada cliente associado a este produto.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fase</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Regra</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateRows.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem passos definidos</TableCell></TableRow>
                    )}
                    {templateRows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input defaultValue={row.phase || ''} placeholder="Fase" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { phase: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={row.activity || ''} placeholder="Atividade" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { activity: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={row.responsible || ''} placeholder="Responsável" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { responsible: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input defaultValue={row.rule || ''} placeholder="Regra" onBlur={e => updateTemplateRow.mutate({ rowId: row.id, data: { rule: e.target.value } })} className="border-none shadow-none h-auto p-0 text-sm" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTemplateRow.mutate(row.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Formas de Pagamento (for "Gestão de Pagamentos" SOP) */}
        {isPaymentSop && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Seleciona as formas de pagamento disponíveis para este produto. Ao associar a um cliente, apenas estas opções aparecerão.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'pagamento_total', label: 'Pagamento Total' },
                    { value: 'entrada_prestacoes', label: 'Pagamento Entrada + Prestações' },
                    { value: 'prestacoes', label: 'Pagamento Prestações' },
                    { value: 'avenca_mensal', label: 'Pagamento Avença Mensal' },
                  ].map(opt => {
                    const isActive = paymentMethods.some((pm: any) => pm.payment_method === opt.value);
                    return (
                      <label key={opt.value} className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        isActive ? "border-primary bg-primary/5" : "border-border"
                      )}>
                        <Checkbox
                          checked={isActive}
                          onCheckedChange={async (checked) => {
                            if (checked) {
                              await supabase.from('product_payment_methods' as any).insert({ product_id: linkedProductId, payment_method: opt.value });
                            } else {
                              const row = paymentMethods.find((pm: any) => pm.payment_method === opt.value);
                              if (row) await supabase.from('product_payment_methods' as any).delete().eq('id', row.id);
                            }
                            queryClient.invalidateQueries({ queryKey: ['product-payment-methods', linkedProductId] });
                          }}
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <h3 className="text-lg font-semibold mb-2">5. Decisões / Exceções</h3>
          <EditableBulletList items={decisoes} onChange={setDecisoes} placeholder="(se acontecer X, fazer Y)" />
        </section>

        {/* 6. Outputs Finais */}
        <section>
          <h3 className="text-lg font-semibold mb-1">6. Outputs Finais</h3>
          <p className="text-sm text-emerald-600 mb-3">✅ O processo considera-se concluído quando:</p>
          <EditableCheckList items={outputs} onChange={setOutputs} />
        </section>

        {/* 7. Notas */}
        <section>
          <h3 className="text-lg font-semibold mb-2">7. Notas</h3>
          <EditableBulletList items={notas} onChange={setNotas} placeholder="Nota..." />
        </section>

        {/* Delete */}
        <div className="border-t pt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar processo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar processo?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser revertida.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
}
