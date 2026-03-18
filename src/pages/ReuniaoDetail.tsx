import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MODULES } from '@/lib/modules';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CalendarIcon, ArrowLeft, Trash2, Upload, FileText, Users, Plus, X, ExternalLink, StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

type MeetingStatus = 'por_confirmar' | 'marcada' | 'terminada';

const STATUSES: { value: MeetingStatus; label: string; color: string }[] = [
  { value: 'por_confirmar', label: 'Por confirmar', color: '#f59e0b' },
  { value: 'marcada', label: 'Marcada', color: '#10b981' },
  { value: 'terminada', label: 'Terminada', color: '#6b7280' },
];

interface CheckItem { text: string; checked: boolean; }

interface MeetingFull {
  id: string;
  title: string;
  date_time: string;
  status: MeetingStatus;
  client_name: string | null;
  project_name: string | null;
  department: string | null;
  transcript_url: string | null;
  discussion_points: CheckItem[];
  priorities: string[];
  owner_actions: CheckItem[];
  client_actions: CheckItem[];
  final_notes: string[];
  created_by: string | null;
}

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
      const { data, error } = await supabase.from('meetings').select('*').eq('id', id).single();
      if (error) throw error;
      const raw = data as any;
      return {
        ...raw,
        discussion_points: Array.isArray(raw.discussion_points) ? raw.discussion_points as CheckItem[] : [],
        priorities: Array.isArray(raw.priorities) ? raw.priorities as string[] : ['', '', '', '', ''],
        owner_actions: Array.isArray(raw.owner_actions) ? raw.owner_actions as CheckItem[] : [],
        client_actions: Array.isArray(raw.client_actions) ? raw.client_actions as CheckItem[] : [],
        final_notes: Array.isArray(raw.final_notes) ? raw.final_notes as string[] : [],
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

function useOwnerProfile() {
  return useQuery({
    queryKey: ['owner_profile'],
    queryFn: async () => {
      const { data: ownerRole } = await supabase.from('user_roles').select('user_id').eq('role', 'owner').limit(1).single();
      if (!ownerRole) return null;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', ownerRole.user_id).single();
      return profile?.full_name ?? null;
    },
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
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(i)} />
            <input
              value={item.text}
              onChange={e => updateText(i, e.target.value)}
              className={cn('flex-1 bg-transparent text-sm border-none outline-none', item.checked && 'line-through text-muted-foreground')}
            />
            <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Adicionar ponto..." className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && addItem()} />
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={addItem}><Plus className="h-3 w-3" /></Button>
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
      <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><StickyNote className="h-3.5 w-3.5" /> {label}</Label>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <span className="text-muted-foreground text-xs">•</span>
            <input value={item} onChange={e => updateItem(i, e.target.value)} className="flex-1 bg-transparent text-sm border-none outline-none" />
            <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Adicionar nota..." className="h-7 text-xs" onKeyDown={e => e.key === 'Enter' && addItem()} />
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={addItem}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function ReuniaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const { settings } = useBusinessSettings();

  const { data: meeting, isLoading } = useMeeting(id!);
  const { data: participants = [] } = useMeetingParticipants(id!);
  const { data: profiles = [] } = useProfiles();
  const { data: ownerName } = useOwnerProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  // Local editable state
  const [localMeeting, setLocalMeeting] = useState<MeetingFull | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (meeting && !localMeeting) setLocalMeeting(meeting);
  }, [meeting]);

  const m = localMeeting;

  const update = (patch: Partial<MeetingFull>) => {
    if (!m) return;
    setLocalMeeting({ ...m, ...patch });
    setDirty(true);
  };

  // Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!m) return;
      const { error } = await supabase.from('meetings').update({
        title: m.title,
        date_time: m.date_time,
        status: m.status,
        client_name: m.client_name,
        project_name: m.project_name,
        department: m.department,
        transcript_url: m.transcript_url,
        discussion_points: m.discussion_points as any,
        priorities: m.priorities as any,
        owner_actions: m.owner_actions as any,
        client_actions: m.client_actions as any,
        final_notes: m.final_notes as any,
      }).eq('id', m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting', id] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setDirty(false);
      toast.success('Reunião guardada');
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('meetings').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
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

  const participantProfiles = profiles.filter(p => participants.some(pp => pp.profile_id === p.id));

  if (isLoading || !m) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const clientLabel = m.client_name || 'Cliente';
  const ownerLabel = ownerName || settings?.business_name || 'Owner';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/hub/reunioes')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Reuniões
          </Button>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'A guardar...' : 'Guardar'}
              </Button>
            )}
            {isOwner && (
              <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="space-y-4">
          <input
            value={m.title}
            onChange={e => update({ title: e.target.value })}
            className="text-2xl font-bold text-foreground bg-transparent border-none outline-none w-full"
          />
          <div className="flex flex-wrap items-start gap-4 text-sm">
            {/* Editable date/time */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data e hora</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {format(parseISO(m.date_time), 'dd/MM/yyyy')}
                    </Button>
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
                <Input
                  type="time"
                  value={format(parseISO(m.date_time), 'HH:mm')}
                  onChange={e => {
                    const [h, min] = e.target.value.split(':').map(Number);
                    const d = parseISO(m.date_time);
                    d.setHours(h, min);
                    update({ date_time: d.toISOString() });
                  }}
                  className="h-7 w-24 text-xs"
                />
              </div>
            </div>
            <Select value={m.status} onValueChange={v => update({ status: v as MeetingStatus })}>
              <SelectTrigger className="w-auto h-7 text-xs"><SelectValue /></SelectTrigger>
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
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap gap-6 text-sm">
            {participantProfiles.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Participantes</Label>
                <div className="flex -space-x-1">
                  {participantProfiles.map(p => (
                    <Avatar key={p.id} className="h-7 w-7 border-2 border-background">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input
                value={m.client_name ?? ''}
                onChange={e => update({ client_name: e.target.value || null })}
                placeholder="Sem cliente"
                className="h-7 text-xs w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Departamento</Label>
              <Select value={m.department ?? ''} onValueChange={v => update({ department: v || null })}>
                <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MODULES).filter(([, v]) => v.section === 'departamentos').map(([key, v]) => (
                    <SelectItem key={key} value={key}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Projeto</Label>
              <Input
                value={m.project_name ?? ''}
                onChange={e => update({ project_name: e.target.value || null })}
                placeholder="Sem projeto"
                className="h-7 text-xs w-40"
              />
            </div>
          </div>

          {/* Transcript */}
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">Transcrição</Label>
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
        </div>

        <Separator />

        {/* ATA DA REUNIÃO */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-foreground">Ata da Reunião</h2>

          {/* Pontos discutidos */}
          <EditableChecklist
            items={m.discussion_points}
            onChange={items => update({ discussion_points: items })}
            label="Pontos discutidos"
          />

          <Separator />

          {/* Prioridades */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-foreground">→ Definição das Primeiras Prioridades</Label>
            <div className="space-y-2">
              {m.priorities.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                  <Input
                    value={p}
                    onChange={e => {
                      const next = [...m.priorities];
                      next[i] = e.target.value;
                      update({ priorities: next });
                    }}
                    placeholder={`Prioridade ${i + 1}`}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Próximas Ações */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-foreground">→ Próximas Ações</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Owner block */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">{ownerLabel}</h4>
                <EditableChecklist
                  items={m.owner_actions}
                  onChange={items => update({ owner_actions: items })}
                  label=""
                />
              </div>
              {/* Client block */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">{clientLabel}</h4>
                <EditableChecklist
                  items={m.client_actions}
                  onChange={items => update({ client_actions: items })}
                  label=""
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notas finais */}
          <EditableBulletList
            items={m.final_notes}
            onChange={items => update({ final_notes: items })}
            label="📝 Notas finais"
          />
        </div>

        {/* Sticky save bar */}
        {dirty && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="shadow-lg px-6">
              {saveMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
