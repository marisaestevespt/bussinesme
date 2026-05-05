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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Video, CheckSquare, User, Link2, FileText, Plus, Upload,
  ExternalLink, Unlink, ChevronDown, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewMeetingButton } from '@/components/meeting/NewMeetingButton';

export type DeliverableFormat =
  | 'tarefa_interna'
  | 'tarefa_cliente'
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
  return (d.responsible_type || 'equipa') === 'cliente' ? 'tarefa_cliente' : 'tarefa_interna';
}

const FORMAT_META: Record<DeliverableFormat, { label: string; icon: any; cls: string }> = {
  tarefa_interna: { label: 'Tarefa', icon: CheckSquare, cls: 'bg-muted text-muted-foreground' },
  tarefa_cliente: { label: 'Cliente', icon: User, cls: 'bg-warning/10 text-warning' },
  reuniao:        { label: 'Reunião', icon: Video, cls: 'bg-primary/10 text-primary' },
  link:           { label: 'Link', icon: Link2, cls: 'bg-info/10 text-info' },
  documento:      { label: 'Doc', icon: FileText, cls: 'bg-accent/40 text-foreground' },
};

const FORMAT_TO_FIELDS: Record<DeliverableFormat, Record<string, any>> = {
  tarefa_interna: { deliverable_type: 'tarefa', is_meeting: false, responsible_type: 'equipa' },
  tarefa_cliente: { deliverable_type: 'tarefa', is_meeting: false, responsible_type: 'cliente' },
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
      const { data } = await (supabase as any)
        .from('tasks').select('id').eq('deliverable_id', d.id).maybeSingle();
      return data as { id: string } | null;
    },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
  };

  const updateFields = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { error } = await (supabase as any)
        .from('project_deliverables').update(fields).eq('id', d.id);
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
      const { data } = await (supabase as any)
        .from('meetings')
        .select('id, title, scheduled_at, type')
        .eq('project_id', projectId)
        .order('scheduled_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });
  const { data: alreadyLinked = [] } = useQuery({
    queryKey: ['project-meetings-already-linked', projectId],
    enabled: meetPickerOpen,
    queryFn: async () => {
      const { data } = await (supabase as any)
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
    <div className="flex items-center gap-1 min-w-0">
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
          <button
            type="button"
            onClick={() => navigate(`/hub/reunioes/${d.meeting_id}`)}
            className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-primary"
            title="Abrir reunião"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        ) : (
          <div className="flex items-center gap-0.5">
            <NewMeetingButton
              skipPicker
              forcedType={'recorrente' as any}
              defaultProjectId={projectId}
              defaultProjectName={projectName ?? undefined}
              defaultClientId={clientId ?? undefined}
              defaultClientName={clientName ?? undefined}
              defaultTitle={d.name}
              defaultMemberIds={defaultMemberIds}
              defaultDepartment={defaultDepartment ?? undefined}
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
            <Popover open={meetPickerOpen} onOpenChange={setMeetPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-[10px] inline-flex items-center px-1 py-0.5 rounded hover:bg-muted text-muted-foreground"
                  title="Ligar reunião existente"
                >
                  <Paperclip className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-2 max-h-80 overflow-auto">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1.5">
                  Reuniões deste projeto
                </div>
                {projectMeetings.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2">Sem reuniões neste projeto.</div>
                ) : (
                  <div className="space-y-0.5">
                    {projectMeetings.map((m: any) => {
                      const linked = linkedSet.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (linked) {
                              if (!confirm('Esta reunião já está ligada a outra entrega. Mudar a ligação?')) return;
                            }
                            linkExisting(m.id);
                          }}
                          className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{m.title || '(sem título)'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'sem data'}
                            </div>
                          </div>
                          {linked && <span className="text-[9px] text-warning shrink-0">já ligada</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )
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