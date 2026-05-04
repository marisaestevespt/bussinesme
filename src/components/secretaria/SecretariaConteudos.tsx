import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMyProfileId } from '@/hooks/useMyProfileId';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ImageIcon } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { getStatusOption } from '@/lib/marketing-constants';

// Statuses that mean "still requires work from the assignee" (excludes scheduled/published).
const PENDING_CONTENT_STATUSES = [
  'em_ideia',
  'pronto_para_copy',
  'em_copy',
  'pronto_para_design',
  'em_design',
  'gravar',
  'editar',
  'aprovacao_final',
];

export default function SecretariaConteudos() {
  const { user, isOwner } = useAuth();
  const { data: profileId } = useMyProfileId();
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: myContent = [] } = useQuery({
    queryKey: ['my-content-items', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('*, content_channels(channel_id, marketing_channels(id, name))')
        .eq('assigned_to', profileId!)
        .not('status', 'eq', 'publicado')
        .order('scheduled_at', { ascending: true });
      return data || [];
    },
  });

  // For Owner: all content scheduled this month, regardless of assignee/status.
  const { data: monthAllContent = [] } = useQuery({
    queryKey: ['month-all-content', monthStart, monthEnd, isOwner],
    enabled: isOwner,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('*, content_channels(channel_id, marketing_channels(id, name))')
        .gte('scheduled_at', monthStart)
        .lte('scheduled_at', monthEnd + 'T23:59:59')
        .order('scheduled_at', { ascending: true });
      return data || [];
    },
  });

  const thisWeek = useMemo(() => myContent.filter(c =>
    c.scheduled_at && c.scheduled_at >= weekStart && c.scheduled_at <= weekEnd + 'T23:59:59'
  ), [myContent, weekStart, weekEnd]);

  const thisMonth = useMemo(() => myContent.filter(c =>
    c.scheduled_at && c.scheduled_at >= monthStart && c.scheduled_at <= monthEnd + 'T23:59:59'
  ), [myContent, monthStart, monthEnd]);

  const pending = useMemo(() => myContent.filter(c =>
    PENDING_CONTENT_STATUSES.includes(c.status)
  ), [myContent]);

  // Items shown in the gallery: for Owner, everything scheduled this month
  // (independent of assignee/status). For non-Owner, keep "my content" minus
  // items already shown in "Esta Semana".
  const galleryItems = useMemo(() => {
    return isOwner ? monthAllContent : thisMonth;
  }, [isOwner, monthAllContent, thisMonth]);

  if (myContent.length === 0 && galleryItems.length === 0) return null;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight uppercase">Os Meus Conteúdos</h3>
        <Badge variant="secondary">{pending.length} pendentes</Badge>
      </div>

      {thisWeek.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Esta Semana</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ContentTable items={thisWeek} onNavigate={id => navigate(`/hub/marketing/conteudos/${id}`)} />
          </CardContent>
        </Card>
      )}

      {galleryItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Este Mês ({galleryItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContentGallery items={galleryItems} onNavigate={id => navigate(`/hub/marketing/conteudos/${id}`)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContentTable({ items, onNavigate }: { items: any[]; onNavigate: (id: string) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Conteúdo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(c => {
          const opt = getStatusOption(c.status);
          const st = opt
            ? { label: opt.label, className: opt.color }
            : { label: c.status, className: 'bg-muted text-muted-foreground' };
          return (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => onNavigate(c.id)}>
              <TableCell className="font-medium">{c.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.scheduled_at ? format(parseISO(c.scheduled_at), 'dd/MM') : '—'}
              </TableCell>
              <TableCell><Badge className={st.className}>{st.label}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ContentGallery({ items, onNavigate }: { items: any[]; onNavigate: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map(c => {
        const opt = getStatusOption(c.status);
        const st = opt
          ? { label: opt.label, className: opt.color }
          : { label: c.status, className: 'bg-muted text-muted-foreground' };
        const channels: string[] = (c.content_channels || [])
          .map((cc: any) => cc.marketing_channels?.name)
          .filter(Boolean);
        return (
          <button
            key={c.id}
            onClick={() => onNavigate(c.id)}
            className="group text-left rounded-lg overflow-hidden border bg-card hover:shadow-md hq-transition"
          >
            <div className="aspect-square bg-muted relative overflow-hidden">
              {c.cover_url ? (
                <img
                  src={c.cover_url}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 hq-transition"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <div className="absolute bottom-2 right-2">
                <Badge
                  className={`${st.className} text-[10px] px-2 py-0.5 font-medium shadow-md ring-1 ring-background/60 backdrop-blur-md`}
                >
                  {st.label}
                </Badge>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {channels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {channels.slice(0, 2).map(ch => (
                    <Badge key={ch} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ch}
                    </Badge>
                  ))}
                  {channels.length > 2 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      +{channels.length - 2}
                    </Badge>
                  )}
                </div>
              )}
              <div className="text-xs font-medium line-clamp-2 leading-tight">{c.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {c.scheduled_at ? format(parseISO(c.scheduled_at), 'dd/MM') : '—'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
