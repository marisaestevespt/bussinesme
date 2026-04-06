import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description?: string;
  is_recurring?: boolean;
  sort_order?: number;
  phase_id?: string | null;
}

interface Phase {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  linked_sop_id?: string | null;
}

interface Props {
  deliverableTemplates: Template[];
  isOwner: boolean;
  productId: string;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

// ─── Deliverable Row ─────────────────────────────────────────
function DeliverableRow({
  template, index, isOwner, onUpdate, onDelete,
}: {
  template: Template; index: number; isOwner: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description || '');
  const nameRef = useRef(template.name);
  const descRef = useRef(template.description || '');

  useEffect(() => {
    if (template.name !== nameRef.current) { nameRef.current = template.name; setName(template.name); }
  }, [template.name]);
  useEffect(() => {
    const d = template.description || '';
    if (d !== descRef.current) { descRef.current = d; setDesc(d); }
  }, [template.description]);

  return (
    <div className="flex items-center gap-3 group pl-6">
      <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}.</span>
      <Input value={name} onChange={e => setName(e.target.value)}
        onBlur={() => { const t = name.trim(); if (t !== template.name) { nameRef.current = t; onUpdate(template.id, { name: t }); } }}
        className="flex-1 h-9 text-sm" placeholder="Nome da entrega..." readOnly={!isOwner} />
      <Input value={desc} onChange={e => setDesc(e.target.value)}
        onBlur={() => { if (desc !== (template.description || '')) { descRef.current = desc; onUpdate(template.id, { description: desc }); } }}
        className="flex-1 h-9 text-sm" placeholder="Descrição (opcional)" readOnly={!isOwner} />
      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-xs text-muted-foreground">
        <Checkbox checked={!!template.is_recurring} onCheckedChange={(c) => onUpdate(template.id, { is_recurring: !!c })} disabled={!isOwner} />
        Recorrente
      </label>
      {isOwner && (
        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => onDelete(template.id)}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ─── Phase Card ──────────────────────────────────────────────
function PhaseCard({
  phase, deliverables, sops, isOwner, productId,
  onUpdatePhase, onDeletePhase, onAddDeliverable, onUpdateDeliverable, onDeleteDeliverable,
}: {
  phase: Phase; deliverables: Template[]; sops: Array<{ id: string; name: string }>;
  isOwner: boolean; productId: string;
  onUpdatePhase: (id: string, data: Record<string, unknown>) => void;
  onDeletePhase: (id: string) => void;
  onAddDeliverable: (phaseId: string) => void;
  onUpdateDeliverable: (id: string, data: Record<string, unknown>) => void;
  onDeleteDeliverable: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [name, setName] = useState(phase.name);

  useEffect(() => setName(phase.name), [phase.name]);

  return (
    <Card className="border-l-4 border-l-primary/30">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          <Badge variant="outline" className="text-[10px] shrink-0">Fase {phase.sort_order + 1}</Badge>
          <Input value={name} onChange={e => setName(e.target.value)}
            onBlur={() => { const t = name.trim(); if (t !== phase.name) onUpdatePhase(phase.id, { name: t }); }}
            className="h-7 text-sm font-medium border-none shadow-none p-0 focus-visible:ring-0"
            placeholder="Nome da fase..." readOnly={!isOwner} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sops.length > 0 && (
            <Select value={phase.linked_sop_id || 'none'}
              onValueChange={(v) => onUpdatePhase(phase.id, { linked_sop_id: v === 'none' ? null : v })}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Ligar SOP..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem SOP</SelectItem>
                {sops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {isOwner && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDeletePhase(phase.id)}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pb-3 pt-0 px-4 space-y-2">
          {deliverables.length === 0 && (
            <p className="text-xs text-muted-foreground italic pl-6 py-2">Sem entregas nesta fase.</p>
          )}
          {deliverables.map((d, i) => (
            <DeliverableRow key={d.id} template={d} index={i} isOwner={isOwner}
              onUpdate={onUpdateDeliverable} onDelete={onDeleteDeliverable} />
          ))}
          {isOwner && (
            <Button size="sm" variant="ghost" className="text-xs ml-6" onClick={() => onAddDeliverable(phase.id)}>
              <Plus className="h-3 w-3 mr-1" /> Entrega
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Section ────────────────────────────────────────────
export function ProductEntregasSection({ deliverableTemplates, isOwner, productId, onAdd, onUpdate, onDelete }: Props) {
  const qc = useQueryClient();
  const phaseKey = ['product-phases', productId];

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: phaseKey,
    queryFn: async () => {
      const { data } = await (supabase as any).from('product_phases').select('*').eq('product_id', productId).order('sort_order');
      return (data || []) as Phase[];
    },
  });

  // Fetch SOPs for linking
  const { data: sops = [] } = useQuery({
    queryKey: ['sops-list-mini'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('id, name');
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  const addPhase = useMutation({
    mutationFn: async () => {
      await supabase.from('product_phases' as any).insert({ product_id: productId, name: '', sort_order: phases.length } as any);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: phaseKey }),
  });

  const updatePhase = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, unknown>) => {
      await supabase.from('product_phases' as any).update(fields as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: phaseKey }),
  });

  const deletePhase = useMutation({
    mutationFn: async (id: string) => {
      // Unlink deliverables first
      await supabase.from('product_deliverable_templates' as any).update({ phase_id: null } as any).eq('phase_id', id);
      await supabase.from('product_phases' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: phaseKey });
      qc.invalidateQueries({ queryKey: ['product-deliverable-templates', productId] });
    },
  });

  const addDeliverableToPhase = (phaseId: string) => {
    const phaseDeliverables = deliverableTemplates.filter(d => d.phase_id === phaseId);
    supabase.from('product_deliverable_templates' as any).insert({
      product_id: productId, name: '', sort_order: phaseDeliverables.length, phase_id: phaseId,
    } as any).then(() => {
      qc.invalidateQueries({ queryKey: ['product-deliverable-templates', productId] });
    });
  };

  // Group deliverables by phase
  const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order);
  

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Fases e Entregas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Define as fases do produto e as entregas dentro de cada uma.</p>
        </div>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => addPhase.mutate()}>
            <Plus className="h-3 w-3 mr-1" /> Fase
          </Button>
        )}
      </div>

      {sortedPhases.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground italic">Nenhuma fase definida. Cria fases para organizar as entregas deste produto.</p>
          </CardContent>
        </Card>
      )}

      {sortedPhases.map(phase => {
        const phaseDeliverables = deliverableTemplates
          .filter(d => d.phase_id === phase.id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return (
          <PhaseCard key={phase.id} phase={phase} deliverables={phaseDeliverables} sops={sops}
            isOwner={isOwner} productId={productId}
            onUpdatePhase={(id, data) => updatePhase.mutate({ id, ...data })}
            onDeletePhase={(id) => deletePhase.mutate(id)}
            onAddDeliverable={addDeliverableToPhase}
            onUpdateDeliverable={onUpdate} onDeleteDeliverable={onDelete} />
        );
      })}

    </div>
  );
}
