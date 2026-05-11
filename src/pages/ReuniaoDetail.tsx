import { useState, useRef, useEffect } from 'react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MODULES } from '@/lib/modules';
import { Label } from '@/components/ui/label';
import { MentionTextarea } from '@/components/MentionTextarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  CalendarIcon, ArrowLeft, Trash2, Upload, FileText, Users, Plus, X, ExternalLink, StickyNote, Repeat, ListTodo, MessageSquare, Clock, Video, Link2, FolderOpen, CheckSquare, Lightbulb, RefreshCw,
} from 'lucide-react';
import { CreateTasksFromMeetingDialog } from '@/components/meeting/CreateTasksFromMeetingDialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { toast } from 'sonner';
import { logAudit } from '@/lib/auditLog';
import { BackNavigation } from '@/components/BackNavigation';
import { AddToCalendarButtons } from '@/components/AddToCalendarButtons';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InlineLoader } from '@/components/ui/loading-skeletons';
import {
  EntityTopBar,
  EntityTitle,
  EntityProperties,
  EntityProperty,
  EntitySection,
  inlineInputClass,
  inlineTriggerClass,
} from '@/components/layout/entity';
import { EntityHeroHeader, parseIcon } from '@/components/entity-icon';
import { safeUrl } from '@/lib/url';
import { DetailAccessGuard } from '@/components/access/DetailAccessGuard';
import { useSectorConfig } from '@/hooks/useSectorConfig';

// ─── Types ──────────────────────────────────────────────────────

type MeetingStatus = 'por_confirmar' | 'por_organizar' | 'confirmada' | 'terminada';
type MeetingType = 'recorrente' | 'projeto' | 'cliente' | 'diagnostico' | 'inicial';

const STATUSES: { value: MeetingStatus; label: string; color: string }[] = [
  { value: 'por_organizar', label: 'Por organizar', color: '#3b82f6' },
  { value: 'por_confirmar', label: 'Por confirmar', color: '#f59e0b' },
  { value: 'confirmada', label: 'Confirmada', color: '#10b981' },
  { value: 'terminada', label: 'Terminada', color: '#6b7280' },
];

interface CheckItem { text: string; checked: boolean; }

interface MeetingDocument {
  name: string;
  url: string;
  type: string;
}

interface MeetingFull {
  id: string;
  title: string;
  date_time: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  client_id: string | null;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  product_id: string | null;
  product_name: string | null;
  department: string | null;
  transcript_url: string | null;
  meeting_url: string | null;
  discussion_points: CheckItem[];
  discussion_notes: string;
  priorities: string[];
  owner_actions: CheckItem[];
  client_actions: CheckItem[];
  final_notes: string[];
  created_by: string | null;
  duration_minutes: number;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  parent_meeting_id: string | null;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  recurrence_end_date: string | null;
  documents: MeetingDocument[];
}

interface ProjectOption { id: string; name: string; product_id: string | null; product_name: string | null; client_id: string | null; client_name: string | null; }

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

// ─── Data hooks ─────────────────────────────────────────────────

function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      const raw = data as any;
      return {
        ...raw,
        meeting_type: raw.meeting_type || 'recorrente',
        discussion_points: Array.isArray(raw.discussion_points) ? raw.discussion_points as CheckItem[] : [],
        discussion_notes: raw.discussion_notes || '',
        priorities: Array.isArray(raw.priorities) ? raw.priorities as string[] : ['', '', '', '', ''],
        owner_actions: Array.isArray(raw.owner_actions) ? raw.owner_actions as CheckItem[] : [],
        client_actions: Array.isArray(raw.client_actions) ? raw.client_actions as CheckItem[] : [],
        final_notes: Array.isArray(raw.final_notes) ? raw.final_notes as string[] : [],
        duration_minutes: raw.duration_minutes || 0,
        planned_duration_minutes: raw.planned_duration_minutes ?? raw.duration_minutes ?? null,
        actual_duration_minutes: raw.actual_duration_minutes ?? null,
        documents: Array.isArray(raw.documents) ? raw.documents as MeetingDocument[] : [],
      } as MeetingFull;
    },
  });
}

function useMeetingParticipants(meetingId: string) {
  return useQuery({
    queryKey: ['meeting_participants', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_participants').select('*').eq('meeting_id', meetingId);
      if (error) throw error;
      return data as { id: string; meeting_id: string; profile_id: string }[];
    },
  });
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, user_id, full_name, avatar_url');
      if (error) throw error;
      return data as Profile[];
    },
  });
}


function useProjectsList() {
  return useQuery({
    queryKey: ['projects_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, product_id, product_name, client_id, client_name').order('name').is('archived_at', null);
      if (error) throw error;
      return data as ProjectOption[];
    },
  });
}

function useProductsList() {
  return useQuery({
    queryKey: ['products_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });
}

function useOwnerProfile() {
  return useQuery({
    queryKey: ['owner_profile'],
    queryFn: async () => {
      const { data: ownerRole } = await supabase.from('user_roles').select('user_id').eq('role', 'owner').limit(1).maybeSingle();
      if (!ownerRole) return null;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', ownerRole.user_id).maybeSingle();
      return profile?.full_name ?? null;
    },
  });
}

// Count series children
function useSeriesCount(parentId: string | null) {
  return useQuery({
    queryKey: ['series_count', parentId],
    queryFn: async () => {
      if (!parentId) return 0;
      const { count } = await supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('parent_meeting_id', parentId);
      return count || 0;
    },
    enabled: !!parentId,
  });
}

// Fetch recurrence info from parent (for child occurrences)
function useParentRecurrence(parentId: string | null) {
  return useQuery({
    queryKey: ['parent_recurrence', parentId],
    queryFn: async () => {
      if (!parentId) return null;
      const { data } = await supabase
        .from('meetings')
        .select('recurrence_frequency, recurrence_end_date')
        .eq('id', parentId)
        .maybeSingle();
      return data;
    },
    enabled: !!parentId,
  });
}

// Fetch client email for calendar invites
function useClientEmail(clientId: string | null) {
  return useQuery({
    queryKey: ['client_email', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from('clients')
        .select('email')
        .eq('id', clientId)
        .maybeSingle();
      return data?.email ?? null;
    },
    enabled: !!clientId,
  });
}

// ─── Helpers ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MeetingStatus }) {
  const s = STATUSES.find(x => x.value === status) ?? STATUSES[0];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
      {s.label}
    </span>
  );
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Editable Checklist ─────────────────────────────────────────

function EditableChecklist({ items, onChange, label }: { items: CheckItem[]; onChange: (items: CheckItem[]) => void; label: string }) {
  const [newText, setNewText] = useState('');

  const toggleItem = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], checked: !next[idx].checked };
    onChange(next);
  };

  const updateText = (idx: number, text: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], text };
    onChange(next);
  };

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, { text: newText.trim(), checked: false }]);
    setNewText('');
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-semibold text-foreground">{label}</Label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(i)} className="mt-1" />
            <textarea
              value={item.text}
              onChange={e => updateText(i, e.target.value)}
              rows={2}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
              className={cn('flex-1 bg-transparent text-sm border-none outline-none resize-none leading-relaxed min-h-[36px] rounded px-2 py-1 hover:bg-muted/30 focus:bg-muted/30 transition-colors', item.checked && 'line-through text-muted-foreground')}
            />
            <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all mt-1">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-3 space-y-2">
        <MentionTextarea value={newText} onChange={setNewText} placeholder="Escreve um novo ponto aqui... usa @ para mencionar alguém" rows={3} className="text-sm min-h-[80px] w-full" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem(); }}} />
        <Button size="sm" variant="outline" className="h-9 px-3" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
      </div>
    </div>
  );
}

// ─── Editable Bullet List ───────────────────────────────────────

function EditableBulletList({ items, onChange, label }: { items: string[]; onChange: (items: string[]) => void; label: string }) {
  const [newText, setNewText] = useState('');

  const updateItem = (idx: number, text: string) => {
    const next = [...items];
    next[idx] = text;
    onChange(next);
  };
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, newText.trim()]);
    setNewText('');
  };

  return (
    <div className="space-y-2">
      {label && <Label className="flex items-center gap-2 text-xs font-semibold text-foreground"><StickyNote className="h-3.5 w-3.5" /> {label}</Label>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <span className="text-muted-foreground text-xs mt-1.5">•</span>
            <textarea
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              rows={2}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
              className="flex-1 bg-transparent text-sm border-none outline-none resize-none leading-relaxed min-h-[36px] rounded px-2 py-1 hover:bg-muted/30 focus:bg-muted/30 transition-colors"
            />
            <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all mt-1"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-3 space-y-2">
        <MentionTextarea value={newText} onChange={setNewText} placeholder="Escreve uma nota aqui... usa @ para mencionar alguém" rows={3} className="text-sm min-h-[80px] w-full" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItem(); }}} />
        <Button size="sm" variant="outline" className="h-9 px-3" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

function ReuniaoDetailPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const { user } = useAuth();
  const sectorConfig = useSectorConfig();
  const { impersonating } = useImpersonation();
  const effectiveUserId = impersonating?.user_id || user?.id;
  const { settings } = useBusinessSettings();

  const { data: meeting, isLoading } = useMeeting(id!);
  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, full_name').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });
  const { data: participants = [] } = useMeetingParticipants(id!);
  const { data: profiles = [] } = useProfiles();
  const { getPhotoUrl } = useTeamPhotos();
  const { data: ownerName } = useOwnerProfile();
  const { data: projectsList = [] } = useProjectsList();
  const { data: productsList = [] } = useProductsList();
  const fileRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const [localMeeting, setLocalMeeting] = useState<MeetingFull | null>(null);
  const [dirty, setDirty] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createTasksOpen, setCreateTasksOpen] = useState(false);
  // Track which fields the user has changed in this session
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [seriesSaveDialogOpen, setSeriesSaveDialogOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [prepItems, setPrepItems] = useState<Array<{ id: string; content: string; source: string; author_label: string | null; created_at: string }>>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('meeting_prep_items' as any)
        .select('id, content, source, author_label, created_at')
        .eq('meeting_id', id)
        .order('created_at', { ascending: true });
      if (!cancelled) setPrepItems((data as any[]) || []);
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (meeting && !localMeeting) setLocalMeeting(meeting);
  }, [meeting]);

  const m = localMeeting;

  // Determine if this is a series parent
  const isSeriesParent = m?.is_recurring === true;
  const isSeriesChild = !!m?.parent_meeting_id;
  const { data: seriesCount = 0 } = useSeriesCount(isSeriesParent ? m?.id ?? null : null);
  const { data: parentRecurrence } = useParentRecurrence(isSeriesChild ? m?.parent_meeting_id ?? null : null);
  const { data: clientEmail } = useClientEmail(m?.client_id ?? null);

  // Linked deliverable + its phase — used to warn when meeting date_time
  // would push the deliverable outside the phase window.
  const { data: linkedDeliverable } = useQuery({
    queryKey: ['meeting-linked-deliverable', m?.id],
    enabled: !!m?.id,
    queryFn: async () => {
      const { data: del } = await (supabase as any)
        .from('project_deliverables')
        .select('id, name, phase_id, planned_start, planned_end')
        .eq('meeting_id', m!.id)
        .maybeSingle();
      if (!del?.phase_id) return del ? { ...del, phase: null } : null;
      const { data: phase } = await (supabase as any)
        .from('project_phases')
        .select('id, name, planned_start, planned_end')
        .eq('id', del.phase_id)
        .maybeSingle();
      return { ...del, phase };
    },
  });

  // Compute window-conflict warning (date only, ignores time component).
  const meetingWindowWarning = (() => {
    if (!m?.date_time || !linkedDeliverable?.phase) return null;
    const phase = linkedDeliverable.phase as { name: string; planned_start: string | null; planned_end: string | null };
    const dateOnly = m.date_time.slice(0, 10); // YYYY-MM-DD
    if (phase.planned_end && dateOnly > phase.planned_end) {
      return `A nova data está depois do fim da fase "${phase.name}" (${format(parseISO(phase.planned_end), 'dd MMM', { locale: pt })}). Ao guardar, a entrega ligada ficará fora da janela.`;
    }
    if (phase.planned_start && dateOnly < phase.planned_start) {
      return `A nova data está antes do início da fase "${phase.name}" (${format(parseISO(phase.planned_start), 'dd MMM', { locale: pt })}). Ao guardar, a entrega ligada ficará fora da janela.`;
    }
    return null;
  })();

  // Build recurrence prop for AddToCalendarButtons (covers both parent and child occurrences)
  const calendarRecurrence = isSeriesParent
    ? (m?.recurrence_frequency
        ? { frequency: m.recurrence_frequency, endDate: m?.recurrence_end_date ?? null }
        : null)
    : (parentRecurrence?.recurrence_frequency
        ? { frequency: parentRecurrence.recurrence_frequency, endDate: parentRecurrence.recurrence_end_date ?? null }
        : null);

  const update = (patch: Partial<MeetingFull>) => {
    if (!m) return;
    setLocalMeeting({ ...m, ...patch });
    setDirty(true);
    setChangedFields(prev => {
      const next = new Set(prev);
      Object.keys(patch).forEach(k => next.add(k));
      return next;
    });
  };

  // Fields that make sense to propagate across the whole series
  const SERIES_PROPAGABLE_FIELDS = new Set([
    'title', 'meeting_url', 'meeting_type', 'duration_minutes',
    'planned_duration_minutes',
    'department', 'client_id', 'client_name', 'project_id', 'project_name',
    'product_id', 'product_name',
  ]);
  const hasPropagableChange = Array.from(changedFields).some(f => SERIES_PROPAGABLE_FIELDS.has(f));
  const isInSeries = isSeriesParent || isSeriesChild;

  const handleSave = () => {
    if (isInSeries && hasPropagableChange) {
      setSeriesSaveDialogOpen(true);
    } else {
      saveMutation.mutate('single');
    }
  };

  // Save
  const saveMutation = useMutation({
    mutationFn: async (mode: 'single' | 'series' = 'single') => {
      if (!m) return;
      // Capture which schedule-defining fields changed BEFORE we clear the
      // dirty set in onSuccess. If the parent's date_time / frequency /
      // end_date changed, future children at the OLD schedule are now stale
      // and must be purged + regenerated.
      const scheduleChangedOnParent = isSeriesParent && (
        changedFields.has('date_time') ||
        changedFields.has('recurrence_frequency') ||
        changedFields.has('recurrence_end_date')
      );
      const fullPatch = {
        title: m.title,
        date_time: m.date_time,
        status: m.status as any,
        meeting_type: m.meeting_type as any,
        client_id: m.client_id,
        client_name: m.client_name,
        project_id: m.project_id,
        project_name: m.project_name,
        product_id: m.product_id,
        product_name: m.product_name,
        department: m.department,
        transcript_url: m.transcript_url,
        meeting_url: m.meeting_url,
        discussion_points: m.discussion_points as any,
        priorities: m.priorities as any,
        owner_actions: m.owner_actions as any,
        client_actions: m.client_actions as any,
        final_notes: m.final_notes as any,
        duration_minutes: m.actual_duration_minutes ?? m.planned_duration_minutes ?? m.duration_minutes,
        planned_duration_minutes: m.planned_duration_minutes,
        actual_duration_minutes: m.actual_duration_minutes,
        documents: m.documents as any,
      } as Record<string, any>;
      // Persist recurrence settings on the parent so regeneration uses fresh values
      if (isSeriesParent) {
        (fullPatch as any).recurrence_frequency = (m as any).recurrence_frequency ?? null;
        (fullPatch as any).recurrence_end_date = (m as any).recurrence_end_date ?? null;
        (fullPatch as any).is_recurring = true;
      }
      const { error } = await supabase.from('meetings').update(fullPatch as any).eq('id', m.id);
      if (error) throw error;

      if (mode === 'series' && isInSeries) {
        // Build a partial patch with only the propagable fields the user actually changed
        const seriesPatch: Record<string, any> = {};
        Array.from(changedFields)
          .filter(f => SERIES_PROPAGABLE_FIELDS.has(f))
          .forEach(f => { seriesPatch[f] = (m as any)[f]; });

        if (Object.keys(seriesPatch).length > 0) {
          const parentId = isSeriesParent ? m.id : m.parent_meeting_id!;
          // Update the parent (when current is a child)
          if (m.parent_meeting_id) {
            await supabase.from('meetings').update(seriesPatch as any).eq('id', parentId);
          }
          // Update all siblings (other children of the same parent), excluding current
          await supabase
            .from('meetings')
            .update(seriesPatch as any)
            .eq('parent_meeting_id', parentId)
            .neq('id', m.id);
        }
      }

      // Auto-purge + regenerate when the series parent's schedule changed.
      // This prevents the "two meetings at the same day, old + new time"
      // duplication when a recurring parent gets its date_time edited.
      if (scheduleChangedOnParent) {
        try {
          await supabase.functions.invoke('regenerate-recurring-meetings', {
            body: { parent_meeting_id: m.id, purge_future: true },
          });
        } catch (e) {
          console.error('auto-regenerate after schedule change failed', e);
        }
      }
    },
    onSuccess: (_data, mode) => {
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      qc.invalidateQueries({ queryKey: ['series_count'] });
      setDirty(false);
      setChangedFields(new Set());
      logAudit('updated', 'meeting', id, { title: m?.title });
      toast.success(mode === 'series' ? 'Série atualizada' : 'Reunião guardada');
    },
    onError: () => toast.error('Não consegui guardar a reunião. Tenta novamente.'),
  });

  // Delete — with series awareness
  const deleteMutation = useMutation({
    mutationFn: async (mode: 'single' | 'future') => {
      if (mode === 'future' && isSeriesParent) {
        // Delete all future child occurrences
        await supabase.from('meetings').delete()
          .eq('parent_meeting_id', id!)
          .gte('date_time', new Date().toISOString());
      }
      // Delete the meeting itself
      const { error } = await supabase.from('meetings').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      logAudit('deleted', 'meeting', id, { title: m?.title });
      toast.success('Reunião eliminada');
      navigate('/hub/reunioes');
    },
  });

  // Upload transcript
  const uploadTranscript = useMutation({
    mutationFn: async (file: File) => {
      const path = `${id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('meeting-files').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('meeting-files').getPublicUrl(path);
      const { error } = await supabase.from('meetings').update({ transcript_url: urlData.publicUrl }).eq('id', id!);
      if (error) throw error;
      return urlData.publicUrl;
    },
    onSuccess: (url) => {
      if (m) setLocalMeeting({ ...m, transcript_url: url });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      toast.success('Transcrição carregada');
    },
    onError: () => toast.error('Erro no upload'),
  });

  // Upload document
  const uploadDocument = useMutation({
    mutationFn: async (file: File) => {
      const path = `${id}/docs/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('meeting-files').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('meeting-files').getPublicUrl(path);
      const newDoc: MeetingDocument = { name: file.name, url: urlData.publicUrl, type: file.type || 'application/octet-stream' };
      const currentDocs = m?.documents || [];
      const updatedDocs = [...currentDocs, newDoc];
      const { error } = await supabase.from('meetings').update({ documents: updatedDocs as any }).eq('id', id!);
      if (error) throw error;
      return updatedDocs;
    },
    onSuccess: (docs) => {
      if (m) setLocalMeeting({ ...m, documents: docs });
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      toast.success('Documento carregado');
    },
    onError: () => toast.error('Erro no upload do documento'),
  });

  const removeDocument = async (idx: number) => {
    if (!m) return;
    const updated = m.documents.filter((_, i) => i !== idx);
    const { error } = await supabase.from('meetings').update({ documents: updated as any }).eq('id', m.id);
    if (error) { toast.error('Erro ao remover'); return; }
    setLocalMeeting({ ...m, documents: updated });
    qc.invalidateQueries({ queryKey: ['meeting', id] });
    toast.success('Documento removido');
  };

  const participantProfiles = profiles.filter(p => participants.some(pp => pp.profile_id === p.id));

  if (isLoading || !m) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <InlineLoader />
        </div>
      </AppLayout>
    );
  }

  // ── Access gate ────────────────────────────────────────────────
  // Owner real (sem impersonação) vê tudo.
  // Caso contrário, só vê quem é criador OU participante da reunião.
  const realIsOwner = isOwner && !impersonating;
  const myProfileId = profiles.find(p => p.user_id === effectiveUserId)?.id ?? null;
  const isCreator = !!effectiveUserId && m.created_by === effectiveUserId;
  const isParticipant = !!myProfileId && participants.some(pp => pp.profile_id === myProfileId);
  const canViewDetail = realIsOwner || isCreator || isParticipant;
  const canEdit = canViewDetail; // mesmas regras: só quem participa edita

  if (!canViewDetail) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-12 rounded-xl border border-border/60 bg-card p-8 text-center space-y-3 shadow-subtle">
          <h2 className="text-lg font-semibold text-foreground">Sem acesso ao detalhe</h2>
          <p className="text-sm text-muted-foreground">
            Esta reunião está marcada para outras pessoas. Só os participantes ou o criador podem ver o detalhe e editar.
          </p>
          <Button variant="outline" onClick={() => navigate('/hub/reunioes')}>← Voltar às reuniões</Button>
        </div>
      </AppLayout>
    );
  }

  const clientLabel = m.client_name || 'Cliente';
  const ownerLabel = ownerName || settings?.business_name || 'Owner';
  const meetingType = m.meeting_type || 'recorrente';
  const showClientSection = true;
  const showProjectField = meetingType === 'projeto' || meetingType === 'cliente' || meetingType === 'inicial';

  const typeLabels: Record<MeetingType, string> = { recorrente: 'Recorrente', projeto: 'Projeto', cliente: 'Cliente', diagnostico: 'Diagnóstico', inicial: 'Inicial' };
  const typeColors: Record<MeetingType, string> = { recorrente: '#6366f1', projeto: '#3b82f6', cliente: '#10b981', diagnostico: '#f59e0b', inicial: '#ec4899' };

  const statusBadgeColors: Record<string, string> = {
    por_organizar: 'bg-info/15 text-info border-info/30',
    por_confirmar: 'bg-warning/15 text-warning border-warning/30',
    confirmada: 'bg-success/15 text-success border-success/30',
    terminada: 'bg-muted text-muted-foreground border-muted',
  };

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        {/* Top bar */}
        <EntityTopBar
          backTo="/hub/reunioes"
          backLabel={sectorConfig.t('reunioes')}
          primaryAction={
            dirty
              ? {
                  label: saveMutation.isPending ? 'A guardar...' : 'Guardar',
                  onClick: handleSave,
                  disabled: saveMutation.isPending,
                  loading: saveMutation.isPending,
                }
              : undefined
          }
          secondaryActions={
            isOwner
              ? [
                  ...(isSeriesParent
                    ? [{
                        label: regenerating ? 'A regenerar...' : 'Regenerar ocorrências',
                        icon: RefreshCw,
                        onClick: async () => {
                          if (!m) return;
                          setRegenerating(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('regenerate-recurring-meetings', {
                              body: { parent_meeting_id: m.id },
                            });
                            if (error) throw error;
                            const created = (data as any)?.created ?? 0;
                            const end = (data as any)?.effective_end ?? '';
                            if (created > 0) {
                              toast.success(`${created} nova(s) ocorrência(s) gerada(s)${end ? ` até ${end}` : ''}`);
                              qc.invalidateQueries({ queryKey: ['meeting'] });
                              qc.invalidateQueries({ queryKey: ['meetings'] });
                              qc.invalidateQueries({ queryKey: ['series_count'] });
                            } else {
                              toast.info((data as any)?.message ?? 'Sem ocorrências novas para gerar.');
                            }
                          } catch (e: any) {
                            toast.error(e?.message ?? 'Falhou a regeneração');
                          } finally {
                            setRegenerating(false);
                          }
                        },
                        disabled: regenerating,
                      }]
                    : []),
                  {
                    label: 'Eliminar',
                    icon: Trash2,
                    variant: 'destructive' as const,
                    onClick: () => {
                      if (isSeriesParent && seriesCount > 0) {
                        setDeleteDialogOpen(true);
                      } else {
                        deleteMutation.mutate('single');
                      }
                    },
                    disabled: deleteMutation.isPending,
                  },
                ]
              : []
          }
        />

        {/* Hero: cover + icon */}
        <EntityHeroHeader
          icon={parseIcon((m as any).icon)}
          onIconChange={(next) => update({ icon: next as any } as any)}
          coverUrl={(m as any).cover_url}
          onCoverChange={(url) => update({ cover_url: url } as any)}
          bucket="entity-icons"
          pathPrefix={`meetings/${id || 'new'}`}
          disabled={!isOwner}
        />

        {/* Series delete dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar reunião recorrente</AlertDialogTitle>
              <AlertDialogDescription>
                Esta reunião tem {seriesCount} ocorrência(s) futura(s). O que pretende fazer?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate('single')}>
                Eliminar só esta
              </AlertDialogAction>
              <AlertDialogAction onClick={() => deleteMutation.mutate('future')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar esta e futuras
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Series save dialog */}
        <AlertDialog open={seriesSaveDialogOpen} onOpenChange={setSeriesSaveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aplicar alterações à série?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta reunião faz parte de uma série recorrente. Alteraste campos que podem ser propagados (ex.: link Meet, título, duração, cliente). O que pretendes fazer?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setSeriesSaveDialogOpen(false); saveMutation.mutate('single'); }}>
                Só esta reunião
              </AlertDialogAction>
              <AlertDialogAction onClick={() => { setSeriesSaveDialogOpen(false); saveMutation.mutate('series'); }}>
                Aplicar a toda a série
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Title */}
        <EntityTitle
          inlineMode
          title={m.title}
          onTitleChange={(next) => update({ title: next })}
          isOwner={isOwner}
          placeholder="Título da reunião"
          meta={
            <>
              <Badge className="text-[11px] font-semibold px-2 py-0.5" style={{ backgroundColor: `${typeColors[meetingType]}20`, color: typeColors[meetingType], border: `1px solid ${typeColors[meetingType]}40` }}>
                {typeLabels[meetingType]}
              </Badge>
              {(isSeriesParent || isSeriesChild) && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Repeat className="h-3 w-3" /> Série
                </Badge>
              )}
            </>
          }
        />

        {/* Properties */}
        <EntityProperties>
          <EntityProperty icon={CalendarIcon} label="Data e hora">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-sm hover:bg-muted rounded px-2 py-1 transition-colors -ml-2">
                    {format(parseISO(m.date_time), "dd MMM yyyy", { locale: pt })}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(m.date_time)}
                    onSelect={day => {
                      if (!day) return;
                      const prev = parseISO(m.date_time);
                      day.setHours(prev.getHours(), prev.getMinutes());
                      update({ date_time: day.toISOString() });
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">às</span>
              <Input
                type="time"
                value={format(parseISO(m.date_time), 'HH:mm')}
                onChange={e => {
                  const [h, min] = e.target.value.split(':').map(Number);
                  const d = parseISO(m.date_time);
                  d.setHours(h, min);
                  update({ date_time: d.toISOString() });
                }}
                className={cn(inlineInputClass, 'w-20')}
              />
            </div>
          </EntityProperty>

          {meetingWindowWarning && (
            <div className="px-3 py-2 rounded-md border border-warning/40 bg-warning/10 text-warning text-xs flex items-start gap-2">
              <span className="font-semibold shrink-0">⚠ Conflito:</span>
              <span>{meetingWindowWarning}</span>
            </div>
          )}

          <EntityProperty icon={Clock} label="Status">
            <Select value={m.status} onValueChange={v => update({ status: v as MeetingStatus })}>
              <SelectTrigger className="h-auto border-none shadow-none p-0 w-auto [&>svg]:hidden bg-transparent">
                <StatusBadge status={m.status} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EntityProperty>

          <EntityProperty icon={Clock} label="Tempo previsto">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={m.planned_duration_minutes ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? null : (parseInt(e.target.value) || 0);
                  update({ planned_duration_minutes: v as any });
                }}
                placeholder="—"
                className={cn(inlineInputClass, 'w-16')}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </EntityProperty>

          <EntityProperty icon={Clock} label="Tempo real">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={m.actual_duration_minutes ?? ''}
                onChange={e => {
                  const v = e.target.value === '' ? null : (parseInt(e.target.value) || 0);
                  update({ actual_duration_minutes: v as any });
                }}
                placeholder="—"
                className={cn(inlineInputClass, 'w-16')}
              />
              <span className="text-xs text-muted-foreground">min</span>
              {m.planned_duration_minutes && m.actual_duration_minutes ? (
                (() => {
                  const delta = (m.actual_duration_minutes || 0) - (m.planned_duration_minutes || 0);
                  const pct = Math.round((delta / m.planned_duration_minutes!) * 100);
                  const cls = delta > 0 ? 'text-destructive' : delta < 0 ? 'text-success' : 'text-muted-foreground';
                  return <span className={cn('text-[10px] font-medium', cls)}>{delta > 0 ? '+' : ''}{pct}%</span>;
                })()
              ) : null}
            </div>
          </EntityProperty>

          {showClientSection && (
            <EntityProperty icon={Users} label={sectorConfig.t('cliente')}>
              <Select value={m.client_id ?? ''} onValueChange={v => {
                const selected = clientsList.find((c: any) => c.id === v);
                update({ client_id: v || null, client_name: selected?.full_name || null });
              }}>
                <SelectTrigger className={cn(inlineTriggerClass, 'min-w-[140px]')}>
                  <SelectValue placeholder="Sem cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientsList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntityProperty>
          )}

          {!showClientSection && (
            <EntityProperty icon={FolderOpen} label="Departamento">
              <Select value={m.department ?? ''} onValueChange={v => {
                const patch: Partial<MeetingFull> = { department: v || null };
                if (v !== 'produtos') { patch.product_id = null; patch.product_name = null; }
                update(patch);
              }}>
                <SelectTrigger className={cn(inlineTriggerClass, 'min-w-[140px]')}>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODULES).filter(([, v]) => v.section === 'departamentos').map(([key, v]) => (
                    <SelectItem key={key} value={key}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntityProperty>
          )}

          {m.department === 'produtos' && !showClientSection && (
            <EntityProperty icon={FileText} label={sectorConfig.t('produto')}>
              <Select value={m.product_id ?? ''} onValueChange={v => {
                const prod = productsList.find(p => p.id === v);
                update({ product_id: v || null, product_name: prod?.name || null });
              }}>
                <SelectTrigger className={cn(inlineTriggerClass, 'min-w-[140px]')}>
                  <SelectValue placeholder="Sem produto" />
                </SelectTrigger>
                <SelectContent>
                  {productsList.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntityProperty>
          )}

          {showProjectField && (
            <EntityProperty icon={FolderOpen} label={sectorConfig.t('projeto')}>
              <Select value={m.project_id ?? ''} onValueChange={v => {
                const proj = projectsList.find(p => p.id === v);
                const patch: Partial<MeetingFull> = { project_id: v || null, project_name: proj?.name || null };
                // Cascata: ao escolher projeto, herda produto e cliente automaticamente
                if (proj) {
                  if (proj.product_id) {
                    patch.product_id = proj.product_id;
                    patch.product_name = proj.product_name;
                  }
                  if (proj.client_id) {
                    patch.client_id = proj.client_id;
                    patch.client_name = proj.client_name;
                  }
                }
                update(patch);
              }}>
                <SelectTrigger className={cn(inlineTriggerClass, 'min-w-[140px]')}>
                  <SelectValue placeholder="Sem projeto" />
                </SelectTrigger>
                <SelectContent>
                  {projectsList.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EntityProperty>
          )}

          <EntityProperty icon={Users} label="Participantes">
            <div className="flex flex-wrap gap-2 items-center w-full py-1">
              {participants.map(p => {
                const profile = profiles.find(pr => pr.id === p.profile_id);
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded-full border bg-muted/30 pl-1 pr-2 py-0.5 text-sm group">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={getPhotoUrl(profile)} />
                      <AvatarFallback className="text-[8px]">{initials(profile?.full_name || null)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{profile?.full_name || '—'}</span>
                    <button
                      onClick={async () => {
                        await supabase.from('meeting_participants').delete().eq('id', p.id);
                        qc.invalidateQueries({ queryKey: ['meeting_participants', id] });
                      }}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {(() => {
                const participantIds = new Set(participants.map(p => p.profile_id));
                const available = profiles.filter(p => !participantIds.has(p.id));
                if (available.length === 0) return null;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="start">
                      <ScrollArea className="max-h-[200px]">
                        {available.map(p => (
                          <button
                            key={p.id}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-colors"
                            onClick={async () => {
                              await supabase.from('meeting_participants').insert({ meeting_id: id!, profile_id: p.id });
                              qc.invalidateQueries({ queryKey: ['meeting_participants', id] });
                            }}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getPhotoUrl(p)} />
                              <AvatarFallback className="text-[8px]">{initials(p.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{p.full_name}</span>
                          </button>
                        ))}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>
          </EntityProperty>

          <EntityProperty icon={Link2} label="Link de acesso">
            {m.meeting_url ? (
              <a href={m.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-2">
                {m.meeting_url.replace(/^https?:\/\//, '').slice(0, 40)}{m.meeting_url.length > 50 ? '…' : ''}
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            ) : (
              <Input
                value=""
                onChange={e => update({ meeting_url: e.target.value || null })}
                placeholder="https://zoom.us/j/..."
                className={inlineInputClass}
              />
            )}
          </EntityProperty>
        </EntityProperties>

        {/* Action buttons — subtle, outside card */}
        <div className="flex items-center gap-2 flex-wrap">
          <AddToCalendarButtons event={{
            title: m.title,
            startDate: m.date_time,
            meetingUrl: m.meeting_url,
            recurrence: calendarRecurrence,
            attendees: clientEmail ? [clientEmail] : [],
          }} />
          {m.meeting_url && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
              update({ meeting_url: null });
            }}>
              Editar link
            </Button>
          )}
        </div>

        {/* ═══ CARD: Documentos & Transcrição ═══ */}
        <EntitySection title="Documentos" icon={FolderOpen}>
          <div className="space-y-4">
            {/* Transcript */}
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground min-w-[80px]">Transcrição</Label>
              {m.transcript_url ? (
                <a href={m.transcript_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Ver transcrição <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploadTranscript.isPending}>
                  <Upload className="h-3 w-3 mr-1" /> {uploadTranscript.isPending ? 'A carregar...' : 'Carregar PDF'}
                </Button>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadTranscript.mutate(e.target.files[0]); e.target.value = ''; }} />
            </div>

            {/* Ficheiros */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-muted-foreground min-w-[80px]">Ficheiros</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => docsRef.current?.click()} disabled={uploadDocument.isPending}>
                  <Upload className="h-3 w-3 mr-1" /> {uploadDocument.isPending ? 'A carregar...' : 'Adicionar ficheiro'}
                </Button>
                <input ref={docsRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadDocument.mutate(e.target.files[0]); e.target.value = ''; }} />
              </div>
              {m.documents.length > 0 && (
                <div className="flex flex-wrap gap-2 ml-[92px]">
                  {m.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs bg-muted/30">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={safeUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
                        {doc.name}
                      </a>
                      <button onClick={() => removeDocument(idx)} className="text-muted-foreground hover:text-destructive ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </EntitySection>

        {/* Portal notes from client */}
        {(m as any).portal_notes && (
          <div className="rounded-lg border border-warning/30 bg-warning/15 dark:bg-warning/20 dark:border-warning p-4 space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-warning dark:text-warning">Nota do cliente sobre horário</span>
            </div>
            <p className="text-sm text-warning dark:text-warning">{(m as any).portal_notes}</p>
          </div>
        )}

        {/* Tópicos sugeridos pelo cliente / equipa via portal */}
        {prepItems.filter((p) => p.source === 'portal').length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Tópicos sugeridos pelo cliente</span>
            </div>
            <ul className="space-y-1.5">
              {prepItems.filter((p) => p.source === 'portal').map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <p>{p.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.author_label || 'Cliente'} · {new Date(p.created_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visibilidade no portal — só faz sentido com cliente associado */}
        {m.client_id && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="meeting-visible-portal" className="text-sm font-medium cursor-pointer">
                Visível no portal do cliente
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando desligado, esta reunião fica só interna — o cliente não a vê no portal.
              </p>
            </div>
            <Switch
              id="meeting-visible-portal"
              checked={(m as any).visible_in_portal !== false}
              onCheckedChange={v => update({ visible_in_portal: v } as any)}
            />
          </div>
        )}

        <EntitySection title="Pontos Discutidos" icon={CheckSquare}>
          <RichTextEditor
            content={m.discussion_notes || ''}
            onChange={html => update({ discussion_notes: html })}
          />
        </EntitySection>

        {/* ═══ CARD: Próximos Passos ═══ */}
        <EntitySection
          title="Próximos Passos"
          icon={ListTodo}
          action={
            <Button variant="outline" size="sm" className="h-7 text-xs gap-2" onClick={() => setCreateTasksOpen(true)}>
              <ListTodo className="h-3.5 w-3.5" /> Criar Tarefas
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card/50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{ownerLabel}</h4>
              <EditableChecklist
                items={m.owner_actions}
                onChange={items => update({ owner_actions: items })}
                label=""
              />
            </div>
            {showClientSection && (
              <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">{clientLabel}</h4>
                <EditableChecklist
                  items={m.client_actions}
                  onChange={items => update({ client_actions: items })}
                  label=""
                />
              </div>
            )}
          </div>
        </EntitySection>

        {/* ═══ CARD: Decisões Tomadas ═══ */}
        <EntitySection title="Decisões Tomadas" icon={Lightbulb}>
          <div className="space-y-2">
            {m.priorities.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs font-semibold text-primary bg-primary/15 rounded-full h-6 w-6 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <textarea
                  value={p}
                  onChange={e => {
                    const next = [...m.priorities];
                    next[i] = e.target.value;
                    update({ priorities: next });
                  }}
                  placeholder={`Decisão ${i + 1}`}
                  rows={2}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                  className="flex-1 bg-transparent text-sm border-none outline-none resize-none leading-relaxed rounded px-2 py-1.5 min-h-[44px] hover:bg-muted/30 focus:bg-muted/30 transition-colors"
                />
              </div>
            ))}
          </div>
        </EntitySection>

        {/* ═══ CARD: Notas finais ═══ */}
        <EntitySection title="Notas Finais" icon={StickyNote}>
          <EditableBulletList
            items={m.final_notes}
            onChange={items => update({ final_notes: items })}
            label=""
          />
        </EntitySection>

        {/* Create tasks dialog */}
        <CreateTasksFromMeetingDialog
          open={createTasksOpen}
          onOpenChange={setCreateTasksOpen}
          ownerActions={m.owner_actions}
          clientActions={m.client_actions}
          ownerLabel={ownerLabel}
          clientLabel={clientLabel}
          meetingTitle={m.title}
          projectId={m.project_id}
          department={m.department}
        />

        {/* Sticky save bar */}
        {dirty && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="shadow-lg px-6">
              {saveMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function ReuniaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <DetailAccessGuard entity="meeting" id={id}>
      <ReuniaoDetailPageInner />
    </DetailAccessGuard>
  );
}
