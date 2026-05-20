import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X, Gauge, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useDepartmentKpis, type DepartmentKpi } from '@/hooks/useDepartmentKpis';
import { VALUE_SOURCES, usePlanningData } from '@/hooks/usePlanningData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SourceFilterFields } from './SourceFilterFields';
import { confirmDestructive } from '@/lib/confirmDestructive';

interface Props {
  department: string;
  /** Etiqueta para mostrar (opcional) */
  departmentLabel?: string;
}

function fmt(v: number | null | undefined, unit?: string | null) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  const s = Math.abs(n) >= 1000 ? n.toLocaleString('pt-PT') : String(n);
  return unit ? `${s} ${unit}` : s;
}

/**
 * Bloco de KPIs permanentes de um departamento. KPIs medem produtividade
 * e sucesso de forma contínua; podem depois ser referenciados como Key
 * Results de objetivos via `objective_metrics.linked_kpi_id`.
 */
export function DepartmentKpisSection({ department, departmentLabel }: Props) {
  const { list, upsert, remove } = useDepartmentKpis(department);
  /** null = closed | 'new' = creating | string = editing kpi id */
  const [dialogState, setDialogState] = useState<null | 'new' | string>(null);
  const editingKpi = typeof dialogState === 'string' && dialogState !== 'new'
    ? list.find((k) => k.id === dialogState)
    : null;
  const dialogOpen = dialogState !== null;

  return (
    <Card className="hq-card">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-semibold">KPIs do departamento</p>
              <p className="text-xs text-muted-foreground">
                Métricas permanentes de produtividade e sucesso{departmentLabel ? ` para ${departmentLabel}` : ''}.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDialogState('new')}>
            <Plus className="h-4 w-4 mr-1" /> Novo KPI
          </Button>
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Ainda sem KPIs definidos. Cria o primeiro para começar a medir.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  <th className="font-medium px-2 py-2">KPI</th>
                  <th className="font-medium px-2 py-2 text-right">Atual</th>
                  <th className="font-medium px-2 py-2 text-right">Meta mensal</th>
                  <th className="font-medium px-2 py-2 text-right">Trimestral</th>
                  <th className="font-medium px-2 py-2 text-right">Anual</th>
                  <th className="font-medium px-2 py-2">Fonte</th>
                  <th className="font-medium px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-border/30 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => setDialogState(k.id)}
                  >
                    <td className="px-2 py-2.5">
                      <p className="font-medium leading-snug">{k.name}</p>
                      {k.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{k.description}</p>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold">
                      {fmt(k.current_value, k.unit)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(k.target_value, k.unit)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(k.quarterly_target, k.unit)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmt(k.annual_target, k.unit)}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="outline" className="text-[9px]">{k.value_source}</Badge>
                    </td>
                    <td className="px-2 py-2.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirmDestructive({ title: 'Remover KPI?', description: 'Esta ação não pode ser desfeita.' })) {
                            remove.mutate(k.id);
                          }
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogState(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingKpi ? 'Editar KPI' : 'Novo KPI'}</DialogTitle>
              <DialogDescription>
                Define como medimos esta métrica e qual é a meta a atingir.
              </DialogDescription>
            </DialogHeader>
            {dialogOpen && (
              <KpiForm
                initial={editingKpi || { department }}
                year={new Date().getFullYear()}
                onCancel={() => setDialogState(null)}
                onSave={(payload) => upsert.mutate(payload, { onSuccess: () => setDialogState(null) })}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function KpiForm({
  initial,
  onCancel,
  onSave,
  year,
}: {
  initial: Partial<DepartmentKpi> & { department: string };
  onCancel: () => void;
  onSave: (payload: Partial<DepartmentKpi> & { department: string; name: string }) => void;
  year: number;
}) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [unit, setUnit] = useState(initial.unit || '');
  const [target, setTarget] = useState(initial.target_value != null ? String(initial.target_value) : '');
  const [current, setCurrent] = useState(initial.current_value != null ? String(initial.current_value) : '');
  const [valueSource, setValueSource] = useState<string>(initial.value_source || 'manual');
  const [sourceFilter, setSourceFilter] = useState<Record<string, string>>(
    (initial.source_filter as Record<string, string>) || {},
  );
  const [objectiveId, setObjectiveId] = useState<string>(initial.objective_id ?? '');
  const [quarterlyTarget, setQuarterlyTarget] = useState<string>(
    initial.quarterly_target != null ? String(initial.quarterly_target) : '',
  );
  const [annualTarget, setAnnualTarget] = useState<string>(
    initial.annual_target != null ? String(initial.annual_target) : '',
  );
  const planning = usePlanningData(year);
  const objectives = (planning.objectives.data || []).filter(
    (o: any) => !o.area || o.area === initial.department || o.area === 'geral',
  );

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: initial.id,
      department: initial.department,
      name: name.trim(),
      description: description || null,
      unit: unit || null,
      target_value: target ? Number(target) : null,
      current_value: current ? Number(current) : 0,
      value_source: valueSource,
      source_filter: sourceFilter,
      is_active: true,
      objective_id: objectiveId || null,
      quarterly_target: quarterlyTarget === '' ? null : Number(quarterlyTarget),
      annual_target: annualTarget === '' ? null : Number(annualTarget),
    });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: NPS, Taxa de conversão" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Unidade</label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, €, pontos…" />
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Como medimos e porquê" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Valor atual</label>
          <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Meta mensal</label>
          <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Meta trimestral</label>
          <Input type="number" value={quarterlyTarget} onChange={(e) => setQuarterlyTarget(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Meta anual</label>
          <Input type="number" value={annualTarget} onChange={(e) => setAnnualTarget(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Objetivo anual associado</label>
        <Select value={objectiveId || '__none__'} onValueChange={(v) => setObjectiveId(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="(nenhum)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sem ligação —</SelectItem>
            {objectives.map((o: any) => (
              <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">Quando ligado, valores mensais alimentam o objetivo no Planeamento.</p>
      </div>
      <div className="space-y-2 rounded border border-border/40 bg-background p-3">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Fonte do valor atual</label>
        </div>
        <Select value={valueSource} onValueChange={(v) => { setValueSource(v); setSourceFilter({}); }}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VALUE_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {VALUE_SOURCES.find((s) => s.value === valueSource)?.desc && (
          <p className="text-[10px] text-muted-foreground">{VALUE_SOURCES.find((s) => s.value === valueSource)?.desc}</p>
        )}
        <SourceFilterFields source={valueSource} sourceFilter={sourceFilter} onChange={setSourceFilter} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()}>
          <Save className="h-3.5 w-3.5 mr-1" /> Guardar
        </Button>
      </div>
    </div>
  );
}