import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  CalendarIcon,
  ExternalLink,
  FileText,
  Link2,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { BackNavigation } from '@/components/BackNavigation';
import {
  EntityHeroHeader,
  EntityListIcon,
  parseIcon,
} from '@/components/entity-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { InlineLoader, EmptyHint } from '@/components/ui/loading-skeletons';
import { AddToCalendarButtons } from '@/components/AddToCalendarButtons';
import { getInitials, cn } from '@/lib/utils';

type EventForm = {
  title: string;
  start_date: string;
  end_date: string;
  event_type_id: string | null;
  product_id: string | null;
  client_name: string;
  department: string;
  meeting_url: string;
  notes: string;
};

const EMPTY: EventForm = {
  title: '',
  start_date: '',
  end_date: '',
  event_type_id: null,
  product_id: null,
  client_name: '',
  department: '',
  meeting_url: '',
  notes: '',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const confirm = useConfirm();
  const { getPhotoUrl } = useTeamPhotos();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event-detail', id],
    queryFn: async () => {
      const { data } = await supabase.from('events').select('*').eq('id', id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: types = [] } = useQuery({
    queryKey: ['event-types'],
    queryFn: async () => {
      const { data } = await supabase.from('event_types').select('id, name, color').order('name');
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-list-min'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['event-members', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_members')
        .select('profile_id, profiles:profile_id(id, full_name, photo_url, avatar_url)')
        .eq('event_id', id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['event-attachments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('event_attachments')
        .select('*')
        .eq('event_id', id!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<EventForm>(EMPTY);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (event && !initialized) {
      setForm({
        title: event.title || '',
        start_date: toLocalInput(event.start_date),
        end_date: toLocalInput(event.end_date),
        event_type_id: event.event_type_id || null,
        product_id: event.product_id || null,
        client_name: event.client_name || '',
        department: event.department || '',
        meeting_url: event.meeting_url || '',
        notes: event.notes || '',
      });
      setInitialized(true);
    }
  }, [event, initialized]);

  const update = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }
    if (!form.start_date) {
      toast.error('Data de início é obrigatória');
      return;
    }
    const payload: any = {
      title: form.title.trim(),
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      event_type_id: form.event_type_id || null,
      product_id: form.product_id || null,
      client_name: form.client_name || null,
      department: form.department || null,
      meeting_url: form.meeting_url || null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from('events').update(payload).eq('id', id!);
    if (error) {
      toast.error('Erro ao guardar evento');
      return;
    }
    toast.success('Evento atualizado');
    qc.invalidateQueries({ queryKey: ['event-detail', id] });
    qc.invalidateQueries({ queryKey: ['events'] });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar evento?',
      description: 'Esta ação não pode ser revertida.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    const { error } = await supabase.from('events').delete().eq('id', id!);
    if (error) {
      toast.error('Erro ao eliminar');
      return;
    }
    toast.success('Evento eliminado');
    qc.invalidateQueries({ queryKey: ['events'] });
    navigate('/hub/agenda');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <InlineLoader />
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Evento não encontrado</div>
      </AppLayout>
    );
  }

  const type = types.find((t: any) => t.id === event.event_type_id);
  const productName =
    products.find((p: any) => p.id === form.product_id)?.name ?? event.product_name ?? null;

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        <EntityHeroHeader
          icon={parseIcon((event as any)?.icon)}
          onIconChange={async (next) => {
            await supabase.from('events').update({ icon: next as any } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['event-detail', id] });
            qc.invalidateQueries({ queryKey: ['events'] });
          }}
          coverUrl={(event as any)?.cover_url || null}
          onCoverChange={async (url) => {
            await supabase.from('events').update({ cover_url: url } as any).eq('id', id!);
            qc.invalidateQueries({ queryKey: ['event-detail', id] });
          }}
          bucket="entity-icons"
          pathPrefix={`events/${id}`}
          disabled={!isOwner}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <BackNavigation parentRoute="/hub/agenda" parentLabel="Agenda" />
          <h1 className="text-xl font-bold leading-tight tracking-tight truncate max-w-[55%]">
            {form.title || 'Sem título'}
          </h1>
          {type && (
            <Badge variant="outline" style={{ borderColor: type.color, color: type.color }}>
              {type.name}
            </Badge>
          )}
          <div className="flex-1" />
          {isOwner && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!isOwner}>Guardar</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Edição */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informação do Evento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Título" className="md:col-span-2">
                <Input value={form.title} onChange={(e) => update('title', e.target.value)} disabled={!isOwner} />
              </Field>
              <Field label="Início">
                <Input
                  type="datetime-local"
                  value={form.start_date}
                  onChange={(e) => update('start_date', e.target.value)}
                  disabled={!isOwner}
                />
              </Field>
              <Field label="Fim">
                <Input
                  type="datetime-local"
                  value={form.end_date}
                  onChange={(e) => update('end_date', e.target.value)}
                  disabled={!isOwner}
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={form.event_type_id || undefined}
                  onValueChange={(v) => update('event_type_id', v)}
                  disabled={!isOwner}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {types.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Produto">
                <Select
                  value={form.product_id || undefined}
                  onValueChange={(v) => update('product_id', v)}
                  disabled={!isOwner}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cliente">
                <Input value={form.client_name} onChange={(e) => update('client_name', e.target.value)} disabled={!isOwner} />
              </Field>
              <Field label="Departamento">
                <Input value={form.department} onChange={(e) => update('department', e.target.value)} disabled={!isOwner} />
              </Field>
              <Field label="Link da reunião" className="md:col-span-2">
                <Input
                  value={form.meeting_url}
                  onChange={(e) => update('meeting_url', e.target.value)}
                  placeholder="https://…"
                  disabled={!isOwner}
                />
              </Field>
              <Field label="Notas" className="md:col-span-2">
                <Textarea rows={4} value={form.notes} onChange={(e) => update('notes', e.target.value)} disabled={!isOwner} />
              </Field>
            </CardContent>
          </Card>

          {/* Painel lateral */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Quando
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <p>
                  <span className="text-muted-foreground">Início: </span>
                  {event.start_date
                    ? format(parseISO(event.start_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })
                    : '—'}
                </p>
                {event.end_date && (
                  <p>
                    <span className="text-muted-foreground">Fim: </span>
                    {format(parseISO(event.end_date), "dd MMM yyyy 'às' HH:mm", { locale: pt })}
                  </p>
                )}
                {productName && (
                  <p className="flex items-center gap-2 mt-2">
                    <span className="text-muted-foreground">Produto:</span>
                    <EntityListIcon
                      size="xs"
                      name={productName}
                    />
                    <span className="font-medium truncate">{productName}</span>
                  </p>
                )}
                {form.meeting_url && (
                  <a
                    href={form.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Abrir link
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="pt-3">
                  <AddToCalendarButtons
                    event={{
                      title: event.title,
                      startDate: event.start_date,
                      endDate: event.end_date,
                      notes: event.notes,
                      meetingUrl: event.meeting_url,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Membros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 && <EmptyHint>Sem membros associados</EmptyHint>}
                <div className="flex flex-wrap gap-2">
                  {members.map((m: any) => {
                    const p = m.profiles;
                    if (!p) return null;
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={getPhotoUrl(p)} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(p.full_name) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{p.full_name || 'Sem nome'}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Anexos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {attachments.length === 0 && <EmptyHint>Sem anexos</EmptyHint>}
                {attachments.map((a: any) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                      'hover:bg-muted/50 transition-colors'
                    )}
                  >
                    {a.type === 'link' ? (
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{a.name}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}