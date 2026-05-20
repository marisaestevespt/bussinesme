import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PLAN_AREAS, PLAN_STATUSES, VALUE_SOURCES, MEASUREMENT_TYPES } from '@/hooks/usePlanningData';
import { useProducts } from '@/hooks/useProducts';
import { Label } from '@/components/ui/label';
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

  useEffect(() => {
    setForm({ ...DEFAULTS, ...(initial || {}), source_filter: initial?.source_filter || {} });
  }, [initial, open]);

  const hasContextFilters = getSourceFilters(form.value_source).length > 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? 'Editar Objetivo' : 'Novo Objetivo'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Título</Label><Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Atingir 200k€ de faturação em 2026" /></div>
          <div><Label>Descrição</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Porquê este objetivo? Que impacto traz ao negócio?" /></div>
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
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data limite</Label><Input type="date" value={form.deadline || ''} onChange={e => set('deadline', e.target.value)} /></div>
          </div>

          {form.objective_type === 'quantitativo' && (
            <>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Valor alvo</Label><Input type="number" value={form.target_value || ''} onChange={e => set('target_value', e.target.value)} placeholder="Ex: 200000" /></div>
                <div><Label>Unidade</Label><Input value={form.target_unit || ''} onChange={e => set('target_unit', e.target.value)} placeholder="€, seguidores..." /></div>
                <div><Label>Fonte valor atual</Label>
                  <Select value={form.value_source || 'manual'} onValueChange={v => { set('value_source', v); set('source_filter', {}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALUE_SOURCES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          <span>{s.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {VALUE_SOURCES.find(s => s.value === form.value_source)?.desc && (
                    <p className="text-[10px] text-muted-foreground mt-1">{VALUE_SOURCES.find(s => s.value === form.value_source)?.desc}</p>
                  )}
                </div>
              </div>
              {form.value_source === 'manual' && (
                <div><Label>Valor atual (manual)</Label><Input type="number" value={form.current_value || ''} onChange={e => set('current_value', e.target.value)} /></div>
              )}
              {form.value_source === 'metrica' && (
                <p className="text-xs text-muted-foreground">O progresso será calculado a partir da métrica principal associada ao objetivo. Pode associá-la depois de criar o objetivo.</p>
              )}
              {(form.value_source === 'bd_vendas' || form.value_source === 'bd_crm') && (
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
              {hasContextFilters && (
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

          <Button className="w-full" onClick={() => onSave({
            ...initial, ...form,
            product_id: form.product_id || null,
            primary_metric_id: form.primary_metric_id || null,
            measurement_type: form.objective_type === 'quantitativo' ? (form.measurement_type || 'acumulativo') : null,
            source_filter: Object.keys(form.source_filter || {}).length > 0 ? form.source_filter : null,
          })} disabled={!form.title?.toString().trim()}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}