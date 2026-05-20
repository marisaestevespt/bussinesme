import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, Save, X, Gauge } from 'lucide-react';
import { useDepartmentKpis, type DepartmentKpi } from '@/hooks/useDepartmentKpis';
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
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

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
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo KPI
            </Button>
          )}
        </div>

        {adding && (
          <KpiForm
            initial={{ department }}
            onCancel={() => setAdding(false)}
            onSave={(payload) => {
              upsert.mutate(payload, { onSuccess: () => setAdding(false) });
            }}
          />
        )}

        {list.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Ainda sem KPIs definidos. Cria o primeiro para começar a medir.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
          {list.map((k) => {
            if (editing === k.id) {
              return (
                <div key={k.id} className="col-span-full">
                  <KpiForm
                    initial={k}
                    onCancel={() => setEditing(null)}
                    onSave={(payload) => upsert.mutate(payload, { onSuccess: () => setEditing(null) })}
                  />
                </div>
              );
            }
            const pct = k.target_value && Number(k.target_value) > 0
              ? Math.min(100, Math.round((Number(k.current_value || 0) / Number(k.target_value)) * 100))
              : 0;
            return (
              <Card key={k.id} className="hq-card">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug">{k.name}</p>
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(k.id)} aria-label="Editar">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={async () => {
                          if (await confirmDestructive({ title: 'Remover KPI?', description: 'Esta ação não pode ser desfeita.' })) {
                            remove.mutate(k.id);
                          }
                        }}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {k.description && <p className="text-[11px] text-muted-foreground">{k.description}</p>}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold tabular-nums">{fmt(k.current_value, k.unit)}</span>
                    {k.target_value != null && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">/ {fmt(k.target_value, k.unit)}</span>
                    )}
                  </div>
                  {k.target_value != null && Number(k.target_value) > 0 && (
                    <Progress value={pct} className="h-1.5" />
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">{k.value_source}</Badge>
                    {k.last_updated_at && (
                      <span>{new Date(k.last_updated_at).toLocaleDateString('pt-PT')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Partial<DepartmentKpi> & { department: string };
  onCancel: () => void;
  onSave: (payload: Partial<DepartmentKpi> & { department: string; name: string }) => void;
}) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [unit, setUnit] = useState(initial.unit || '');
  const [target, setTarget] = useState(initial.target_value != null ? String(initial.target_value) : '');
  const [current, setCurrent] = useState(initial.current_value != null ? String(initial.current_value) : '');

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
      value_source: 'manual',
      is_active: true,
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
          <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Target</label>
          <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
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