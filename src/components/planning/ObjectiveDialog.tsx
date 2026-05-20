import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import { PLAN_AREAS, PLAN_STATUSES, VALUE_SOURCES, MEASUREMENT_TYPES } from '@/hooks/usePlanningData';
import { useProducts } from '@/hooks/useProducts';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SourceFilterFields, getSourceFilters } from './SourceFilterFields';

const DEFAULTS: any = {
  title: '', description: '', area: 'outro', status: 'por_iniciar', deadline: '',
  objective_type: 'quantitativo', target_value: '', target_unit: '€', current_value: '', value_source: 'manual', product_id: '',
  measurement_type: 'acumulativo', primary_metric_id: '', source_filter: {},
};

export function ObjectiveDialog({ open, onClose, initial, onSave }: any) {
  const [form, setForm] = useState({ ...DEFAULTS });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const { products } = useProducts();
  const productsList = products.data || [];
  const [quickMode, setQuickMode] = useState(true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (k: string) => setTouched(p => ({ ...p, [k]: true }));

  useEffect(() => {
    setForm({ ...DEFAULTS, ...(initial || {}), source_filter: initial?.source_filter || {} });
    setTouched({});
    // Edição de objetivo existente → mostra modo avançado por defeito
    setQuickMode(!initial?.id);
  }, [initial, open]);

  const hasContextFilters = getSourceFilters(form.value_source).length > 0;

  // ─── Inline validation ───
  const errors: Record<string, string> = {};
  if (!form.title?.toString().trim()) errors.title = 'Dá um título claro ao objetivo.';
  if (form.objective_type === 'quantitativo') {
    const tv = Number(form.target_value);
    if (form.target_value === '' || form.target_value === null || form.target_value === undefined) {
      errors.target_value = 'Define o valor alvo.';
    } else if (!Number.isFinite(tv) || tv <= 0) {
      errors.target_value = 'O valor alvo tem de ser um número positivo.';
    }
    if (!form.target_unit?.toString().trim()) errors.target_unit = 'Indica a unidade (€, leads, %…).';
  }
  if (form.deadline) {
    const d = parseISO(form.deadline);
    if (!isValid(d)) errors.deadline = 'Data inválida.';
  }
  const isValidForm = Object.keys(errors).length === 0;

  const showError = (k: string) => touched[k] && errors[k];

  // ─── Group VALUE_SOURCES by area for clarity ───
  const sourcesGrouped = useMemo(() => {
    const groups: Record<string, typeof VALUE_SOURCES> = {};
    VALUE_SOURCES.forEach(s => {
      const k = s.area || 'manual';
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    const order = ['manual', 'comercial', 'marketing', 'financeiro', 'operacao', 'clientes', 'produtos', 'equipa', 'geral'];
    const labelFor: Record<string, string> = {
      manual: 'Geral',
      comercial: 'Comercial', marketing: 'Marketing', financeiro: 'Financeiro',
      operacao: 'Operação', clientes: 'Clientes', produtos: 'Produtos',
      equipa: 'Equipa', geral: 'Indicadores transversais',
    };
    return order.filter(k => groups[k]).map(k => ({ key: k, label: labelFor[k] || k, items: groups[k] }));
  }, []);

  const deadlineDate = form.deadline ? parseISO(form.deadline) : undefined;
  const validDeadline = deadlineDate && isValid(deadlineDate) ? deadlineDate : undefined;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{initial?.id ? 'Editar Objetivo' : 'Novo Objetivo'}</DialogTitle>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <span>Modo rápido</span>
              <Switch checked={quickMode} onCheckedChange={setQuickMode} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {quickMode
              ? 'Apenas o essencial: título, área e valor alvo. Podes acrescentar detalhes depois.'
              : 'Todos os campos disponíveis, incluindo medição, fonte e filtros.'}
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              onBlur={() => markTouched('title')}
              placeholder="Ex: Atingir 200k€ de faturação em 2026"
              aria-invalid={!!showError('title')}
              className={cn(showError('title') && 'border-destructive focus-visible:border-destructive')}
            />
            {showError('title') && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          {!quickMode && (
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Porquê este objetivo? Que impacto traz ao negócio?" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Área</Label>
              <Select value={form.area} onValueChange={v => set('area', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_AREAS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.objective_type} onValueChange={v => set('objective_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantitativo">Quantitativo</SelectItem>
                  <SelectItem value="qualitativo">Qualitativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!quickMode && (
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className={cn(quickMode && 'col-span-2')}>
              <Label>Data limite</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onBlur={() => markTouched('deadline')}
                    className={cn(
                      'w-full justify-start text-left font-normal h-10',
                      !validDeadline && 'text-muted-foreground',
                      showError('deadline') && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                    {validDeadline ? format(validDeadline, "d 'de' MMMM yyyy", { locale: pt }) : 'Escolher data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={pt}
                    selected={validDeadline}
                    onSelect={(d) => set('deadline', d ? format(d, 'yyyy-MM-dd') : '')}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                  {form.deadline && (
                    <div className="border-t p-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => set('deadline', '')}>
                        Limpar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {showError('deadline') && <p className="text-xs text-destructive mt-1">{errors.deadline}</p>}
            </div>
          </div>

          {form.objective_type === 'quantitativo' && (
            <>
              {!quickMode && (
                <div><Label>Tipo de medição</Label>
                  <Select value={form.measurement_type || 'acumulativo'} onValueChange={v => set('measurement_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MEASUREMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.measurement_type === 'progressivo'
                      ? 'Valor absoluto atual (ex: seguidores, clientes ativos, NPS)'
                      : 'Soma de registos no período (ex: faturação, vendas, leads)'}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Valor alvo <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    value={form.target_value || ''}
                    onChange={e => set('target_value', e.target.value)}
                    onBlur={() => markTouched('target_value')}
                    placeholder="Ex: 200000"
                    aria-invalid={!!showError('target_value')}
                    className={cn(showError('target_value') && 'border-destructive focus-visible:border-destructive')}
                  />
                  {showError('target_value') && <p className="text-xs text-destructive mt-1">{errors.target_value}</p>}
                </div>
                <div>
                  <Label>Unidade <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.target_unit || ''}
                    onChange={e => set('target_unit', e.target.value)}
                    onBlur={() => markTouched('target_unit')}
                    placeholder="€, seguidores..."
                    aria-invalid={!!showError('target_unit')}
                    className={cn(showError('target_unit') && 'border-destructive focus-visible:border-destructive')}
                  />
                  {showError('target_unit') && <p className="text-xs text-destructive mt-1">{errors.target_unit}</p>}
                </div>
                {!quickMode && (
                  <div><Label>Fonte valor atual</Label>
                    <Select value={form.value_source || 'manual'} onValueChange={v => { set('value_source', v); set('source_filter', {}); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        {sourcesGrouped.map(g => (
                          <SelectGroup key={g.key}>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</SelectLabel>
                            {g.items.map(s => (
                              <SelectItem key={s.value} value={s.value}>
                                <span>{s.label}</span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {VALUE_SOURCES.find(s => s.value === form.value_source)?.desc && (
                      <p className="text-[10px] text-muted-foreground mt-1">{VALUE_SOURCES.find(s => s.value === form.value_source)?.desc}</p>
                    )}
                  </div>
                )}
              </div>
              {!quickMode && form.value_source === 'manual' && (
                <div><Label>Valor atual (manual)</Label><Input type="number" value={form.current_value || ''} onChange={e => set('current_value', e.target.value)} /></div>
              )}
              {!quickMode && form.value_source === 'metrica' && (
                <p className="text-xs text-muted-foreground">O progresso será calculado a partir da métrica principal associada ao objetivo. Pode associá-la depois de criar o objetivo.</p>
              )}
              {!quickMode && (form.value_source === 'bd_vendas' || form.value_source === 'bd_crm') && (
                <div><Label>Produto associado</Label>
                  <Select value={form.product_id || 'none'} onValueChange={v => set('product_id', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos os produtos</SelectItem>
                      {productsList.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!quickMode && hasContextFilters && (
                <div>
                  <Label className="text-xs text-muted-foreground">Filtros (opcional)</Label>
                  <SourceFilterFields
                    source={form.value_source}
                    sourceFilter={form.source_filter || {}}
                    onChange={sf => set('source_filter', sf)}
                  />
                </div>
              )}
            </>
          )}

          {!isValidForm && Object.keys(touched).length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Preenche os campos obrigatórios para guardar.
            </p>
          )}
          <Button
            className="w-full"
            onClick={() => {
              // Marca todos os campos para revelar erros eventuais
              setTouched({ title: true, target_value: true, target_unit: true, deadline: true });
              if (!isValidForm) return;
              onSave({
                ...initial, ...form,
                product_id: form.product_id || null,
                primary_metric_id: form.primary_metric_id || null,
                measurement_type: form.objective_type === 'quantitativo' ? (form.measurement_type || 'acumulativo') : null,
                source_filter: Object.keys(form.source_filter || {}).length > 0 ? form.source_filter : null,
              });
            }}
            disabled={!isValidForm}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}