import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  por_criar: { label: 'Por criar', className: 'bg-muted text-muted-foreground' },
  em_criacao: { label: 'Em criação', className: 'bg-info/15 text-info' },
  para_aprovacao: { label: 'Para aprovação', className: 'bg-purple-100 text-purple-800' },
  aprovado: { label: 'Aprovado', className: 'bg-success/15 text-success' },
  agendado: { label: 'Agendado', className: 'bg-warning/15 text-warning' },
  publicado: { label: 'Publicado', className: 'bg-success/15 text-success' },
};

export default function SecretariaConteudos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const { data: myContent = [] } = useQuery({
    queryKey: ['my-content-items', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('*')
        .eq('assigned_to', user!.id)
        .not('status', 'eq', 'publicado')
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
    ['por_criar', 'em_criacao', 'para_aprovacao'].includes(c.status)
  ), [myContent]);

  if (myContent.length === 0) return null;

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

      {thisMonth.length > thisWeek.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Este Mês ({thisMonth.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ContentTable items={thisMonth.filter(c => !thisWeek.includes(c))} onNavigate={id => navigate(`/hub/marketing/conteudos/${id}`)} />
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
          const st = STATUS_MAP[c.status] || { label: c.status, className: 'bg-muted text-muted-foreground' };
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
