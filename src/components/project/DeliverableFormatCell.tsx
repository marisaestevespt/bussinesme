import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Video, CheckSquare, User, Users, Link2, FileText, Plus, Upload,
  ExternalLink, Unlink, ChevronDown, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewMeetingButton } from '@/components/meeting/NewMeetingButton';

export type DeliverableFormat =
  | 'tarefa_interna'
  | 'tarefa_cliente'
  | 'tarefa_partilhada'
  | 'reuniao'
  | 'link'
  | 'documento';

interface DeliverableForFormat {
  id: string;
  name: string;
  deliverable_type?: string | null;
  is_meeting?: boolean | null;
  responsible_type?: string | null;
  meeting_id?: string | null;
  link_url?: string | null;
  document_url?: string | null;
  document_file_path?: string | null;
  meeting_title_template?: string | null;
  sort_order?: number | null;
}

interface Props {
  deliverable: DeliverableForFormat;
  projectId: string;
  projectName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  defaultDepartment?: string | null;
  defaultMemberIds?: string[];
}

export function getDeliverableFormat(d: DeliverableForFormat): DeliverableFormat {
  const t = d.deliverable_type;
  if (t === 'reuniao' || d.is_meeting) return 'reuniao';
  if (t === 'link') return 'link';
  if (t === 'documento') return 'documento';
  // tarefa
  const rt = d.responsible_type || 'equipa';
  if (rt === 'cliente') return 'tarefa_cliente';
  if (rt === 'ambos') return 'tarefa_partilhada';
  return 'tarefa_interna';
}

const FORMAT_META: Record<DeliverableFormat, { label: string; icon: any; cls: string }> = {
  tarefa_interna: { label: 'Tarefa', icon: CheckSquare, cls: 'bg-muted text-muted-foreground' },
  tarefa_cliente: { label: 'Cliente', icon: User, cls: 'bg-warning/10 text-warning' },
  tarefa_partilhada: { label: 'Equipa + Cliente', icon: Users, cls: 'bg-primary/10 text-primary' },
  reuniao:        { label: 'Reunião', icon: Video, cls: 'bg-primary/10 text-primary' },
  link:           { label: 'Link', icon: Link2, cls: 'bg-info/10 text-info' },
  documento:      { label: 'Doc', icon: FileText, cls: 'bg-accent/40 text-foreground' },
};

const FORMAT_TO_FIELDS: Record<DeliverableFormat, Record<string, any>> = {
  tarefa_interna: { deliverable_type: 'tarefa', is_meeting: false, responsible_type: 'equipa' },
  tarefa_cliente: { deliverable_type: 'tarefa', is_meeting: false, responsible_type: 'cliente' },
  tarefa_partilhada: { deliverable_type: 'tarefa', is_meeting: false, responsible_type: 'ambos' },
  reuniao:        { deliverable_type: 'reuniao', is_meeting: true, responsible_type: 'equipa' },
  link:           { deliverable_type: 'link', is_meeting: false, responsible_type: 'equipa' },
  documento:      { deliverable_type: 'documento', is_meeting: false, responsible_type: 'equipa' },
};

export function DeliverableFormatCell({
  deliverable: d, projectId, projectName, clientId, clientName,
  defaultDepartment, defaultMemberIds,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fmt = getDeliverableFormat(d);
  const meta = FORMAT_META[fmt];
  const Icon = meta.icon;
  const [linkOpen, setLinkOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [meetPickerOpen, setMeetPickerOpen] = useState(false);

  // For tarefa formats: lookup linked task to allow "Abrir tarefa" shortcut
  const isTarefa = fmt === 'tarefa_interna' || fmt === 'tarefa_cliente';
  const { data: linkedTask } = useQuery({
    queryKey: ['deliverable-linked-task', d.id],
    enabled: isTarefa,
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks').select('id').eq('deliverable_id', d.id).maybeSingle();
      return data as { id: string } | null;
    },
  });
  // Lookup linked meeting title to display in the cell
  const { data: linkedMeeting } = useQuery({
    queryKey: ['deliverable-linked-meeting', d.meeting_id],
    enabled: fmt === 'reuniao' && !!d.meeting_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings').select('id, title, date_time').eq('id', d.meeting_id!).maybeSingle();
      return data as { id: string; title: string | null; date_time: string | null } | null;
    },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
  };

  const updateFields = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await supabase
        .from('project_deliverables').update(fields as never).eq('id', d.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || 'Falha ao guardar'),
  });

  const changeFormat = (next: DeliverableFormat) => {
    if (next === fmt) return;
    const fields = { ...FORMAT_TO_FIELDS[next] } as Record<string, any>;
    // Clear unrelated fields when switching format
    if (next !== 'reuniao') fields.meeting_id = null;
    if (next !== 'link') fields.link_url = null;
    if (next !== 'documento') {
      fields.document_url = null;
      // Note: file in storage is left as orphan; keep policy simple.
      fields.document_file_path = null;
    }
    updateFields.mutate(fields);
  };

  // ── Meetings of the project (for "ligar existente") ───────────────
  const { data: projectMeetings = [] } = useQuery({
    queryKey: ['project-meetings-for-link', projectId],
    enabled: meetPickerOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from('meetings')
        .select('id, title, date_time')
        .eq('project_id', projectId)
        .order('date_time', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });
  const { data: alreadyLinked = [] } = useQuery({
    queryKey: ['project-meetings-already-linked', projectId],
    enabled: meetPickerOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from('project_deliverables')
        .select('meeting_id')
        .eq('project_id', projectId)
        .not('meeting_id', 'is', null);
      return (data || []).map((r: any) => r.meeting_id) as string[];
    },
  });
  const linkedSet = new Set(alreadyLinked);

  const linkExisting = (meetingId: string) => {
    updateFields.mutate({ meeting_id: meetingId });
    setMeetPickerOpen(false);
    toast.success('Reunião ligada');
  };

  const unlinkMeeting = () => {
    updateFields.mutate(
      { meeting_id: null },
      {
        onSuccess: () => {
          invalidate();
          qc.invalidateQueries({ queryKey: ['deliverable-linked-meeting'] });
          toast.success('Reunião desligada');
        },
      },
    );
  };

  // Fallback: fetch the project's client full_name directly when not provided
  // (some callers pass null because the embedded join `clients(...)` is dropped by RLS).
  const { data: fetchedClientName } = useQuery({
    queryKey: ['deliverable-client-name', projectId],
    enabled: fmt === 'reuniao' && !d.meeting_id && !clientName && !!projectId,
    queryFn: async () => {
      const { data: proj } = await supabase
        .from('projects').select('client_id').eq('id', projectId).maybeSingle();
      const cid = proj?.client_id;
      if (!cid) return '';
      const { data: cli } = await supabase
        .from('clients').select('full_name').eq('id', cid).maybeSingle();
      return (cli?.full_name as string | undefined) || '';
    },
  });
  const effectiveClientName = clientName || fetchedClientName || '';

  // Resolve {N} = occurrence index among meeting deliverables sharing the same template.
  const { data: occurrenceIndex } = useQuery({
    queryKey: ['deliverable-meeting-occurrence', d.id, d.meeting_title_template, projectId],
    enabled: fmt === 'reuniao' && !d.meeting_id && !!d.meeting_title_template,
    queryFn: async () => {
      const tpl = d.meeting_title_template!;
      const { data: siblings } = await supabase
        .from('project_deliverables')
        .select('id, sort_order, meeting_title_template')
        .eq('project_id', projectId)
        .eq('meeting_title_template', tpl)
        .order('sort_order', { ascending: true });
      const list = (siblings || []) as Array<{ id: string }>;
      return Math.max(1, list.findIndex(x => x.id === d.id) + 1);
    },
  });

  // Compute the resolved title synchronously from whatever we have right now.
  // This guarantees the meeting dialog always opens with a pre-filled title.
  const resolvedDefaultTitle = (() => {
    const tpl = d.meeting_title_template;
    if (!tpl) return d.name;
    const idx = occurrenceIndex ?? 1;
    return tpl
      .replace(/\{N\}/g, String(idx))
      .replace(/\{cliente\}/gi, effectiveClientName)
      .replace(/\s+\|\s+(?=\||$)/g, ' ') // tidy empty segments when {cliente} is missing
      .trim();
  })();

  // ── File upload ───────────────────────────────────────────────────
  const onFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${projectId}/${d.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('deliverable-documents')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      await updateFields.mutateAsync({ document_file_path: path });
      toast.success('Ficheiro carregado');
    } catch (e: any) {
      toast.error(e?.message || 'Falha no upload');
    } finally {
      setUploading(false);
    }
  };

  const downloadDoc = async () => {
    if (!d.document_file_path) return;
    const { data, error } = await supabase.storage
      .from('deliverable-documents')
      .createSignedUrl(d.document_file_path, 60);
    if (error || !data) { toast.error('Falha ao gerar link'); return; }
    window.open(data.signedUrl, '_blank');
  };

  // ── Render badge with format menu ─────────────────────────────────
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'text-[10px] shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:opacity-80',
              meta.cls,
            )}
            title="Mudar formato"
          >
            <Icon className="h-3 w-3" />
            <span>{meta.label}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-[10px]">Formato</DropdownMenuLabel>
          {(Object.keys(FORMAT_META) as DeliverableFormat[]).map(k => {
            const m = FORMAT_META[k];
            const KIcon = m.icon;
            return (
              <DropdownMenuItem key={k} onClick={() => changeFormat(k)} className="text-xs gap-2">
                <KIcon className="h-3.5 w-3.5" />
                <span>{k === 'tarefa_interna' ? 'Tarefa interna' : k === 'tarefa_cliente' ? 'Tarefa do cliente' : m.label}</span>
                {fmt === k && <span className="ml-auto text-[10px] text-muted-foreground">atual</span>}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Format-specific action */}
      {isTarefa && linkedTask?.id && (
        <button
          type="button"
          onClick={() => navigate(`/hub/tarefas?taskId=${linkedTask.id}`)}
          className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-muted-foreground"
          title="Abrir tarefa associada"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
      {fmt === 'reuniao' && (
        d.meeting_id ? (
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate(`/hub/reunioes/${d.meeting_id}`)}
              className="text-[11px] text-primary hover:underline text-left whitespace-nowrap"
              title={linkedMeeting?.title || 'Abrir reunião'}
            >
              {linkedMeeting?.title || 'reunião ligada'}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
                  title="Opções da reunião"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs gap-2" onClick={() => navigate(`/hub/reunioes/${d.meeting_id}`)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir reunião
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={() => setMeetPickerOpen(true)}>
                  <Paperclip className="h-3.5 w-3.5" /> Trocar reunião…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs gap-2 text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    if (confirm('Desligar a reunião desta entrega? A reunião não é apagada.')) {
                      unlinkMeeting();
                    }
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" /> Desligar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <NewMeetingButton
              defaultProjectId={projectId}
              defaultProjectName={projectName ?? undefined}
              defaultClientId={clientId ?? undefined}
              defaultClientName={clientName ?? undefined}
              defaultTitle={resolvedDefaultTitle}
              defaultMemberIds={defaultMemberIds}
              defaultDepartment={defaultDepartment ?? undefined}
              defaultPlannedMinutes={(d as any).estimated_minutes ?? null}
              onMeetingCreated={(meetingId) => updateFields.mutate({ meeting_id: meetingId })}
            >
              <button
                type="button"
                className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-primary/10 text-primary"
                title="Criar reunião"
              >
                <Plus className="h-3 w-3" />
              </button>
            </NewMeetingButton>
            <button
              type="button"
              onClick={() => setMeetPickerOpen(true)}
              className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-muted-foreground"
              title="Ligar reunião existente"
            >
              <Paperclip className="h-3 w-3" />
            </button>
          </div>
        )
      )}

      {fmt === 'reuniao' && (
        <Dialog open={meetPickerOpen} onOpenChange={setMeetPickerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Reuniões deste projeto</DialogTitle>
              <DialogDescription className="text-xs">
                Escolhe uma reunião existente para ligar a esta entrega.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto -mx-2 px-2">
              {projectMeetings.length === 0 ? (
                <div className="text-xs text-muted-foreground p-3 text-center">
                  Sem reuniões neste projeto.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {projectMeetings.map((m: any) => {
                    const isCurrent = m.id === d.meeting_id;
                    const linked = !isCurrent && linkedSet.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (isCurrent) { setMeetPickerOpen(false); return; }
                          if (linked && !confirm('Esta reunião já está ligada a outra entrega. Mudar a ligação?')) return;
                          linkExisting(m.id);
                        }}
                        className="w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded text-xs hover:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{m.title || '(sem título)'}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {m.date_time ? new Date(m.date_time).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'sem data'}
                          </div>
                        </div>
                        {isCurrent && <span className="text-[9px] text-primary shrink-0">atual</span>}
                        {linked && <span className="text-[9px] text-warning shrink-0">já ligada</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {fmt === 'link' && (
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-info"
              title={d.link_url || 'Definir link'}
            >
              {d.link_url ? <ExternalLink className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">URL</div>
            <Input
              autoFocus
              defaultValue={d.link_url || ''}
              placeholder="https://…"
              className="h-8 text-xs"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (d.link_url || null)) updateFields.mutate({ link_url: v });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim() || null;
                  if (v !== (d.link_url || null)) updateFields.mutate({ link_url: v });
                  setLinkOpen(false);
                }
              }}
            />
            {d.link_url && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                  onClick={() => window.open(d.link_url!, '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                  onClick={() => updateFields.mutate({ link_url: null })}>
                  <Unlink className="h-3 w-3" />
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {fmt === 'documento' && (
        <Popover open={docOpen} onOpenChange={setDocOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-foreground"
              title="Gerir documento"
            >
              {(d.document_url || d.document_file_path) ? <ExternalLink className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">URL externo (opcional)</div>
              <Input
                defaultValue={d.document_url || ''}
                placeholder="https://docs.google.com/…"
                className="h-8 text-xs"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (d.document_url || null)) updateFields.mutate({ document_url: v });
                }}
              />
              {d.document_url && (
                <Button size="sm" variant="outline" className="h-7 text-xs mt-1.5 w-full"
                  onClick={() => window.open(d.document_url!, '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir link
                </Button>
              )}
            </div>
            <div className="border-t pt-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ficheiro carregado</div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ''; }}
              />
              {d.document_file_path ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={downloadDoc}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir ficheiro
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                    onClick={() => updateFields.mutate({ document_file_path: null })}>
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs w-full"
                  onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3 w-3 mr-1" /> {uploading ? 'A carregar…' : 'Carregar ficheiro'}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}