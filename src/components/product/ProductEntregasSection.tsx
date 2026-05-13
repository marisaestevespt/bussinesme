import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, ChevronDown, ChevronRight, ChevronUp, Layers, ListChecks, Eye, EyeOff, ArrowUp, ArrowDown, CheckSquare, Users, User, Clock, Info, Pencil, Check, Repeat as RepeatIcon, Link2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { ProductTabHeader } from './_shared';
import { Repeat, FolderKanban } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description?: string;
  is_recurring?: boolean;
  sort_order?: number;
  phase_id?: string | null;
  linked_sop_id?: string | null;
  portal_visible?: boolean;
  duration_days?: number | null;
  duration_unit?: string;
  offset_days?: number | null;
  offset_trigger?: string;
  responsible_type?: string;
  responsible_role?: string | null;
  deliverable_type?: 'tarefa' | 'reuniao' | 'documento' | 'aprovacao' | 'link';
  estimated_minutes?: number | null;
  meeting_title_template?: string | null;
}

interface Phase {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  linked_sop_id?: string | null;
  duration_days?: number | null;
  duration_unit?: string;
  offset_days?: number | null;
  offset_trigger?: string;
  is_onboarding?: boolean;
  is_offboarding?: boolean;
  is_recurring?: boolean;
  recurrence_frequency?: string | null;
  recurrence_anchor_day?: number | null;
  recurrence_lead_days?: number | null;
}

interface Props {
  deliverableTemplates: Template[];
  isOwner: boolean;
  productId: string;
  isRecurring?: boolean;
  onAdd: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

// ─── Deliverable Row ─────────────────────────────────────────
function DeliverableRow({
  template, index, total, isOwner, sops, isRecurring, allowRecurring, onUpdate, onDelete, onMoveUp, onMoveDown,
}: {
  template: Template; index: number; total: number; isOwner: boolean;
  sops: Array<{ id: string; name: string }>;
  isRecurring: boolean;
  allowRecurring: boolean;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description || '');
  const [minutes, setMinutes] = useState<string>(template.estimated_minutes?.toString() || '');
  const [titleTpl, setTitleTpl] = useState(template.meeting_title_template || '');
  const [showDesc, setShowDesc] = useState<boolean>(!!template.description);
  const { data: roles = [] } = useQuery({
    queryKey: ['custom-roles-for-deliverables'],
    queryFn: async () => {
      const { data } = await supabase
        .from('custom_roles')
        .select('id, name, is_owner')
        .order('name');
      return (data || []).filter(r => !r.name.startsWith('dept_'));
    },
    staleTime: 60_000,
  });
  const nameRef = useRef(template.name);
  const descRef = useRef(template.description || '');
  const minutesRef = useRef(template.estimated_minutes ?? null);
  const titleTplRef = useRef(template.meeting_title_template || '');

  useEffect(() => {
    if (template.name !== nameRef.current) { nameRef.current = template.name; setName(template.name); }
  }, [template.name]);
  useEffect(() => {
    const d = template.description || '';
    if (d !== descRef.current) { descRef.current = d; setDesc(d); if (d) setShowDesc(true); }
  }, [template.description]);
  useEffect(() => {
    const m = template.estimated_minutes ?? null;
    if (m !== minutesRef.current) { minutesRef.current = m; setMinutes(m?.toString() || ''); }
  }, [template.estimated_minutes]);
  useEffect(() => {
    const t = template.meeting_title_template || '';
    if (t !== titleTplRef.current) { titleTplRef.current = t; setTitleTpl(t); }
  }, [template.meeting_title_template]);

  const [editing, setEditing] = useState(!template.name); // open editor for empty new rows
  const portalVisible = template.portal_visible ?? true;
  const respType = (template.responsible_type || 'equipa') as 'equipa' | 'cliente';
  const respValue = respType === 'cliente' ? '__cliente__' : (template.responsible_role || '__equipa_none__');
  const respLabel = respType === 'cliente'
    ? 'Cliente'
    : (template.responsible_role ? `Equipa · ${template.responsible_role}` : 'Equipa');
  const typeMeta: Record<string, { icon: string; label: string }> = {
    tarefa: { icon: '📋', label: 'Tarefa' },
    reuniao: { icon: '📅', label: 'Reunião' },
    documento: { icon: '📄', label: 'Documento' },
    link: { icon: '🔗', label: 'Link' },
  };
  const tMeta = typeMeta[template.deliverable_type || 'tarefa'];
  const linkedSopName = sops.find(s => s.id === template.linked_sop_id)?.name;

  // ── Static view ────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="pl-6 group">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
          <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}.</span>
          <span className="text-sm shrink-0" title={tMeta.label}>{tMeta.icon}</span>
          <span className="flex-1 text-sm font-medium truncate">{template.name || <span className="italic text-muted-foreground">Sem nome</span>}</span>
          <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
            {template.estimated_minutes != null && (
              <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal">
                <Clock className="h-2.5 w-2.5" /> {template.estimated_minutes}min
              </Badge>
            )}
            <Badge variant="outline" className={`h-5 px-1.5 gap-1 text-[10px] font-normal ${respType === 'cliente' ? 'border-warning/40 text-warning' : ''}`}>
              {respType === 'cliente' ? <User className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />} {respLabel}
            </Badge>
            {linkedSopName && (
              <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal">
                <Link2 className="h-2.5 w-2.5" /> {linkedSopName}
              </Badge>
            )}
            {isRecurring && allowRecurring && template.is_recurring && (
              <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal">
                <RepeatIcon className="h-2.5 w-2.5" /> Recorrente
              </Badge>
            )}
            {!portalVisible && (
              <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] font-normal">
                <EyeOff className="h-2.5 w-2.5" /> Oculto
              </Badge>
            )}
          </div>
          {isOwner && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
              <Button aria-label="Editar" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button aria-label="Mover para cima" size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp} disabled={index === 0}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button aria-label="Mover para baixo" size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown} disabled={index === total - 1}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button aria-label="Eliminar" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(template.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {(template.description || (template.deliverable_type === 'reuniao' && template.meeting_title_template)) && (
          <div className="pl-9 pr-2 space-y-0.5">
            {template.description && (
              <p className="text-[11px] text-muted-foreground italic">{template.description}</p>
            )}
            {template.deliverable_type === 'reuniao' && template.meeting_title_template && (
              <p className="text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wide">Título: </span>{template.meeting_title_template}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Edit view ──────────────────────────────────────────────
  const handleResponsibleChange = (v: string) => {
    if (v === '__cliente__') {
      onUpdate(template.id, { responsible_type: 'cliente', responsible_role: null });
    } else if (v === '__equipa_none__') {
      onUpdate(template.id, { responsible_type: 'equipa', responsible_role: null });
    } else {
      onUpdate(template.id, { responsible_type: 'equipa', responsible_role: v });
    }
  };

  return (
    <div className="space-y-1 pl-6 group rounded-md bg-muted/20 -mx-2 px-2 py-2 border border-border/50">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono w-6 text-right shrink-0">{index + 1}.</span>
        <Select value={template.deliverable_type || 'tarefa'}
          onValueChange={(v) => onUpdate(template.id, { deliverable_type: v })}
          disabled={!isOwner}>
          <SelectTrigger className="h-9 w-28 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tarefa">📋 Tarefa</SelectItem>
            <SelectItem value="reuniao">📅 Reunião</SelectItem>
            <SelectItem value="documento">📄 Documento</SelectItem>
            <SelectItem value="link">🔗 Link</SelectItem>
          </SelectContent>
        </Select>
        <Input value={name} onChange={e => setName(e.target.value)}
          onBlur={() => { const t = name.trim(); if (t !== template.name) { nameRef.current = t; onUpdate(template.id, { name: t }); } }}
          className="flex-1 h-9 text-sm" placeholder="Nome da entrega..." readOnly={!isOwner} />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                onBlur={() => {
                  const parsed = minutes === '' ? null : parseInt(minutes);
                  const safe = parsed !== null && !Number.isNaN(parsed) && parsed >= 0 ? parsed : null;
                  if (safe !== (template.estimated_minutes ?? null)) {
                    minutesRef.current = safe;
                    onUpdate(template.id, { estimated_minutes: safe });
                  }
                }}
                className="h-9 w-16 text-xs text-center px-1"
                placeholder="—"
                readOnly={!isOwner}
              />
              <span className="text-[10px] text-muted-foreground">min</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Tempo estimado (minutos)</TooltipContent>
        </Tooltip>
        {sops.length > 0 && (
          <Select value={template.linked_sop_id || 'none'}
            onValueChange={(v) => onUpdate(template.id, { linked_sop_id: v === 'none' ? null : v })}>
            <SelectTrigger className="h-9 text-xs w-32">
              <SelectValue placeholder="SOP..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem SOP</SelectItem>
              {sops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Mostrar" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
              onClick={() => onUpdate(template.id, { portal_visible: !(template.portal_visible ?? true) })}>
              {(template.portal_visible ?? true) ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {(template.portal_visible ?? true) ? 'Visível no portal' : 'Oculto no portal'}
          </TooltipContent>
        </Tooltip>
        <Select
          value={respValue}
          onValueChange={handleResponsibleChange}
          disabled={!isOwner}
        >
          <SelectTrigger className="h-9 w-48 text-xs shrink-0" title="Responsável">
            <SelectValue placeholder="Responsável…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__cliente__">
              <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Cliente</span>
            </SelectItem>
            <SelectItem value="__equipa_none__">
              <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Equipa (sem função)</span>
            </SelectItem>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.name}>
                <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Equipa · {r.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isRecurring && allowRecurring && (
          <label className="flex items-center gap-2 shrink-0 cursor-pointer text-xs text-muted-foreground">
            <Checkbox checked={!!template.is_recurring} onCheckedChange={(c) => onUpdate(template.id, { is_recurring: !!c })} disabled={!isOwner} />
            Recorrente
          </label>
        )}
        {isOwner && (
          <div className="flex items-center gap-0.5">
            <Button aria-label="Concluir edição" size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => setEditing(false)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button aria-label="Eliminar" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(template.id)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {showDesc ? (
        <div className="flex items-center gap-3 pl-9">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Descrição</span>
          <Input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onBlur={() => { if (desc !== (template.description || '')) { descRef.current = desc; onUpdate(template.id, { description: desc }); } }}
            placeholder="Detalhes (opcional)…"
            className="flex-1 h-8 text-xs"
            readOnly={!isOwner}
          />
        </div>
      ) : (
        isOwner && (
          <button
            type="button"
            onClick={() => setShowDesc(true)}
            className="ml-9 text-[11px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          >
            + adicionar descrição
          </button>
        )
      )}
      {template.deliverable_type === 'reuniao' && (
        <div className="flex items-center gap-3 pl-9">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">Título reunião</span>
          <Input
            value={titleTpl}
            onChange={e => setTitleTpl(e.target.value)}
            onBlur={() => {
              if (titleTpl !== (template.meeting_title_template || '')) {
                titleTplRef.current = titleTpl;
                onUpdate(template.id, { meeting_title_template: titleTpl || null });
              }
            }}
            placeholder="Ex: 🪉 | Sessão Criação de Processos | {N} | {cliente}"
            className="flex-1 h-8 text-xs"
            readOnly={!isOwner}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground cursor-help">{'{N}'} {'{cliente}'}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-xs">
              Variáveis: <b>{'{N}'}</b> = número sequencial entre reuniões iguais no projeto · <b>{'{cliente}'}</b> = nome do cliente
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

// ─── Phase Card ──────────────────────────────────────────────
function PhaseCard({
  phase, deliverables, sops, isOwner, productId, isRecurring,
  onUpdatePhase, onDeletePhase, onAddDeliverable, onUpdateDeliverable, onDeleteDeliverable, onSwapDeliverables,
}: {
  phase: Phase; deliverables: Template[]; sops: Array<{ id: string; name: string }>;
  isOwner: boolean; productId: string; isRecurring: boolean;
  onUpdatePhase: (id: string, data: Record<string, unknown>) => void;
  onDeletePhase: (id: string) => void;
  onAddDeliverable: (phaseId: string) => void;
  onUpdateDeliverable: (id: string, data: Record<string, unknown>) => void;
  onDeleteDeliverable: (id: string) => void;
  onSwapDeliverables: (idA: string, orderA: number, idB: string, orderB: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [sopExpanded, setSopExpanded] = useState(false);
  const [name, setName] = useState(phase.name);

  useEffect(() => setName(phase.name), [phase.name]);

  // Fetch SOP steps when a SOP is linked
  const { data: sopSteps = [] } = useQuery({
    queryKey: ['sop-steps', phase.linked_sop_id],
    enabled: !!phase.linked_sop_id,
    queryFn: async () => {
      const { data } = await supabase.from('sop_steps').select('id, description, responsible, sort_order')
        .eq('sop_id', phase.linked_sop_id!).order('sort_order');
      return data || [];
    },
  });

  const linkedSopName = sops.find(s => s.id === phase.linked_sop_id)?.name;

  return (
    <Card className="border-l-4 border-l-primary/30">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" aria-label="Mostrar mais" size="icon" className="h-6 w-6 shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          <Badge variant="outline" className="text-[10px] shrink-0">Fase {phase.sort_order + 1}</Badge>
          {phase.is_onboarding && <Badge variant="secondary" className="text-[10px] shrink-0 bg-warning/15 text-warning border-warning/30">Onboarding</Badge>}
          {phase.is_offboarding && <Badge variant="secondary" className="text-[10px] shrink-0 bg-destructive/15 text-destructive border-destructive/30">Offboarding</Badge>}
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
        <CardContent className="pb-3 pt-0 px-4 space-y-3">
          {/* Timeline config — clean labeled grid */}
          {isOwner && (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Quando acontece</div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Começa após</label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={0} className="h-8 w-16 text-sm text-center px-1"
                      value={phase.offset_days ?? 0}
                      onChange={e => onUpdatePhase(phase.id, { offset_days: parseInt(e.target.value) || 0 })} />
                    <span className="text-xs text-muted-foreground">{(phase.duration_unit || 'dias_uteis') === 'dias_uteis' ? 'dias úteis' : 'dias corridos'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Referência</label>
                  <Select value={phase.offset_trigger || 'inicio_projeto'}
                    onValueChange={v => onUpdatePhase(phase.id, { offset_trigger: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inicio_projeto">início do projeto</SelectItem>
                      <SelectItem value="data_conversao">data de conversão</SelectItem>
                      <SelectItem value="fase_anterior">fase anterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Duração</label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={0} className="h-8 w-16 text-sm text-center px-1"
                      value={phase.duration_days ?? ''}
                      placeholder="—"
                      onChange={e => {
                        const v = e.target.value ? parseInt(e.target.value) : null;
                        onUpdatePhase(phase.id, { duration_days: v });
                      }} />
                    <span className="text-xs text-muted-foreground">{(phase.duration_unit || 'dias_uteis') === 'dias_uteis' ? 'dias úteis' : 'dias corridos'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Tipo de dias</label>
                  <Select value={phase.duration_unit || 'dias_uteis'}
                    onValueChange={v => onUpdatePhase(phase.id, { duration_unit: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dias_uteis">dias úteis</SelectItem>
                      <SelectItem value="dias_corridos">dias corridos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          {/* Recorrência da fase — só roadmap principal (não onboarding/offboarding) */}
          {isOwner && isRecurring && !phase.is_onboarding && !phase.is_offboarding && (
            <div className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={!!phase.is_recurring}
                  onCheckedChange={(c) => onUpdatePhase(phase.id, {
                    is_recurring: !!c,
                    recurrence_frequency: c ? (phase.recurrence_frequency || 'mensal') : null,
                  })}
                />
                <span className="text-xs font-medium text-foreground">Esta fase repete-se ao longo do projeto</span>
              </label>
              {phase.is_recurring && (
                <div className="grid gap-3 sm:grid-cols-3 mt-3 pt-3 border-t border-primary/15">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Cadência</label>
                    <Select
                      value={phase.recurrence_frequency || 'mensal'}
                      onValueChange={v => onUpdatePhase(phase.id, { recurrence_frequency: v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      {phase.recurrence_frequency === 'semanal' ? 'Dia da semana (1=Seg … 7=Dom)' : 'Dia do mês'}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={phase.recurrence_frequency === 'semanal' ? 7 : 31}
                      className="h-8 text-sm px-2"
                      value={phase.recurrence_anchor_day ?? ''}
                      placeholder={phase.recurrence_frequency === 'semanal' ? '5' : '20'}
                      onChange={e => onUpdatePhase(phase.id, { recurrence_anchor_day: e.target.value ? parseInt(e.target.value) : null })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Abre antes (dias úteis)</label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-sm px-2"
                      value={phase.recurrence_lead_days ?? 5}
                      onChange={e => onUpdatePhase(phase.id, { recurrence_lead_days: e.target.value ? parseInt(e.target.value) : 0 })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* SOP Steps */}
          {sopSteps.length > 0 && (
            <div className="rounded-md border border-dashed border-primary/20 bg-primary/[0.02] px-3 py-1.5">
              <button
                type="button"
                className="flex items-center gap-2 text-[10px] font-medium text-primary w-full text-left"
                onClick={() => setSopExpanded(!sopExpanded)}
              >
                {sopExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <ListChecks className="h-3 w-3" /> SOP: {linkedSopName} ({sopSteps.length} passos)
              </button>
              {sopExpanded && (
                <div className="mt-1.5 space-y-2">
                  {sopSteps.map((step, i) => (
                    <div key={step.id} className="flex items-start gap-2 pl-1">
                      <span className="text-[10px] text-muted-foreground font-mono w-4 text-right shrink-0 mt-0.5">{i + 1}.</span>
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{step.description}</p>
                      {step.responsible && (
                        <Badge variant="secondary" className="text-[9px] shrink-0">{step.responsible}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deliverables */}
          {deliverables.length === 0 && sopSteps.length === 0 && (
            <EmptyHint>Sem entregas nesta fase.</EmptyHint>
          )}
          {deliverables.map((d, i) => (
            <DeliverableRow key={d.id} template={d} index={i} total={deliverables.length} isOwner={isOwner} sops={sops} isRecurring={isRecurring}
              allowRecurring={!phase.is_onboarding && !phase.is_offboarding}
              onUpdate={onUpdateDeliverable} onDelete={onDeleteDeliverable}
              onMoveUp={() => { if (i > 0) onSwapDeliverables(d.id, i, deliverables[i - 1].id, i - 1); }}
              onMoveDown={() => { if (i < deliverables.length - 1) onSwapDeliverables(d.id, i, deliverables[i + 1].id, i + 1); }}
            />
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
export function ProductEntregasSection({ deliverableTemplates, isOwner, productId, isRecurring = false, onAdd, onUpdate, onDelete }: Props) {
  const qc = useQueryClient();
  const phaseKey = ['product-phases', productId];
  const [openZone, setOpenZone] = useState<null | 'onboarding' | 'roadmap' | 'offboarding'>(null);

  // Fetch phases
  const { data: phases = [] } = useQuery({
    queryKey: phaseKey,
    queryFn: async () => {
      const { data } = await supabase.from('product_phases').select('*').eq('product_id', productId).order('sort_order');
      return (data || []) as Phase[];
    },
  });

  // Fetch SOPs linked to this product
  const { data: sops = [] } = useQuery({
    queryKey: ['sops-list-mini', productId],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('id, name').eq('product_id', productId);
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  // Count active projects using this product — alterações estruturais ao
  // template propagam-se para estes projetos via trigger sync_product_phase_to_projects
  // (datas planeadas manualmente NÃO são sobrescritas).
  const { data: activeProjectsCount = 0 } = useQuery({
    queryKey: ['active-projects-using-product', productId],
    queryFn: async () => {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .not('status', 'in', '(concluido,cancelado,arquivado)');
      return count ?? 0;
    },
  });

  const addPhase = useMutation({
    mutationFn: async (zone: 'onboarding' | 'roadmap' | 'offboarding' = 'roadmap') => {
      await supabase.from('product_phases' as any).insert({
        product_id: productId,
        name: '',
        sort_order: phases.length,
        is_onboarding: zone === 'onboarding',
        is_offboarding: zone === 'offboarding',
      } as any);
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

  const swapDeliverables = async (idA: string, _orderA: number, idB: string, _orderB: number) => {
    // Use sequential integers based on array index to avoid duplicate sort_order issues
    const newOrderA = _orderB !== _orderA ? _orderB : _orderA + 1;
    const newOrderB = _orderB !== _orderA ? _orderA : _orderA;
    await Promise.all([
      supabase.from('product_deliverable_templates' as any).update({ sort_order: newOrderA } as any).eq('id', idA),
      supabase.from('product_deliverable_templates' as any).update({ sort_order: newOrderB } as any).eq('id', idB),
    ]);
    qc.invalidateQueries({ queryKey: ['product-deliverable-templates', productId] });
  };

  const sortedPhases = [...phases].sort((a, b) => a.sort_order - b.sort_order);
  const onboardingPhases = sortedPhases.filter(p => p.is_onboarding && !p.is_offboarding);
  const offboardingPhases = sortedPhases.filter(p => p.is_offboarding && !p.is_onboarding);
  const roadmapPhases = sortedPhases.filter(p => !p.is_onboarding && !p.is_offboarding);

  const renderPhase = (phase: Phase) => {
    const phaseDeliverables = deliverableTemplates
      .filter(d => d.phase_id === phase.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return (
      <PhaseCard key={phase.id} phase={phase} deliverables={phaseDeliverables} sops={sops}
        isOwner={isOwner} productId={productId} isRecurring={isRecurring}
        onUpdatePhase={(id, data) => updatePhase.mutate({ id, ...data })}
        onDeletePhase={(id) => deletePhase.mutate(id)}
        onAddDeliverable={addDeliverableToPhase}
        onUpdateDeliverable={onUpdate} onDeleteDeliverable={onDelete}
        onSwapDeliverables={swapDeliverables} />
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <ProductTabHeader
        icon={Layers}
        title="Operação"
        description="Estrutura de fases e entregas que cada projeto deste produto vai herdar. Configura uma vez, propaga-se para todos os projetos ativos."
        actions={
          <Badge variant="outline" className="gap-1.5 text-xs px-2.5 py-1">
            {isRecurring ? (
              <><Repeat className="h-3 w-3 text-primary" /> Recorrente</>
            ) : (
              <><FolderKanban className="h-3 w-3 text-primary" /> Por projeto</>
            )}
          </Badge>
        }
      />

      {isOwner && activeProjectsCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              {activeProjectsCount} projeto{activeProjectsCount === 1 ? '' : 's'} ativo{activeProjectsCount === 1 ? '' : 's'}
            </span>{' '}
            herda{activeProjectsCount === 1 ? '' : 'm'} desta estrutura. Adicionar/remover/renomear fases ou entregas propaga-se automaticamente; datas planeadas manualmente nesses projetos não são sobrescritas.
          </div>
        </div>
      )}

      {/* ── ZONE TILES ───────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-3">
        {([
          { key: 'onboarding' as const, title: 'Onboarding', subtitle: 'Acolhimento e arranque', phases: onboardingPhases, accent: 'warning' },
          { key: 'roadmap' as const, title: 'Roadmap principal', subtitle: 'Entrega do serviço', phases: roadmapPhases, accent: 'primary' },
          { key: 'offboarding' as const, title: 'Offboarding', subtitle: 'Encerramento e handover', phases: offboardingPhases, accent: 'destructive' },
        ]).map(zone => {
          const totalDeliverables = zone.phases.reduce((acc, p) =>
            acc + deliverableTemplates.filter(d => d.phase_id === p.id).length, 0);
          const accentClasses: Record<string, string> = {
            warning: 'border-l-warning hover:border-warning/60 hover:bg-warning/5',
            primary: 'border-l-primary hover:border-primary/60 hover:bg-primary/5',
            destructive: 'border-l-destructive hover:border-destructive/60 hover:bg-destructive/5',
          };
          const dotClasses: Record<string, string> = {
            warning: 'bg-warning', primary: 'bg-primary', destructive: 'bg-destructive',
          };
          const textClasses: Record<string, string> = {
            warning: 'text-warning', primary: 'text-primary', destructive: 'text-destructive',
          };
          return (
            <button
              key={zone.key}
              type="button"
              onClick={() => setOpenZone(zone.key)}
              className={`hq-transition text-left rounded-lg border border-l-4 bg-card p-4 ${accentClasses[zone.accent]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`h-2 w-2 rounded-full ${dotClasses[zone.accent]}`} />
                <h4 className={`text-sm font-semibold ${textClasses[zone.accent]}`}>{zone.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{zone.subtitle}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{zone.phases.length}</span> fase{zone.phases.length === 1 ? '' : 's'}
                  {' · '}
                  <span className="font-semibold text-foreground">{totalDeliverables}</span> entrega{totalDeliverables === 1 ? '' : 's'}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── ZONE DIALOG ──────────────────────────────── */}
      <Dialog open={openZone !== null} onOpenChange={(o) => !o && setOpenZone(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {openZone && (() => {
            const zoneConfig = {
              onboarding: { title: 'Onboarding', subtitle: 'Fases de acolhimento e arranque do serviço', phases: onboardingPhases, addLabel: 'Fase de onboarding', dot: 'bg-warning', text: 'text-warning' },
              roadmap: { title: 'Roadmap principal', subtitle: 'Fases de entrega principal do serviço', phases: roadmapPhases, addLabel: 'Fase', dot: 'bg-primary', text: 'text-primary' },
              offboarding: { title: 'Offboarding', subtitle: 'Fases de encerramento, handover e NPS', phases: offboardingPhases, addLabel: 'Fase de offboarding', dot: 'bg-destructive', text: 'text-destructive' },
            }[openZone];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className={`flex items-center gap-2 ${zoneConfig.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${zoneConfig.dot}`} />
                    {zoneConfig.title}
                  </DialogTitle>
                  <DialogDescription>{zoneConfig.subtitle}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  {zoneConfig.phases.length === 0 && (
                    <p className="text-sm text-muted-foreground italic text-center py-6">
                      Sem fases definidas. Adiciona a primeira em baixo.
                    </p>
                  )}
                  {zoneConfig.phases.map(renderPhase)}
                  {isOwner && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => addPhase.mutate(openZone)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {zoneConfig.addLabel}
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
